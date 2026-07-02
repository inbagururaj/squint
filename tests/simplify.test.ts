import { describe, it, expect } from 'vitest';
import {
  isMarqueeElement,
  isSmallNonLinkedImage,
  isSmallAnimatedElement,
  isLargeBackgroundImageElement,
  fontSignature,
  buildFontFrequencyMap,
  findDominantFontSignature,
  isRareFontSample,
  dominantFontWeight,
  SMALL_IMAGE_AREA_PX2,
  SMALL_ANIMATED_AREA_PX2,
  LARGE_BACKGROUND_AREA_PX2,
} from '../src/simplify';

describe('isMarqueeElement', () => {
  it('matches MARQUEE regardless of case', () => {
    expect(isMarqueeElement('MARQUEE')).toBe(true);
    expect(isMarqueeElement('marquee')).toBe(true);
  });

  it('rejects other tags', () => {
    expect(isMarqueeElement('DIV')).toBe(false);
  });
});

describe('isSmallNonLinkedImage', () => {
  it('flags small unlinked images', () => {
    expect(
      isSmallNonLinkedImage({ tagName: 'IMG', widthPx: 40, heightPx: 40, isLinked: false, src: 'a.png' }),
    ).toBe(true);
  });

  it('ignores linked images', () => {
    expect(
      isSmallNonLinkedImage({ tagName: 'IMG', widthPx: 40, heightPx: 40, isLinked: true, src: 'a.png' }),
    ).toBe(false);
  });

  it('ignores images above the area threshold', () => {
    const side = Math.sqrt(SMALL_IMAGE_AREA_PX2) + 10;
    expect(
      isSmallNonLinkedImage({ tagName: 'IMG', widthPx: side, heightPx: side, isLinked: false, src: 'a.png' }),
    ).toBe(false);
  });

  it('ignores non-image tags', () => {
    expect(
      isSmallNonLinkedImage({ tagName: 'DIV', widthPx: 10, heightPx: 10, isLinked: false, src: '' }),
    ).toBe(false);
  });
});

describe('isSmallAnimatedElement', () => {
  it('flags small gif images', () => {
    expect(
      isSmallAnimatedElement({ tagName: 'IMG', widthPx: 50, heightPx: 50, isLinked: false, src: 'a.gif' }),
    ).toBe(true);
  });

  it('flags gif with query string', () => {
    expect(
      isSmallAnimatedElement({
        tagName: 'IMG',
        widthPx: 50,
        heightPx: 50,
        isLinked: false,
        src: 'a.gif?v=2',
      }),
    ).toBe(true);
  });

  it('ignores non-animated extensions', () => {
    expect(
      isSmallAnimatedElement({ tagName: 'IMG', widthPx: 50, heightPx: 50, isLinked: false, src: 'a.png' }),
    ).toBe(false);
  });

  it('ignores gifs above the animated area threshold', () => {
    const side = Math.sqrt(SMALL_ANIMATED_AREA_PX2) + 10;
    expect(
      isSmallAnimatedElement({ tagName: 'IMG', widthPx: side, heightPx: side, isLinked: false, src: 'a.gif' }),
    ).toBe(false);
  });
});

describe('isLargeBackgroundImageElement', () => {
  it('flags large elements with a background-image', () => {
    const side = Math.sqrt(LARGE_BACKGROUND_AREA_PX2) + 10;
    expect(isLargeBackgroundImageElement({ widthPx: side, heightPx: side, hasBackgroundImage: true })).toBe(
      true,
    );
  });

  it('ignores small elements even with a background-image', () => {
    expect(isLargeBackgroundImageElement({ widthPx: 50, heightPx: 50, hasBackgroundImage: true })).toBe(false);
  });

  it('ignores large elements without a background-image', () => {
    const side = Math.sqrt(LARGE_BACKGROUND_AREA_PX2) + 10;
    expect(isLargeBackgroundImageElement({ widthPx: side, heightPx: side, hasBackgroundImage: false })).toBe(
      false,
    );
  });
});

describe('fontSignature', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(fontSignature(' Arial ', 400, 'none')).toBe(fontSignature('arial', 400, 'NONE'));
  });

  it('differs when weight differs', () => {
    expect(fontSignature('Arial', 400, 'none')).not.toBe(fontSignature('Arial', 700, 'none'));
  });
});

describe('buildFontFrequencyMap / findDominantFontSignature', () => {
  it('finds the most frequent combo', () => {
    const samples = [
      { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
      { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
      { fontFamily: 'Comic Sans MS', fontWeight: 700, textDecorationLine: 'underline' },
    ];
    const frequency = buildFontFrequencyMap(samples);
    expect(findDominantFontSignature(frequency)).toBe(fontSignature('Arial', 400, 'none'));
  });

  it('returns null for no samples', () => {
    expect(findDominantFontSignature(buildFontFrequencyMap([]))).toBeNull();
  });
});

describe('isRareFontSample', () => {
  const samples = [
    { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
    { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
    { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
    { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
    { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
    { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
    { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
    { fontFamily: 'Comic Sans MS', fontWeight: 700, textDecorationLine: 'underline' },
  ];
  const frequency = buildFontFrequencyMap(samples);
  const dominant = findDominantFontSignature(frequency);

  it('flags a combo far less frequent than the dominant one', () => {
    expect(isRareFontSample(samples[7], frequency, dominant)).toBe(true);
  });

  it('does not flag the dominant combo itself', () => {
    expect(isRareFontSample(samples[0], frequency, dominant)).toBe(false);
  });

  it('returns false when there is no dominant signature', () => {
    expect(isRareFontSample(samples[0], new Map(), null)).toBe(false);
  });
});

describe('dominantFontWeight', () => {
  it('returns the weight belonging to the dominant signature', () => {
    const samples = [
      { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
      { fontFamily: 'Arial', fontWeight: 400, textDecorationLine: 'none' },
      { fontFamily: 'Georgia', fontWeight: 700, textDecorationLine: 'none' },
    ];
    const frequency = buildFontFrequencyMap(samples);
    const dominant = findDominantFontSignature(frequency);
    expect(dominantFontWeight(samples, dominant)).toBe(400);
  });

  it('defaults to 400 when there is no dominant signature', () => {
    expect(dominantFontWeight([], null)).toBe(400);
  });
});
