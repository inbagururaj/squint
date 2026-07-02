import type { RGB } from './types';

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface ParsedColor {
  rgb: RGB;
  alpha: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-f]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbFunctionToParsedColor(input: string): ParsedColor | null {
  const match = input.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i,
  );
  if (!match) return null;
  return {
    rgb: { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) },
    alpha: match[4] !== undefined ? Number(match[4]) : 1,
  };
}

function hslFunctionToParsedColor(input: string): ParsedColor | null {
  const match = input.match(
    /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)/i,
  );
  if (!match) return null;
  return {
    rgb: hslToRgb(Number(match[1]), Number(match[2]), Number(match[3])),
    alpha: match[4] !== undefined ? Number(match[4]) : 1,
  };
}

export function parseCssColor(input: string): ParsedColor | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === 'transparent') return { rgb: { r: 0, g: 0, b: 0 }, alpha: 0 };
  if (trimmed.startsWith('#')) {
    const rgb = hexToRgb(trimmed);
    return rgb ? { rgb, alpha: 1 } : null;
  }
  if (trimmed.startsWith('rgb')) return rgbFunctionToParsedColor(trimmed);
  if (trimmed.startsWith('hsl')) return hslFunctionToParsedColor(trimmed);
  return null;
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;

  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;

  if (ss === 0) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v };
  }

  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hue2rgb = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  return {
    r: Math.round(hue2rgb(hh + 1 / 3) * 255),
    g: Math.round(hue2rgb(hh) * 255),
    b: Math.round(hue2rgb(hh - 1 / 3) * 255),
  };
}

export function rgbToCssString(rgb: RGB): string {
  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}

export function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}
