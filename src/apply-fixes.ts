import type { RGB } from './types';
import { SQUINT_ID_ATTR } from './types';
import { rgbToCssString } from './color-utils';

const STYLE_ELEMENT_ID = 'squint-injected-style';

type StyleRoot = Document | ShadowRoot;

// A document-level <style> cannot reach shadow-encapsulated elements, so fixes are
// injected once per root (document.head + one style per open shadow root). Every
// injected element is tracked here so undo removes all of them regardless of root.
const injectedStyles = new Set<HTMLStyleElement>();

function styleContainerFor(root: StyleRoot): ParentNode {
  return root instanceof ShadowRoot ? root : document.head;
}

function getOrCreateStyleElementInRoot(root: StyleRoot): HTMLStyleElement {
  const container = styleContainerFor(root);
  const existing = container.querySelector<HTMLStyleElement>(`style#${STYLE_ELEMENT_ID}`);
  if (existing) {
    injectedStyles.add(existing);
    return existing;
  }
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  container.appendChild(style);
  injectedStyles.add(style);
  return style;
}

// Document-level style handle, used by the persistence observer and status checks.
export function getOrCreateStyleElement(): HTMLStyleElement {
  return getOrCreateStyleElementInRoot(document);
}

function buildRule(squintId: number, text: RGB, background: RGB): string {
  // background-image (icons, gradients, patterns) paints over background-color, so a
  // flat fix color would otherwise render invisibly on elements that set their own image.
  return `[${SQUINT_ID_ATTR}="${squintId}"]{color:${rgbToCssString(text)} !important;background-color:${rgbToCssString(background)} !important;background-image:none !important;}`;
}

function rootOf(element: HTMLElement): StyleRoot {
  const root = element.getRootNode();
  // A `[data-squint-id]` rule only matches within the root that owns the element, so
  // shadow-hosted elements must have their rule injected into that shadow root.
  return root instanceof ShadowRoot ? root : document;
}

export function applyPreset(
  entries: Array<{ element: HTMLElement; squintId: number; text: RGB; background: RGB }>,
): void {
  const rulesByRoot = new Map<StyleRoot, string[]>();
  for (const entry of entries) {
    const root = rootOf(entry.element);
    const rules = rulesByRoot.get(root) ?? [];
    rules.push(buildRule(entry.squintId, entry.text, entry.background));
    rulesByRoot.set(root, rules);
  }
  for (const [root, rules] of rulesByRoot) {
    getOrCreateStyleElementInRoot(root).textContent = rules.join('\n');
  }
}

export function removeFixes(): void {
  for (const style of injectedStyles) style.remove();
  injectedStyles.clear();
}

export function isApplied(): boolean {
  for (const style of injectedStyles) {
    if (style.isConnected) return true;
  }
  return false;
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
