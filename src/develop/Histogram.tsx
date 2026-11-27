import { useMemo } from "react";
import { useSession } from "../session/Session";
import { usePrefs } from "../shell/Prefs";
import styles from "./Histogram.module.css";
import { HISTOGRAM_VIEWBOX, histogramPath, histogramPeak } from "./histogramPath";

/** Share of pixels at an end of the scale that counts as clipping. */
const CLIP_THRESHOLD = 0.002;

export function Histogram() {
  const { histogram, photo, status } = useSession();
  const { histogramChannels, setHistogramChannels } = usePrefs();

  const paths = useMemo(() => {
    if (!histogram) return null;
    const peak = histogramChannels
      ? histogramPeak(histogram.luma, histogram.red, histogram.green, histogram.blue)
      : histogramPeak(histogram.luma);
    return {
      luma: histogramPath(histogram.luma, peak, true),
      red: histogramPath(histogram.red, peak, false),
      green: histogramPath(histogram.green, peak, false),
      blue: histogramPath(histogram.blue, peak, false),
    };
  }, [histogram, histogramChannels]);

  const capture = status === "ready" && photo ? photo.capture : null;

  return (
    <section className={styles.histogram} aria-label="Histogram">
      <div className={styles.plot}>
        <svg className={styles.graph} viewBox={HISTOGRAM_VIEWBOX} preserveAspectRatio="none" aria-hidden="true">
          {paths && <path className={styles.luma} d={paths.luma} />}
          {paths && histogramChannels && (
            <>
              <path className={styles.channel} data-channel="red" d={paths.red} />
              <path className={styles.channel} data-channel="green" d={paths.green} />
              <path className={styles.channel} data-channel="blue" d={paths.blue} />
            </>
          )}
        </svg>
        <span
          className={styles.clip}
          data-end="low"
          data-on={(histogram && histogram.clippedLow > CLIP_THRESHOLD) || undefined}
          title="Shadow clipping"
        />
        <span
          className={styles.clip}
          data-end="high"
          data-on={(histogram && histogram.clippedHigh > CLIP_THRESHOLD) || undefined}
          title="Highlight clipping"
        />
      </div>

      <div className={styles.caption}>
        {capture ? (
          <span className={`${styles.capture} num`}>
            <span>{capture.iso}</span>
            <span>{capture.focalLength}</span>
            <span>{capture.aperture}</span>
            <span>{capture.shutter}</span>
          </span>
        ) : (
          <span className={styles.capture}>{status === "loading" ? "Waiting for the preview" : "No photo"}</span>
        )}
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={histogramChannels}
          disabled={!histogram}
          onClick={() => setHistogramChannels(!histogramChannels)}
          title="Show red, green and blue channels"
        >
          RGB
        </button>
      </div>
    </section>
  );
}
