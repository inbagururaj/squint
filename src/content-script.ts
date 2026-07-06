import type {
  RGB,
  ScannedElement,
  FailingElement,
  ScanSummary,
  PresetId,
  ContentMessage,
  ContentResponse,
  SimplifyKind,
  SimplifyEntry,
  SimplifySummary,
} from './types';
import { SQUINT_SIMPLIFY_ID_ATTR } from './types';
import { scanVisibleTextElements } from './dom-scanner';
import { contrastRatio, isLargeText, passesAA } from './contrast';
import { extractPalette } from './palette';
import { computePresets } from './presets';
import { applyPreset, getOrCreateStyleElement, isApplied, removeFixes, watchStylesheetPersistence } from './apply-fixes';
import { colorDistance } from './color-utils';
import {
  isMarqueeElement,
  isSmallNonLinkedImage,
  isSmallAnimatedElement,
  isLargeBackgroundImageElement,
  buildFontFrequencyMap,
  findDominantFontSignature,
  isRareFontSample,
  dominantFontWeight,
  type ImageDescriptor,
  type BackgroundDescriptor,
  type FontSample,
} from './simplify';
import {
  applySimplify,
  getOrCreateSimplifyStyleElement,
  isSimplifyApplied,
  removeSimplify,
  watchSimplifyPersistence,
} from './simplify-apply';

const PALETTE_SIZE = 8;
const PALETTE_DEDUPE_THRESHOLD = 24;
const PRESET_LABELS: Record<PresetId, string> = {
  A: 'Darken background',
  B: 'Brighten text',
  C: 'Balance both',
};

let failingElements: FailingElement[] = [];
const elementsById = new Map<number, HTMLElement>();
let persistenceObserver: MutationObserver | null = null;

function computeFailingElements(scanned: ScannedElement[]): FailingElement[] {
  const backgroundSamples = scanned
    .map((e) => e.paletteBackground)
    .filter((c): c is RGB => c !== null);
  const textSamples = scanned.map((e) => e.text);
  const palette = extractPalette([...backgroundSamples, ...textSamples], PALETTE_SIZE, PALETTE_DEDUPE_THRESHOLD);
  const maxCount = palette.reduce((max, p) => Math.max(max, p.count), 1);

  const results: FailingElement[] = [];
  for (const el of scanned) {
    const large = isLargeText(el.fontSizePx, el.fontWeight);
    const ratio = contrastRatio(el.text, el.background);
    if (passesAA(ratio, large)) continue;

    const paletteMatch = palette.find((p) => colorDistance(p.color, el.background) <= PALETTE_DEDUPE_THRESHOLD);
    const prominence = paletteMatch ? paletteMatch.count / maxCount : 0;
    const variants = computePresets(el.text, el.background, large, prominence);
    if (variants.length === 0) continue;

    elementsById.set(el.squintId, el.element);
    results.push({ squintId: el.squintId, variants });
  }
  return results;
}

function buildSummary(scannedCount: number, failing: FailingElement[]): ScanSummary {
  const presets: ScanSummary['presets'] = {
    A: { label: PRESET_LABELS.A, fixableCount: 0, sample: null },
    B: { label: PRESET_LABELS.B, fixableCount: 0, sample: null },
    C: { label: PRESET_LABELS.C, fixableCount: 0, sample: null },
  };
  for (const fe of failing) {
    for (const variant of fe.variants) {
      const preset = presets[variant.presetId];
      preset.fixableCount += 1;
      if (!preset.sample) preset.sample = { text: variant.text, background: variant.background };
    }
  }
  return { totalScanned: scannedCount, totalFailing: failing.length, presets };
}

async function runScan(): Promise<ScanSummary> {
  const scanned: ScannedElement[] = [];
  await scanVisibleTextElements((batch) => scanned.push(...batch));
  failingElements = computeFailingElements(scanned);
  return buildSummary(scanned.length, failingElements);
}

function applyChosenPreset(presetId: PresetId): number {
  const entries = failingElements
    .map((fe) => {
      const variant = fe.variants.find((v) => v.presetId === presetId);
      const element = elementsById.get(fe.squintId);
      if (!variant || !element) return null;
      return { squintId: fe.squintId, text: variant.text, background: variant.background };
    })
    .filter((e): e is { squintId: number; text: RGB; background: RGB } => e !== null);

  applyPreset(entries);
  return entries.length;
}

