import { useMemo } from "react";
import type { HistogramData } from "../model/types";
import { HISTOGRAM_VIEWBOX, histogramPath, histogramPeak } from "./histogramPath";
import styles from "./ToneCurve.module.css";

interface ToneCurveProps {
  /** False draws the straight line of an untouched photo. */
  shaped: boolean;
  histogram: HistogramData | null;
  disabled?: boolean;
}

/** Control points on a 0–100 square, input across and output up. */
const STRAIGHT: Array<[number, number]> = [
  [0, 0],
  [100, 100],
];
const GENTLE_S: Array<[number, number]> = [
  [0, 0],
  [24, 19],
  [50, 51],
  [77, 83],
  [100, 100],
];

/** A smooth line through the points (Catmull-Rom segments as cubic Béziers). */
function curvePath(points: Array<[number, number]>): string {
  const at = (i: number) => points[Math.min(points.length - 1, Math.max(0, i))]!;
  let d = `M${at(0)[0]},${100 - at(0)[1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${100 - c1[1]!} ${c2[0]},${100 - c2[1]!} ${p2[0]},${100 - p2[1]}`;
  }
  return d;
}

/** The tone curve. A still picture for now; editing comes with the engine. */
export function ToneCurve({ shaped, histogram, disabled = false }: ToneCurveProps) {
  const points = shaped ? GENTLE_S : STRAIGHT;
  const backdrop = useMemo(
    () => (histogram ? histogramPath(histogram.luma, histogramPeak(histogram.luma), true) : null),
    [histogram],
  );

  return (
    <div className={styles.curve} data-disabled={disabled || undefined}>
      {backdrop && (
        <svg className={styles.backdrop} viewBox={HISTOGRAM_VIEWBOX} preserveAspectRatio="none" aria-hidden="true">
          <path d={backdrop} />
        </svg>
      )}
      <svg className={styles.plot} viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Tone curve">
        <line className={styles.baseline} x1="0" y1="100" x2="100" y2="0" />
        {!disabled && <path className={styles.line} d={curvePath(points)} />}
      </svg>
      {!disabled &&
        points.slice(1, -1).map(([x, y]) => (
          <span key={x} className={styles.point} style={{ left: `${x}%`, top: `${100 - y}%` }} />
        ))}
    </div>
  );
}
