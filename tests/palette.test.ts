import { describe, it, expect } from 'vitest';
import { buildFrequencyMap, dedupeSimilarColors, extractPalette } from '../src/palette';

describe('buildFrequencyMap', () => {
  it('counts occurrences of identical colors', () => {
    const map = buildFrequencyMap([
      { r: 1, g: 1, b: 1 },
      { r: 1, g: 1, b: 1 },
      { r: 2, g: 2, b: 2 },
    ]);
    expect(map.get('1,1,1')?.count).toBe(2);
    expect(map.get('2,2,2')?.count).toBe(1);
  });
});

describe('dedupeSimilarColors', () => {
  it('merges colors within threshold', () => {
    const entries = [
      { color: { r: 0, g: 0, b: 0 }, count: 5 },
      { color: { r: 2, g: 2, b: 2 }, count: 3 },
    ];
    const merged = dedupeSimilarColors(entries, 10);
    expect(merged).toHaveLength(1);
    expect(merged[0].count).toBe(8);
  });

  it('keeps distinct colors beyond threshold', () => {
    const entries = [
      { color: { r: 0, g: 0, b: 0 }, count: 5 },
      { color: { r: 200, g: 200, b: 200 }, count: 3 },
    ];
    const merged = dedupeSimilarColors(entries, 10);
    expect(merged).toHaveLength(2);
  });
});

describe('extractPalette', () => {
  it('returns top N most frequent colors sorted descending', () => {
    const colors = [
      { r: 0, g: 0, b: 0 },
      { r: 0, g: 0, b: 0 },
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 255, b: 255 },
      { r: 100, g: 100, b: 100 },
    ];
    const palette = extractPalette(colors, 2, 5);
    expect(palette).toHaveLength(2);
    expect(palette[0].color).toEqual({ r: 0, g: 0, b: 0 });
    expect(palette[1].color).toEqual({ r: 255, g: 255, b: 255 });
  });
});
