import type { RGB, ScannedElement } from './types';
import { SQUINT_ID_ATTR } from './types';
import { parseCssColor, type ParsedColor } from './color-utils';

let squintIdCounter = 0;

function isExcludedElement(el: Element): boolean {
  if (el.closest('svg')) return true;
  if (el.tagName === 'CANVAS' || el.tagName === 'IFRAME') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

// An element that IS or CONTAINS a real image must never receive a background fix:
// a background-color would show through a transparent image and background-image:none
// (applied for the icon/gradient case) would erase image content. Images are a hard
// non-goal, so any element wrapping one is excluded from selection entirely.
export function containsImageContent(el: Element): boolean {
  if (el.tagName === 'IMG' || el.tagName === 'PICTURE') return true;
  return el.querySelector('img, picture') !== null;
}

// Walk the light DOM and every OPEN shadow root beneath `root`. Closed shadow roots
// expose no `shadowRoot` handle and are unreachable by design (documented non-goal).
export function collectElementsDeep(root: ParentNode): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    out.push(el);
    const shadow = el.shadowRoot;
    if (shadow) out.push(...collectElementsDeep(shadow));
  }
  return out;
}

function hasDirectVisibleText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0) {
      return true;
    }
  }
  return false;
}

function isComputedVisible(style: CSSStyleDeclaration): boolean {
  return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
}

function intersectsViewport(rect: DOMRect): boolean {
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

function hasClippedFixedHeight(style: CSSStyleDeclaration, el: HTMLElement): boolean {
  if (style.overflow !== 'hidden') return false;
  return /^\d+(\.\d+)?px$/.test(style.height) && el.scrollHeight > el.clientHeight;
}

function qualifiesAsTextElement(el: HTMLElement): CSSStyleDeclaration | null {
  if (isExcludedElement(el)) return null;
  if (containsImageContent(el)) return null;
  if (!hasDirectVisibleText(el)) return null;
  if (el.innerText.trim().length === 0) return null;
  const style = window.getComputedStyle(el);
  if (!isComputedVisible(style)) return null;
  if (hasClippedFixedHeight(style, el)) return null;
  return style;
}

function compositeOver(layer: ParsedColor, backdrop: RGB): RGB {
  return {
    r: layer.rgb.r * layer.alpha + backdrop.r * (1 - layer.alpha),
    g: layer.rgb.g * layer.alpha + backdrop.g * (1 - layer.alpha),
    b: layer.rgb.b * layer.alpha + backdrop.b * (1 - layer.alpha),
  };
}

function resolveBackground(el: Element): { raw: { rgb: RGB; alpha: number }; effective: RGB } {
  const ownParsed = parseCssColor(window.getComputedStyle(el).backgroundColor) ?? {
    rgb: { r: 0, g: 0, b: 0 },
    alpha: 0,
  };

  // Semi-transparent backgrounds (e.g. rgba(0,0,0,.3)) must be composited against
  // whatever sits behind them, not treated as their raw, un-blended RGB.
  const layers: ParsedColor[] = [];
  let current: Element | null = el;
  while (current) {
    const parsed = parseCssColor(window.getComputedStyle(current).backgroundColor);
    if (parsed && parsed.alpha > 0) {
      layers.push(parsed);
      if (parsed.alpha >= 1) break;
    }
    current = current.parentElement;
  }

  if (layers.length === 0) return { raw: ownParsed, effective: { r: 255, g: 255, b: 255 } };

  let composite: RGB = { r: 255, g: 255, b: 255 };
  for (const layer of [...layers].reverse()) {
    composite = compositeOver(layer, composite);
  }

  return { raw: ownParsed, effective: composite };
}

function buildScannedElement(el: HTMLElement, style: CSSStyleDeclaration): ScannedElement | null {
  const textColor = parseCssColor(style.color);
  if (!textColor) return null;

  const { raw, effective } = resolveBackground(el);
  const squintId = squintIdCounter++;
  el.setAttribute(SQUINT_ID_ATTR, String(squintId));

  return {
    squintId,
    element: el,
    text: textColor.rgb,
    background: effective,
    paletteBackground: raw.alpha > 0 ? raw.rgb : null,
    fontSizePx: parseFloat(style.fontSize),
    fontWeight: parseInt(style.fontWeight, 10) || 400,
  };
}

function requestIdle(callback: () => void): void {
  const ric = (window as typeof window & { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  if (ric) ric(callback);
  else window.setTimeout(callback, 0);
}

export function scanVisibleTextElements(onBatch: (elements: ScannedElement[]) => void): Promise<void> {
  const allElements = collectElementsDeep(document.body);
  const viewportBatch: ScannedElement[] = [];
  const offscreen: HTMLElement[] = [];

  for (const el of allElements) {
    const style = qualifiesAsTextElement(el);
    if (!style) continue;
    if (intersectsViewport(el.getBoundingClientRect())) {
      const scanned = buildScannedElement(el, style);
      if (scanned) viewportBatch.push(scanned);
    } else {
      offscreen.push(el);
    }
  }
  onBatch(viewportBatch);

  return new Promise((resolve) => {
    requestIdle(() => {
      const offscreenBatch: ScannedElement[] = [];
      for (const el of offscreen) {
        const style = window.getComputedStyle(el);
        const scanned = buildScannedElement(el, style);
        if (scanned) offscreenBatch.push(scanned);
      }
      onBatch(offscreenBatch);
      resolve();
    });
  });
}
