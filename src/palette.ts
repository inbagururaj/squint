import type { RGB } from './types';
import { colorDistance } from './color-utils';

export interface PaletteEntry {
  color: RGB;
  count: number;
}

export function buildFrequencyMap(colors: RGB[]): Map<string, PaletteEntry> {
  const map = new Map<string, PaletteEntry>();
  for (const color of colors) {
    const key = `${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { color, count: 1 });
  }
  return map;
}

export function dedupeSimilarColors(entries: PaletteEntry[], threshold: number): PaletteEntry[] {
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const merged: PaletteEntry[] = [];
  for (const entry of sorted) {
    const match = merged.find((m) => colorDistance(m.color, entry.color) <= threshold);
    if (match) match.count += entry.count;
    else merged.push({ color: entry.color, count: entry.count });
  }
  return merged;
}

export function extractPalette(colors: RGB[], size: number, dedupeThreshold: number): PaletteEntry[] {
  const frequency = Array.from(buildFrequencyMap(colors).values());
  const deduped = dedupeSimilarColors(frequency, dedupeThreshold);
  return deduped.sort((a, b) => b.count - a.count).slice(0, size);
}
