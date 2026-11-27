/** Drawing helpers for histograms. Pure geometry; no image processing. */

const WIDTH = 256;
const HEIGHT = 100;

export const HISTOGRAM_VIEWBOX = `0 0 ${WIDTH} ${HEIGHT}`;

/** Evens out the comb that 8-bit tone tables leave between neighbouring levels. */
function smooth(bins: Uint32Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < bins.length; i++) {
    const a = bins[Math.max(0, i - 2)] ?? 0;
    const b = bins[Math.max(0, i - 1)] ?? 0;
    const c = bins[i] ?? 0;
    const d = bins[Math.min(bins.length - 1, i + 1)] ?? 0;
    const e = bins[Math.min(bins.length - 1, i + 2)] ?? 0;
    out.push((a + 2 * b + 3 * c + 2 * d + e) / 9);
  }
  return out;
}

/** The tallest interior level, so a clipped end does not flatten the rest. */
export function histogramPeak(...channels: Uint32Array[]): number {
  let peak = 1;
  for (const bins of channels) {
    const values = smooth(bins);
    for (let i = 3; i < values.length - 3; i++) peak = Math.max(peak, values[i] ?? 0);
  }
  return peak;
}

/** An SVG path for one channel. Closed for a filled shape, open for a line. */
export function histogramPath(bins: Uint32Array, peak: number, closed: boolean): string {
  const values = smooth(bins);
  const points = values.map((value, i) => {
    const height = Math.min(1, Math.pow(value / peak, 0.8));
    return `${i + 0.5},${(HEIGHT - height * (HEIGHT - 2)).toFixed(1)}`;
  });
  return closed ? `M0,${HEIGHT} L${points.join(" L")} L${WIDTH},${HEIGHT} Z` : `M${points.join(" L")}`;
}
