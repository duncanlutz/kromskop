/*
 * MOCK ONLY. Counts tonal levels of the displayed preview by running the
 * mock look over a small copy of it. The engine will report real histograms.
 */

import type { HistogramData } from "../model/types";
import type { MockLook } from "./filter";

const LONG_EDGE = 224;
const cache = new Map<string, Promise<ImageData>>();

/** A small copy of a preview's pixels, decoded once per image. */
export function loadPixels(url: string): Promise<ImageData> {
  let pending = cache.get(url);
  if (!pending) {
    pending = new Promise<ImageData>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        const scale = LONG_EDGE / Math.max(image.naturalWidth, image.naturalHeight);
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return reject(new Error("No 2D canvas"));
        context.drawImage(image, 0, 0, width, height);
        resolve(context.getImageData(0, 0, width, height));
      };
      image.onerror = () => reject(new Error(`Could not load ${url}`));
      image.src = url;
    });
    cache.set(url, pending);
  }
  return pending;
}

export function countLevels(pixels: ImageData, look: MockLook): HistogramData {
  const luma = new Uint32Array(256);
  const red = new Uint32Array(256);
  const green = new Uint32Array(256);
  const blue = new Uint32Array(256);
  const data = pixels.data;
  const s = look.saturation;
  let low = 0;
  let high = 0;
  const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

  for (let i = 0; i < data.length; i += 4) {
    let r: number = look.red[data[i]!]!;
    let g: number = look.green[data[i + 1]!]!;
    let b: number = look.blue[data[i + 2]!]!;
    if (s !== 1) {
      // Same weights as the SVG "saturate" colour matrix.
      const grey = 0.213 * r + 0.715 * g + 0.072 * b;
      r = clampByte(grey + (r - grey) * s);
      g = clampByte(grey + (g - grey) * s);
      b = clampByte(grey + (b - grey) * s);
    }
    const y = clampByte(0.2126 * r + 0.7152 * g + 0.0722 * b);
    red[r]!++;
    green[g]!++;
    blue[b]!++;
    luma[y]!++;
    if (r <= 1 && g <= 1 && b <= 1) low++;
    if (r >= 254 && g >= 254 && b >= 254) high++;
  }

  const total = data.length / 4;
  return { luma, red, green, blue, clippedLow: low / total, clippedHigh: high / total };
}
