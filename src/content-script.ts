import type { RGB, ScannedElement, FailingElement, ScanSummary, PresetId, ContentMessage, ContentResponse } from './types';
import { scanVisibleTextElements } from './dom-scanner';
import { contrastRatio, isLargeText, passesAA } from './contrast';
import { extractPalette } from './palette';
import { computePresets } from './presets';
import { applyPreset, getOrCreateStyleElement, isApplied, removeFixes, watchStylesheetPersistence } from './apply-fixes';
import { colorDistance } from './color-utils';

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
      try {
        stopObserver();
        removeFixes();
        sendResponse({ type: 'SQUINT_REMOVE_RESULT' });
      } catch (err) {
        console.error('[Squint] removeFixes failed:', err);
      }
      return false;
    }
    if (message.type === 'SQUINT_STATUS_REQUEST') {
      sendResponse({ type: 'SQUINT_STATUS_RESULT', applied: isApplied() });
      return false;
    }
    return false;
  },
);
