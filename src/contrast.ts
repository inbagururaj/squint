import type { RGB } from './types';

export const AA_NORMAL_TEXT_RATIO = 4.5;
export const AA_LARGE_TEXT_RATIO = 3.0;

const LARGE_TEXT_MIN_SIZE_PX = 24;
const LARGE_TEXT_BOLD_MIN_SIZE_PX = 18.67;
const BOLD_WEIGHT_THRESHOLD = 700;

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: RGB): number {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  if (fontSizePx >= LARGE_TEXT_MIN_SIZE_PX) return true;
  return fontWeight >= BOLD_WEIGHT_THRESHOLD && fontSizePx >= LARGE_TEXT_BOLD_MIN_SIZE_PX;
}

export function requiredContrastRatio(large: boolean): number {
  return large ? AA_LARGE_TEXT_RATIO : AA_NORMAL_TEXT_RATIO;
}

export function passesAA(ratio: number, large: boolean): boolean {
  return ratio >= requiredContrastRatio(large);
}
