import { describe, it, expect } from 'vitest';
import { containsImageContent, collectElementsDeep } from '../src/dom-scanner';

// These run in vitest's default node environment (no jsdom is installed and
// CONSTRAINTS forbids adding one), so the DOM surface each helper touches is
// duck-typed with minimal stubs. The real-DOM / real-shadow-root integration
// path is covered by the manual Chrome steps in TESTPLAN.md.

function fakeElement(tagName: string, descendantImage: boolean): Element {
  return {
    tagName,
    querySelector: (_selector: string) => (descendantImage ? ({} as Element) : null),
  } as unknown as Element;
}

describe('containsImageContent (Task 1 — never fix an element wrapping an image)', () => {
  it('flags an <img> element itself', () => {
    expect(containsImageContent(fakeElement('IMG', false))).toBe(true);
  });

  it('flags a <picture> element itself', () => {
    expect(containsImageContent(fakeElement('PICTURE', false))).toBe(true);
  });

  it('flags an element that wraps a real <img>', () => {
    expect(containsImageContent(fakeElement('A', true))).toBe(true);
  });

  it('does not flag a plain text element with no image descendant', () => {
    expect(containsImageContent(fakeElement('P', false))).toBe(false);
  });
});

interface FakeNode {
  querySelectorAll: (selector: string) => FakeNode[];
  shadowRoot?: FakeNode | null;
}

function fakeNode(children: FakeNode[], shadowRoot: FakeNode | null = null): FakeNode {
  return { querySelectorAll: () => children, shadowRoot };
}

describe('collectElementsDeep (Task 2 — pierce open shadow roots)', () => {
  it('returns light-DOM elements', () => {
    const a = fakeNode([]);
    const b = fakeNode([]);
    const root = fakeNode([a, b]) as unknown as ParentNode;
    expect(collectElementsDeep(root)).toEqual([a, b]);
  });

  it('descends into an open shadow root', () => {
    const shadowChild = fakeNode([]);
    const shadowRoot = fakeNode([shadowChild]);
    const host = fakeNode([], shadowRoot);
    const root = fakeNode([host]) as unknown as ParentNode;
    // host is visited, then its shadow root is pierced to reach shadowChild.
    expect(collectElementsDeep(root)).toEqual([host, shadowChild]);
  });

  it('skips closed/absent shadow roots (shadowRoot === null)', () => {
    const host = fakeNode([], null);
    const root = fakeNode([host]) as unknown as ParentNode;
    expect(collectElementsDeep(root)).toEqual([host]);
  });

  it('recurses through nested shadow roots', () => {
    const deepChild = fakeNode([]);
    const innerShadow = fakeNode([deepChild]);
    const innerHost = fakeNode([], innerShadow);
    const outerShadow = fakeNode([innerHost]);
    const outerHost = fakeNode([], outerShadow);
    const root = fakeNode([outerHost]) as unknown as ParentNode;
    expect(collectElementsDeep(root)).toEqual([outerHost, innerHost, deepChild]);
  });
});
