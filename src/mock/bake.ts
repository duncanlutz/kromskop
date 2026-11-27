/*
 * MOCK ONLY. Runs the mock look over a whole preview once and keeps the
 * result, so Compare can zoom and pan several versions without filtering
 * them again on every frame. The engine will hand over rendered pixels.
 */

import type { MockLook } from "./filter";

const images = new Map<string, Promise<HTMLImageElement>>();
const baked = new Map<string, Promise<ImageBitmap>>();
/** Six versions of two photos; older results are dropped to bound memory. */
const KEEP = 12;
let queue: Promise<unknown> = Promise.resolve();

function loadImage(url: string): Promise<HTMLImageElement> {
  let pending = images.get(url);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${url}`));
      image.src = url;
    });
    images.set(url, pending);
  }
  return pending;
}

async function bake(url: string, look: MockLook): Promise<ImageBitmap> {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No 2D canvas");
  context.drawImage(image, 0, 0);

  if (!look.identity) {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    const { red, green, blue, saturation: s } = look;
    for (let i = 0; i < data.length; i += 4) {
      let r: number = red[data[i]!]!;
      let g: number = green[data[i + 1]!]!;
      let b: number = blue[data[i + 2]!]!;
      if (s !== 1) {
        // Same weights as the SVG "saturate" matrix the Develop preview uses.
        const grey = 0.213 * r + 0.715 * g + 0.072 * b;
        r = grey + (r - grey) * s;
        g = grey + (g - grey) * s;
        b = grey + (b - grey) * s;
      }
      // The array clamps and rounds on assignment.
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
    context.putImageData(pixels, 0, 0);
  }
  return createImageBitmap(canvas);
}

/** The preview with the look applied. `key` must change whenever the look does. */
export function bakedPreview(url: string, key: string, look: MockLook): Promise<ImageBitmap> {
  const id = `${url}|${key}`;
  let pending = baked.get(id);
  if (!pending) {
    // One at a time, yielding between them, so the page stays responsive.
    const job = queue.then(() => new Promise((resolve) => setTimeout(resolve, 0))).then(() => bake(url, look));
    queue = job.catch(() => undefined);
    pending = job;
    baked.set(id, pending);
    if (baked.size > KEEP) {
      const oldest = baked.keys().next().value;
      if (oldest !== undefined) baked.delete(oldest);
    }
  }
  return pending;
}
