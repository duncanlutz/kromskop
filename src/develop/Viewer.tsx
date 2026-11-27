import { isOriginal } from "../model/types";
import { useSession } from "../session/Session";
import { usePrefs } from "../shell/Prefs";
import { useElementSize } from "../ui/useElementSize";
import { EmptyState } from "./EmptyState";
import styles from "./Viewer.module.css";

/** Clear surround kept on every side of the photo. */
const MARGIN = 32;
/** Room under the loading frame for its caption. */
const LOADING_CAPTION = 44;

function fit(space: { width: number; height: number }, photo: { width: number; height: number }, reserve = 0) {
  const width = Math.max(0, space.width - MARGIN * 2);
  const height = Math.max(0, space.height - MARGIN * 2 - reserve);
  const scale = Math.min(width / photo.width, height / photo.height);
  return { width: Math.round(photo.width * scale), height: Math.round(photo.height * scale), scale };
}

/**
 * The photo on its surround. Square corners, no shadow, and nothing drawn
 * over the pixels; everything about the photo is written in the line below.
 */
export function Viewer() {
  const { status, shoot, photo, version, progress, Preview } = useSession();
  const { surround } = usePrefs();
  const [stage, space] = useElementSize<HTMLDivElement>();

  const loading = status === "loading";
  const size = photo && space.width > 0 ? fit(space, photo, loading ? LOADING_CAPTION : 0) : null;
  const original = photo?.versions[0];
  // Zoom is in screen pixels per photo pixel, as a photographer expects.
  const zoom = size ? Math.round(size.scale * window.devicePixelRatio * 100) : null;
  const picked = !!photo && !!version && photo.pickId === version.id;

  return (
    <section className={styles.viewer} aria-label="Photo">
      <div
        ref={stage}
        className={styles.stage}
        // With no photo there is nothing to judge, so the surround rests at its default.
        style={{ background: status === "empty" ? undefined : surround.colour }}
        data-tone={status !== "empty" && (surround.id === "assess" || surround.id === "white") ? "light" : "dark"}
      >
        {status === "empty" && <EmptyState />}

        {loading && photo && size && progress && (
          <div className={styles.loading}>
            <div className={styles.frame} style={{ width: size.width, height: size.height }} />
            <div className={styles.loadingCaption} style={{ width: size.width }}>
              <span>Opening {shoot?.name}</span>
              <span className="num">
                {progress.done} of {progress.total} previews
              </span>
              <span
                className={styles.progress}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
              >
                <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </span>
            </div>
          </div>
        )}

        {status === "ready" && photo && version && original && size && (
          <Preview
            className={surround.frame ? `${styles.photo} ${styles.framed}` : styles.photo}
            photo={photo}
            version={version}
            alt={`${photo.fileName}, ${version.name}`}
            style={{ width: size.width, height: size.height }}
          />
        )}
      </div>

      <footer className={styles.info}>
        {status === "ready" && photo && version && (
          <>
            <span className={styles.file}>{photo.fileName}</span>
            <span className={styles.version}>
              {!isOriginal(version) && <span className={styles.letter}>{version.letter}</span>}
              {version.name}
            </span>
            {picked && <span className={styles.pick}>Pick</span>}
            <span className={styles.spacer} />
            <span className={`${styles.dimensions} num`}>
              {photo.width} × {photo.height}
            </span>
            <span className={`${styles.zoom} num`}>
              <span>Fit</span>
              {zoom}%
            </span>
          </>
        )}
        {loading && photo && <span className={styles.file}>{photo.fileName}</span>}
      </footer>
    </section>
  );
}
