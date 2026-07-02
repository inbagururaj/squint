import type { RGB } from './types';
import { SQUINT_ID_ATTR } from './types';
import { rgbToCssString } from './color-utils';

const STYLE_ELEMENT_ID = 'squint-injected-style';

export function getOrCreateStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ELEMENT_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  document.head.appendChild(style);
  return style;
}

function buildRule(squintId: number, text: RGB, background: RGB): string {
  // background-image (icons, gradients, patterns) paints over background-color, so a
  // flat fix color would otherwise render invisibly on elements that set their own image.
  return `[${SQUINT_ID_ATTR}="${squintId}"]{color:${rgbToCssString(text)} !important;background-color:${rgbToCssString(background)} !important;background-image:none !important;}`;
}

export function applyPreset(entries: Array<{ squintId: number; text: RGB; background: RGB }>): void {
  const styleEl = getOrCreateStyleElement();
  styleEl.textContent = entries.map((e) => buildRule(e.squintId, e.text, e.background)).join('\n');
}

export function removeFixes(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
}

export function watchStylesheetPersistence(styleEl: HTMLStyleElement): MutationObserver {
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
