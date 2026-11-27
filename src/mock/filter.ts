/*
 * MOCK ONLY. A throwaway approximation so sliders visibly change the photo.
 *
 * This is not the Kromskop pipeline and none of it should survive into the
 * engine. It bends an already-rendered sRGB preview with one tone table per
 * channel and a saturation scale, which is enough to make the page feel
 * alive. The maths is ordinary textbook material: the sRGB transfer function
 * (IEC 61966-2-1), a gain for exposure and white balance, and hand-made tone
 * bumps. The Colour Mixer has no effect here.
 */

import type { Params } from "../model/types";

export interface MockLook {
  /** Output level for each input level, 0 to 255, per channel. */
  red: Uint8ClampedArray;
  green: Uint8ClampedArray;
  blue: Uint8ClampedArray;
  /** 1 leaves saturation alone. */
  saturation: number;
  /** True when the look leaves the preview untouched. */
  identity: boolean;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const toEncoded = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Rolls bright values off toward 1 so added exposure does not clip flat. */
function shoulder(x: number): number {
  const knee = 0.72;
  if (x <= knee) return x;
  const span = 1 - knee;
  return knee + span * Math.tanh((x - knee) / span);
}

function toneCurve(y: number, p: Params): number {
  // Bumps centred on the lower and upper quarter tones.
  const lowWeight = 9.48 * y * Math.pow(1 - y, 3);
  const highWeight = 9.48 * Math.pow(y, 3) * (1 - y);
  y += (p.shadows / 100) * 0.16 * lowWeight;
  y += (p.highlights / 100) * 0.16 * highWeight;
  // End points.
  y += (p.whites / 100) * 0.12 * y * y;
  y += (p.blacks / 100) * 0.1 * Math.pow(1 - y, 4);
  y = clamp01(y);
  // Contrast pivots on mid grey.
  const c = p.contrast / 100;
  if (c > 0) {
    const s = y < 0.5 ? 2 * y * y : 1 - 2 * (1 - y) * (1 - y);
    y = y + (s - y) * c * 0.7;
  } else if (c < 0) {
    y = 0.5 + (y - 0.5) * (1 + c * 0.55);
  }
  return clamp01(y);
}

export function mockLook(params: Params, asShot: Params): MockLook {
  // White balance as gains from the mired shift against the as-shot value.
  const mired = 1e6 / asShot.temp - 1e6 / params.temp;
  const tint = params.tint - asShot.tint;
  let r = Math.exp(mired * 0.003);
  let g = Math.exp(-tint * 0.0016);
  let b = Math.exp(-mired * 0.0042);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r /= luma;
  g /= luma;
  b /= luma;

  const exposure = Math.pow(2, params.exposure);
  const table = (gain: number) => {
    const out = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      const linear = shoulderIfRaised(toLinear(i / 255) * exposure * gain, exposure * gain);
      out[i] = Math.round(toneCurve(clamp01(toEncoded(linear)), params) * 255);
    }
    return out;
  };

  const saturation = Math.max(0, 1 + params.saturation / 100 + (params.vibrance / 100) * 0.5);
  const identity =
    params.exposure === 0 &&
    params.contrast === 0 &&
    params.highlights === 0 &&
    params.shadows === 0 &&
    params.whites === 0 &&
    params.blacks === 0 &&
    params.temp === asShot.temp &&
    params.tint === asShot.tint &&
    saturation === 1;

  return { red: table(r), green: table(g), blue: table(b), saturation, identity };
}

function shoulderIfRaised(value: number, gain: number): number {
  return gain > 1 ? shoulder(value) : Math.min(1, value);
}

/** The table as an SVG feFunc tableValues string, sampled at 33 points. */
export function tableValues(table: Uint8ClampedArray): string {
  const points: string[] = [];
  for (let i = 0; i <= 32; i++) {
    const index = Math.round((i / 32) * 255);
    points.push(((table[index] ?? 0) / 255).toFixed(4));
  }
  return points.join(" ");
}
