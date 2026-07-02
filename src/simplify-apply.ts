import type { SimplifyEntry } from './types';
import { SQUINT_SIMPLIFY_ID_ATTR } from './types';

const SIMPLIFY_STYLE_ELEMENT_ID = 'squint-simplify-injected-style';
// Neutral gray flatten target — legible against both light and dark surrounding content.
const FLATTEN_BACKGROUND_COLOR = 'rgb(240, 240, 240)';

export function getOrCreateSimplifyStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(SIMPLIFY_STYLE_ELEMENT_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = document.createElement('style');
  style.id = SIMPLIFY_STYLE_ELEMENT_ID;
  document.head.appendChild(style);
  return style;
}

function buildRule(entry: SimplifyEntry): string {
  const selector = `[${SQUINT_SIMPLIFY_ID_ATTR}="${entry.squintId}"]`;
  switch (entry.kind) {
    case 'marquee':
    case 'small-image':
    case 'small-animated':
      return `${selector}{visibility:hidden !important;}`;
    case 'large-background':
      return `${selector}{background-image:none !important;background-color:${FLATTEN_BACKGROUND_COLOR} !important;}`;
    case 'rare-font':
      return `${selector}{font-weight:${entry.fontWeight ?? 400} !important;}`;
  }
}

export function applySimplify(entries: SimplifyEntry[]): void {
  const styleEl = getOrCreateSimplifyStyleElement();
  styleEl.textContent = entries.map(buildRule).join('\n');
}

export function removeSimplify(): void {
  document.getElementById(SIMPLIFY_STYLE_ELEMENT_ID)?.remove();
}

export function isSimplifyApplied(): boolean {
  return document.getElementById(SIMPLIFY_STYLE_ELEMENT_ID) !== null;
}

export function watchSimplifyPersistence(styleEl: HTMLStyleElement): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target === styleEl) continue;
      if (Array.from(mutation.removedNodes).includes(styleEl)) {
        document.head.appendChild(styleEl);
        break;
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return observer;
}
