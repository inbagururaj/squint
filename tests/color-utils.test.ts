import { describe, it, expect } from 'vitest';
import { parseCssColor, rgbToHsl, hslToRgb, colorDistance, rgbToCssString } from '../src/color-utils';

describe('parseCssColor', () => {
  it('parses hex', () => {
    expect(parseCssColor('#ff0000')).toEqual({ rgb: { r: 255, g: 0, b: 0 }, alpha: 1 });
  });

  it('parses shorthand hex', () => {
    expect(parseCssColor('#f00')).toEqual({ rgb: { r: 255, g: 0, b: 0 }, alpha: 1 });
  });

  it('parses rgb()', () => {
    expect(parseCssColor('rgb(10, 20, 30)')).toEqual({ rgb: { r: 10, g: 20, b: 30 }, alpha: 1 });
  });

  it('parses rgba() with alpha', () => {
    expect(parseCssColor('rgba(0, 0, 0, 0)')).toEqual({ rgb: { r: 0, g: 0, b: 0 }, alpha: 0 });
  });

  it('parses transparent keyword', () => {
    expect(parseCssColor('transparent')?.alpha).toBe(0);
  });

  it('parses hsl()', () => {
    expect(parseCssColor('hsl(0, 100%, 50%)')?.rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for garbage input', () => {
    expect(parseCssColor('not-a-color')).toBeNull();
  });
});

describe('rgbToHsl / hslToRgb', () => {
  it('converts pure red correctly', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
  });

  it('round trips within rounding error', () => {
    const original = { r: 120, g: 180, b: 60 };
    const hsl = rgbToHsl(original);
    const back = hslToRgb(hsl.h, hsl.s, hsl.l);
    expect(Math.abs(back.r - original.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.g - original.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.b - original.b)).toBeLessThanOrEqual(1);
  });

  it('clamps lightness above 100 to white', () => {
    expect(hslToRgb(0, 100, 150)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('colorDistance', () => {
  it('is zero for identical colors', () => {
    expect(colorDistance({ r: 1, g: 2, b: 3 }, { r: 1, g: 2, b: 3 })).toBe(0);
  });

  it('measures euclidean distance', () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 3, g: 4, b: 0 })).toBe(5);
  });
});

describe('rgbToCssString', () => {
  it('formats as rgb()', () => {
    expect(rgbToCssString({ r: 1, g: 2, b: 3 })).toBe('rgb(1, 2, 3)');
  });
});
