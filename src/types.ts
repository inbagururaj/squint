export const SQUINT_ID_ATTR = 'data-squint-id';
export const SQUINT_SIMPLIFY_ID_ATTR = 'data-squint-simplify-id';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ScannedElement {
  squintId: number;
  element: HTMLElement;
  text: RGB;
  background: RGB;
  paletteBackground: RGB | null;
  fontSizePx: number;
  fontWeight: number;
}

export type PresetId = 'A' | 'B' | 'C';

export interface PresetVariant {
  presetId: PresetId;
  background: RGB;
  text: RGB;
  contrastRatio: number;
}

export interface FailingElement {
  squintId: number;
  variants: PresetVariant[];
}

export interface PresetSample {
  text: RGB;
  background: RGB;
}

export interface ScanSummary {
  totalScanned: number;
  totalFailing: number;
  presets: Record<PresetId, { label: string; fixableCount: number; sample: PresetSample | null }>;
}

export type SimplifyKind = 'marquee' | 'small-image' | 'small-animated' | 'rare-font' | 'large-background';

export interface SimplifyEntry {
  squintId: number;
  kind: SimplifyKind;
  // Present when kind === 'rare-font': the dominant weight to normalize toward.
  fontWeight?: number;
}

export interface SimplifySummary {
  totalFlagged: number;
  counts: Record<SimplifyKind, number>;
}

export type ContentMessage =
  | { type: 'SQUINT_SCAN_REQUEST' }
  | { type: 'SQUINT_APPLY_PRESET'; presetId: PresetId }
  | { type: 'SQUINT_REMOVE_FIXES' }
  | { type: 'SQUINT_STATUS_REQUEST' }
  | { type: 'SQUINT_SIMPLIFY_SCAN_REQUEST' }
  | { type: 'SQUINT_SIMPLIFY_APPLY' }
  | { type: 'SQUINT_SIMPLIFY_REMOVE' }
  | { type: 'SQUINT_SIMPLIFY_STATUS_REQUEST' };

export type ContentResponse =
  | { type: 'SQUINT_SCAN_RESULT'; summary: ScanSummary }
  | { type: 'SQUINT_APPLY_RESULT'; appliedCount: number }
  | { type: 'SQUINT_REMOVE_RESULT' }
  | { type: 'SQUINT_STATUS_RESULT'; applied: boolean }
  | { type: 'SQUINT_SIMPLIFY_SCAN_RESULT'; summary: SimplifySummary }
  | { type: 'SQUINT_SIMPLIFY_APPLY_RESULT'; appliedCount: number }
  | { type: 'SQUINT_SIMPLIFY_REMOVE_RESULT' }
  | { type: 'SQUINT_SIMPLIFY_STATUS_RESULT'; applied: boolean };
