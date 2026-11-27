import { Camera } from "@phosphor-icons/react";
import { describeChanges, formatValue, paramDef } from "../model/params";
import { isOriginal, type Photo, type Version } from "../model/types";
import { useSession } from "../session/Session";
import { Tooltip } from "../ui/Tooltip";
import styles from "./VersionStack.module.css";

/** Newest on top, the original at the bottom, like prints laid on a pile. */
export function VersionStack() {
  const { status, photo, version } = useSession();
  const versions = photo ? [...photo.versions].reverse() : [];
  const count = photo ? photo.versions.length - 1 : 0;

  return (
    <aside className={styles.panel} aria-label="Versions">
      <header className={styles.header}>
        <h2 className={styles.heading}>Versions</h2>
        {status === "ready" && count > 0 && <span className={`${styles.count} num`}>{count}</span>}
      </header>

      {status === "empty" && <p className={styles.note}>No photo open.</p>}
      {status === "loading" && <p className={styles.note}>Reading versions…</p>}

      {status === "ready" && photo && version && (
        <>
          <ol className={styles.list}>
            {versions.map((item) => (
              <VersionRow key={item.id} photo={photo} item={item} selected={item.id === version.id} />
            ))}
          </ol>
          {count === 0 && (
            <p className={styles.note}>No versions yet. Your agent adds them, or move a slider to start one yourself.</p>
          )}
          <footer className={styles.keys} aria-hidden="true">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> version
            </span>
            <span>
              <kbd>P</kbd> pick
            </span>
            <span>
              <kbd>\</kbd> original
            </span>
          </footer>
        </>
      )}
    </aside>
  );
}

function VersionRow({ photo, item, selected }: { photo: Photo; item: Version; selected: boolean }) {
  const { selectVersion, togglePick } = useSession();
  const original = isOriginal(item);
  const picked = photo.pickId === item.id;
  const parent = item.parentId ? photo.versions.find((v) => v.id === item.parentId) : undefined;
  const label = original ? "Original" : `Version ${item.letter}`;
  // A person's version has no rationale, so the row says what they moved.
  const changes = parent && !item.rationale ? describeChanges(item.params, parent.params) : "";

  return (
    <li className={styles.row} data-selected={selected || undefined} data-original={original || undefined}>
      <button
        type="button"
        className={styles.main}
        aria-current={selected || undefined}
        aria-label={`${label}, ${item.name}`}
        onClick={() => selectVersion(item.id)}
      >
        <span className={styles.tile} aria-hidden="true">
          {original ? <Camera size={16} /> : item.letter}
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{item.name}</span>
          <span className={styles.meta}>
            {original ? (
              <span className="num">
                As shot, {formatValue(paramDef("temp"), item.params.temp)} K
              </span>
            ) : (
              <>
                <span className={styles.author} data-agent={item.author?.kind === "agent" || undefined}>
                  {item.author?.kind === "agent" ? item.author.client : "You"}
                </span>
                {parent && !isOriginal(parent) && <span> · from {parent.letter}</span>}
              </>
            )}
          </span>
          {item.rationale ? (
            <span className={styles.rationale}>{item.rationale}</span>
          ) : (
            changes && <span className={`${styles.rationale} num`}>{changes}</span>
          )}
        </span>
      </button>

      {item.seen ? (
        <Tooltip label={picked ? "Remove pick" : "Pick this version"} keys="P" side="right">
          <button
            type="button"
            className={styles.pick}
            aria-pressed={picked}
            aria-label={picked ? `Remove pick from ${label}` : `Pick ${label}`}
            onClick={() => togglePick(item.id)}
          >
            <span className={styles.pickMark} />
          </button>
        </Tooltip>
      ) : (
        <span className={styles.unseen} role="img" aria-label="Not viewed yet" title="Not viewed yet" />
      )}
    </li>
  );
}
