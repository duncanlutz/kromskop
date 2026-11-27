import { MockPreview } from "../mock/MockPreview";
import type { Photo } from "../model/types";
import { useSession } from "../session/Session";
import styles from "./Filmstrip.module.css";

/** Every frame sits in a cell of this size, whatever its orientation. */
const CELL = { width: 96, height: 64 };

function frameSize(photo: Photo) {
  const scale = Math.min(CELL.width / photo.width, CELL.height / photo.height);
  return { width: Math.round(photo.width * scale), height: Math.round(photo.height * scale) };
}

const stem = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

/**
 * The shoot, left to right. Marks sit under each frame, never on it: how
 * many versions it has, whether one is picked, and whether the agent has
 * made versions nobody has looked at.
 */
export function Filmstrip() {
  const { status, shoot, photo, progress, selectPhoto, shownVersion } = useSession();
  const photos = shoot?.photos ?? [];
  const picked = photos.filter((p) => p.pickId !== null).length;
  const unseen = photos.filter((p) => p.versions.some((v) => !v.seen)).length;

  return (
    <nav className={styles.filmstrip} aria-label="Photos in this shoot">
      <div className={styles.summary}>
        {status === "empty" && <p className={styles.quiet}>No photos</p>}
        {status === "loading" && progress && (
          <>
            <p className="num">{progress.total} photos</p>
            <p className={`${styles.quiet} num`}>
              {progress.done} of {progress.total} previews ready
            </p>
          </>
        )}
        {status === "ready" && (
          <>
            <p className="num">{photos.length} photos</p>
            <p className={`${styles.quiet} num`}>
              <span className={styles.legend} data-mark="pick" />
              {picked} picked
            </p>
            <p className={`${styles.quiet} num`}>
              <span className={styles.legend} data-mark="unseen" />
              {unseen} with versions to see
            </p>
          </>
        )}
      </div>

      <ol className={styles.frames}>
        {photos.map((item, index) => {
          const size = frameSize(item);
          const ready = status === "ready" || (progress !== null && index < progress.done);
          const selected = status === "ready" && item.id === photo?.id;
          const versions = item.versions.length - 1;
          const hasUnseen = item.versions.some((v) => !v.seen);
          const original = item.versions[0]!;

          return (
            <li key={item.id}>
              <button
                type="button"
                className={styles.cell}
                aria-current={selected || undefined}
                aria-label={`${item.fileName}, ${versions} versions${hasUnseen ? ", new versions to see" : ""}`}
                disabled={status !== "ready"}
                onClick={() => selectPhoto(item.id)}
              >
                <span className={styles.window}>
                  {ready ? (
                    <MockPreview
                      className={styles.frame}
                      url={item.previewUrl}
                      params={status === "ready" ? shownVersion(item).params : original.params}
                      asShot={original.params}
                      alt=""
                      style={size}
                    />
                  ) : (
                    <span className={styles.pending} style={size} />
                  )}
                </span>
                <span className={styles.caption}>
                  <span className={`${styles.name} num`}>{stem(item.fileName)}</span>
                  {status === "ready" && (
                    <span className={styles.marks}>
                      {item.pickId && <span className={styles.pickDot} title="Has a pick" />}
                      {hasUnseen && <span className={styles.unseenDot} title="Versions you have not seen" />}
                      {versions > 0 && (
                        <span className={`${styles.badge} num`} title={`${versions} versions`}>
                          {versions}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
