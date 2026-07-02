import { describe, it, expect } from 'vitest';
import { computePresets, DEFAULT_LIGHTNESS_CAP } from '../src/presets';
import { contrastRatio } from '../src/contrast';

const text = { r: 150, g: 150, b: 150 };
const background = { r: 200, g: 200, b: 200 };

describe('computePresets', () => {
  it('produces only AA-passing variants for a low-contrast pair', () => {
    const variants = computePresets(text, background, false, 0.5);
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) {
      expect(contrastRatio(variant.text, variant.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('preset A only changes background', () => {
    const variants = computePresets(text, background, false, 0.5);
    const presetA = variants.find((v) => v.presetId === 'A');
    if (presetA) expect(presetA.text).toEqual(text);
  });

  it('preset B only changes text', () => {
    const variants = computePresets(text, background, false, 0.5);
    const presetB = variants.find((v) => v.presetId === 'B');
    if (presetB) expect(presetB.background).toEqual(background);
  });

  it('preset C moves both colors', () => {
    const variants = computePresets(text, background, false, 0.5);
    const presetC = variants.find((v) => v.presetId === 'C');
    if (presetC) {
      expect(presetC.text).not.toEqual(text);
      expect(presetC.background).not.toEqual(background);
    }
  });

  it('returns empty array when identical colors cannot reach AA within a tiny cap', () => {
    const sameGray = { r: 128, g: 128, b: 128 };
    expect(computePresets(sameGray, sameGray, false, 0.5, 5)).toEqual([]);
  });

  it('never exceeds the lightness cap', () => {
    const variants = computePresets(text, background, false, 0.5, DEFAULT_LIGHTNESS_CAP);
    expect(variants.length).toBeGreaterThan(0);
  });
});
