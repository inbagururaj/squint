// 50x50px — below this, images read as icons/spacers rather than content.
export const SMALL_IMAGE_AREA_PX2 = 2500;
// 100x100px — animated media draws more attention than a static image of the same
// footprint, so it gets a larger allowance before being flagged.
export const SMALL_ANIMATED_AREA_PX2 = 10000;
// 200x200px — hero/banner-sized background-images are flagged for flattening;
// small ones (badges, texture swatches) are left alone.
export const LARGE_BACKGROUND_AREA_PX2 = 40000;
// Combos used <=15% as often as the page's dominant font combo are flagged as rare.
export const RARE_FONT_FREQUENCY_RATIO = 0.15;

export interface ImageDescriptor {
  tagName: string;
  widthPx: number;
  heightPx: number;
  isLinked: boolean;
  src: string;
}

export interface BackgroundDescriptor {
  widthPx: number;
  heightPx: number;
  hasBackgroundImage: boolean;
}

export interface FontSample {
  fontFamily: string;
  fontWeight: number;
  textDecorationLine: string;
}

function elementArea(widthPx: number, heightPx: number): number {
  return Math.max(0, widthPx) * Math.max(0, heightPx);
}

function isImageTag(tagName: string): boolean {
  const tag = tagName.toUpperCase();
  return tag === 'IMG' || tag === 'PICTURE';
}

function hasAnimatedExtension(src: string): boolean {
  return /\.(gif|apng)(\?.*)?(#.*)?$/i.test(src);
}

export function isMarqueeElement(tagName: string): boolean {
  return tagName.toUpperCase() === 'MARQUEE';
}

export function isSmallNonLinkedImage(descriptor: ImageDescriptor): boolean {
  if (descriptor.isLinked) return false;
  if (!isImageTag(descriptor.tagName)) return false;
  return elementArea(descriptor.widthPx, descriptor.heightPx) <= SMALL_IMAGE_AREA_PX2;
}

export function isSmallAnimatedElement(descriptor: ImageDescriptor): boolean {
  if (!isImageTag(descriptor.tagName)) return false;
  if (!hasAnimatedExtension(descriptor.src)) return false;
  return elementArea(descriptor.widthPx, descriptor.heightPx) <= SMALL_ANIMATED_AREA_PX2;
}

export function isLargeBackgroundImageElement(descriptor: BackgroundDescriptor): boolean {
  if (!descriptor.hasBackgroundImage) return false;
  return elementArea(descriptor.widthPx, descriptor.heightPx) >= LARGE_BACKGROUND_AREA_PX2;
}

export function fontSignature(fontFamily: string, fontWeight: number, textDecorationLine: string): string {
  return `${fontFamily.trim().toLowerCase()}|${fontWeight}|${textDecorationLine.trim().toLowerCase()}`;
}

export function buildFontFrequencyMap(samples: FontSample[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const sample of samples) {
    const sig = fontSignature(sample.fontFamily, sample.fontWeight, sample.textDecorationLine);
    map.set(sig, (map.get(sig) ?? 0) + 1);
  }
  return map;
}

export function findDominantFontSignature(frequency: Map<string, number>): string | null {
  let dominant: string | null = null;
  let max = 0;
  for (const [sig, count] of frequency) {
    if (count > max) {
      max = count;
      dominant = sig;
    }
  }
  return dominant;
}

export function isRareFontSample(
  sample: FontSample,
  frequency: Map<string, number>,
  dominantSignature: string | null,
  ratioThreshold: number = RARE_FONT_FREQUENCY_RATIO,
): boolean {
  if (dominantSignature === null) return false;
  const sig = fontSignature(sample.fontFamily, sample.fontWeight, sample.textDecorationLine);
  if (sig === dominantSignature) return false;
  const dominantCount = frequency.get(dominantSignature) ?? 0;
  if (dominantCount === 0) return false;
  const sampleCount = frequency.get(sig) ?? 0;
  return sampleCount / dominantCount <= ratioThreshold;
}

export function dominantFontWeight(samples: FontSample[], dominantSignature: string | null): number {
  if (dominantSignature === null) return 400;
  const match = samples.find(
    (s) => fontSignature(s.fontFamily, s.fontWeight, s.textDecorationLine) === dominantSignature,
  );
  return match ? match.fontWeight : 400;
}