function ensureObserver(): void {
  if (persistenceObserver) return;
  persistenceObserver = watchStylesheetPersistence(getOrCreateStyleElement());
}

function stopObserver(): void {
  persistenceObserver?.disconnect();
  persistenceObserver = null;
}

interface SimplifyCandidate {
  squintId: number;
  kind: SimplifyKind;
  fontWeight?: number;
}

const SIMPLIFY_KIND_ORDER: SimplifyKind[] = [
  'marquee',
  'small-image',
  'small-animated',
  'rare-font',
  'large-background',
];

let simplifyCandidates: SimplifyCandidate[] = [];
const simplifyElementsById = new Map<number, HTMLElement>();
let simplifyIdCounter = 0;
let simplifyObserver: MutationObserver | null = null;

function nextSimplifyId(el: HTMLElement): number {
  const id = simplifyIdCounter++;
  el.setAttribute(SQUINT_SIMPLIFY_ID_ATTR, String(id));
  simplifyElementsById.set(id, el);
  return id;
}

function isExcludedFromSimplify(el: Element): boolean {
  if (el.closest('svg')) return true;
  if (el.tagName === 'CANVAS' || el.tagName === 'IFRAME') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

function isComputedVisibleForSimplify(style: CSSStyleDeclaration): boolean {
  return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
}

function isLinkedElement(el: Element): boolean {
  return el.closest('a') !== null;
}

function isRenderedCircular(rect: DOMRect, style: CSSStyleDeclaration): boolean {
  const minSide = Math.min(rect.width, rect.height);
  if (minSide <= 0) return false;
  // Computed border-*-radius resolves to px; a circle needs a radius of half the shorter side.
  const radius = parseFloat(style.borderTopLeftRadius);
  return Number.isFinite(radius) && radius >= minSide / 2 - 1;
}

function toImageDescriptor(el: HTMLElement, style: CSSStyleDeclaration): ImageDescriptor {
  const rect = el.getBoundingClientRect();
  return {
    tagName: el.tagName,
    widthPx: rect.width,
    heightPx: rect.height,
    isLinked: isLinkedElement(el),
    src: el instanceof HTMLImageElement ? el.currentSrc || el.src : '',
    altText: el instanceof HTMLImageElement ? el.alt : '',
    className: el.getAttribute('class') ?? '',
    id: el.id,
    isCircular: isRenderedCircular(rect, style),
  };
}

function toBackgroundDescriptor(el: HTMLElement, style: CSSStyleDeclaration): BackgroundDescriptor {
  const rect = el.getBoundingClientRect();
  return {
    widthPx: rect.width,
    heightPx: rect.height,
    hasBackgroundImage: style.backgroundImage !== 'none' && style.backgroundImage !== '',
  };
}

function hasDirectVisibleTextForSimplify(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0) return true;
  }
  return false;
}

function buildSimplifySummary(candidates: SimplifyCandidate[]): SimplifySummary {
  const counts = SIMPLIFY_KIND_ORDER.reduce(
    (acc, kind) => {
      acc[kind] = 0;
      return acc;
    },
    {} as Record<SimplifyKind, number>,
  );
  for (const candidate of candidates) counts[candidate.kind] += 1;
  return { totalFlagged: candidates.length, counts };
}

