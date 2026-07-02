import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, isLargeText, passesAA } from '../src/contrast';

describe('relativeLuminance', () => {
  it('white is 1, black is 0', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0);
  });
});

describe('contrastRatio', () => {
  it('black on white is 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0);
  });

  it('same color is 1:1', () => {
    expect(contrastRatio({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 })).toBeCloseTo(1);
  });

  it('is symmetric regardless of argument order', () => {
    const a = { r: 10, g: 200, b: 30 };
    const b = { r: 240, g: 20, b: 90 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a));
  });
});

describe('isLargeText', () => {
  it('24px normal weight is large', () => {
    expect(isLargeText(24, 400)).toBe(true);
  });

  it('18.67px bold is large', () => {
    expect(isLargeText(18.67, 700)).toBe(true);
  });

  it('16px normal is not large', () => {
    expect(isLargeText(16, 400)).toBe(false);
  });

  it('18px bold is not large (below bold threshold)', () => {
    expect(isLargeText(18, 700)).toBe(false);
  });
});

describe('passesAA', () => {
  it('4.5 passes normal text threshold', () => {
    expect(passesAA(4.5, false)).toBe(true);
  });

  it('4.49 fails normal text threshold', () => {
    expect(passesAA(4.49, false)).toBe(false);
  });

  it('3.0 passes large text threshold', () => {
    expect(passesAA(3.0, true)).toBe(true);
  });
});
