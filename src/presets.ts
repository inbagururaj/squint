import type { RGB, PresetVariant } from './types';
import { contrastRatio, passesAA, relativeLuminance } from './contrast';
import { rgbToHsl, hslToRgb, clamp } from './color-utils';

export const DEFAULT_LIGHTNESS_CAP = 50;
const SEARCH_STEP = 0.5;

function lightenDirection(moving: RGB, fixed: RGB): 1 | -1 {
  return relativeLuminance(moving) >= relativeLuminance(fixed) ? 1 : -1;
}

function applyLightnessDelta(rgb: RGB, deltaL: number, direction: 1 | -1): RGB {
  const hsl = rgbToHsl(rgb);
  const newL = clamp(hsl.l + direction * deltaL, 0, 100);
  return hslToRgb(hsl.h, hsl.s, newL);
}

function findMinimalDelta(passes: (deltaL: number) => boolean, cap: number): number | null {
  for (let delta = SEARCH_STEP; delta <= cap; delta += SEARCH_STEP) {
    if (passes(delta)) return delta;
  }
  return null;
}

function computePresetA(text: RGB, background: RGB, large: boolean, cap: number): PresetVariant | null {
  const direction = lightenDirection(background, text);
  const delta = findMinimalDelta(
    (d) => passesAA(contrastRatio(text, applyLightnessDelta(background, d, direction)), large),
    cap,
  );
  if (delta === null) return null;
  const newBackground = applyLightnessDelta(background, delta, direction);
  return { presetId: 'A', background: newBackground, text, contrastRatio: contrastRatio(text, newBackground) };
}

function computePresetB(text: RGB, background: RGB, large: boolean, cap: number): PresetVariant | null {
  const direction = lightenDirection(text, background);
  const delta = findMinimalDelta(
    (d) => passesAA(contrastRatio(applyLightnessDelta(text, d, direction), background), large),
    cap,
  );
  if (delta === null) return null;
  const newText = applyLightnessDelta(text, delta, direction);
  return { presetId: 'B', background, text: newText, contrastRatio: contrastRatio(newText, background) };
}

function computePresetC(
  text: RGB,
  background: RGB,
  large: boolean,
  backgroundProminence: number,
  cap: number,
): PresetVariant | null {
  const bgDirection = lightenDirection(background, text);
  const textDirection = lightenDirection(text, background);
  const prominence = clamp(backgroundProminence, 0, 1);
  const backgroundShare = 2 * (1 - prominence);
  const textShare = 2 * prominence;

  const delta = findMinimalDelta((t) => {
    const newBackground = applyLightnessDelta(background, Math.min(cap, t * backgroundShare), bgDirection);
    const newText = applyLightnessDelta(text, Math.min(cap, t * textShare), textDirection);
    return passesAA(contrastRatio(newText, newBackground), large);
  }, cap);
  if (delta === null) return null;

  const newBackground = applyLightnessDelta(background, Math.min(cap, delta * backgroundShare), bgDirection);
  const newText = applyLightnessDelta(text, Math.min(cap, delta * textShare), textDirection);
  return { presetId: 'C', background: newBackground, text: newText, contrastRatio: contrastRatio(newText, newBackground) };
}

export function computePresets(
  text: RGB,
  background: RGB,
  large: boolean,
  backgroundProminence: number,
  cap: number = DEFAULT_LIGHTNESS_CAP,
): PresetVariant[] {
  const variants = [
    computePresetA(text, background, large, cap),
    computePresetB(text, background, large, cap),
    computePresetC(text, background, large, backgroundProminence, cap),
  ];
  return variants.filter((v): v is PresetVariant => v !== null);
}