function runSimplifyScan(): SimplifySummary {
  simplifyCandidates = [];
  simplifyElementsById.clear();
  simplifyIdCounter = 0;

  const allElements = Array.from(document.body.querySelectorAll<HTMLElement>('*'));
  const fontSampleElements: HTMLElement[] = [];
  const fontSampleStyles: CSSStyleDeclaration[] = [];

  for (const el of allElements) {
    if (isExcludedFromSimplify(el)) continue;
    const style = window.getComputedStyle(el);
    if (!isComputedVisibleForSimplify(style)) continue;

    if (isMarqueeElement(el.tagName)) {
      const id = nextSimplifyId(el);
      simplifyCandidates.push({ squintId: id, kind: 'marquee' });
      continue;
    }

    if (el instanceof HTMLImageElement || el.tagName === 'PICTURE') {
      const descriptor = toImageDescriptor(el, style);
      if (isSmallAnimatedElement(descriptor)) {
        const id = nextSimplifyId(el);
        simplifyCandidates.push({ squintId: id, kind: 'small-animated' });
        continue;
      }
      if (isSmallNonLinkedImage(descriptor)) {
        const id = nextSimplifyId(el);
        simplifyCandidates.push({ squintId: id, kind: 'small-image' });
        continue;
      }
    }

    const backgroundDescriptor = toBackgroundDescriptor(el, style);
    if (isLargeBackgroundImageElement(backgroundDescriptor)) {
      const id = nextSimplifyId(el);
      simplifyCandidates.push({ squintId: id, kind: 'large-background' });
      continue;
    }

    if (hasDirectVisibleTextForSimplify(el)) {
      fontSampleElements.push(el);
      fontSampleStyles.push(style);
    }
  }

  const fontSamples: FontSample[] = fontSampleStyles.map((style) => ({
    fontFamily: style.fontFamily,
    fontWeight: parseInt(style.fontWeight, 10) || 400,
    textDecorationLine: style.textDecorationLine,
  }));
  const frequency = buildFontFrequencyMap(fontSamples);
  const dominantSignature = findDominantFontSignature(frequency);
  const normalizedWeight = dominantFontWeight(fontSamples, dominantSignature);

  fontSampleElements.forEach((el, idx) => {
    const sample = fontSamples[idx];
    if (isRareFontSample(sample, frequency, dominantSignature)) {
      const id = nextSimplifyId(el);
      simplifyCandidates.push({ squintId: id, kind: 'rare-font', fontWeight: normalizedWeight });
    }
  });

  return buildSimplifySummary(simplifyCandidates);
}

function applyChosenSimplify(): number {
  const entries: SimplifyEntry[] = simplifyCandidates
    .filter((c) => simplifyElementsById.has(c.squintId))
    .map((c) => ({ squintId: c.squintId, kind: c.kind, fontWeight: c.fontWeight }));
  applySimplify(entries);
  return entries.length;
}

function ensureSimplifyObserver(): void {
  if (simplifyObserver) return;
  simplifyObserver = watchSimplifyPersistence(getOrCreateSimplifyStyleElement());
}

function stopSimplifyObserver(): void {
  simplifyObserver?.disconnect();
  simplifyObserver = null;
}

chrome.runtime.onMessage.addListener(
  (message: ContentMessage, _sender, sendResponse: (response: ContentResponse) => void) => {
    if (!message || typeof message.type !== 'string') return false;
    if (message.type === 'SQUINT_SCAN_REQUEST') {
      runScan().then((summary) => sendResponse({ type: 'SQUINT_SCAN_RESULT', summary }));
      return true;
    }
    if (message.type === 'SQUINT_APPLY_PRESET') {
      ensureObserver();
      const appliedCount = applyChosenPreset(message.presetId);
      sendResponse({ type: 'SQUINT_APPLY_RESULT', appliedCount });
      return false;
    }
    if (message.type === 'SQUINT_REMOVE_FIXES') {
      // Disconnect the persistence observer BEFORE removing the style element, or the
      // observer's own re-append would immediately undo the undo.
      stopObserver();
      removeFixes();
      sendResponse({ type: 'SQUINT_REMOVE_RESULT' });
      return false;
    }
    if (message.type === 'SQUINT_STATUS_REQUEST') {
      sendResponse({ type: 'SQUINT_STATUS_RESULT', applied: isApplied() });
      return false;
    }
    if (message.type === 'SQUINT_SIMPLIFY_SCAN_REQUEST') {
      const summary = runSimplifyScan();
      sendResponse({ type: 'SQUINT_SIMPLIFY_SCAN_RESULT', summary });
      return false;
    }
    if (message.type === 'SQUINT_SIMPLIFY_APPLY') {
      ensureSimplifyObserver();
      const appliedCount = applyChosenSimplify();
      sendResponse({ type: 'SQUINT_SIMPLIFY_APPLY_RESULT', appliedCount });
      return false;
    }
    if (message.type === 'SQUINT_SIMPLIFY_REMOVE') {
      // Disconnect before removal so the persistence observer cannot re-append the element.
      stopSimplifyObserver();
      removeSimplify();
      sendResponse({ type: 'SQUINT_SIMPLIFY_REMOVE_RESULT' });
      return false;
    }
    if (message.type === 'SQUINT_SIMPLIFY_STATUS_REQUEST') {
      sendResponse({ type: 'SQUINT_SIMPLIFY_STATUS_RESULT', applied: isSimplifyApplied() });
      return false;
    }
    return false;
  },
);
