import { Camera, Minus, Plus } from "@phosphor-icons/react";
import { describeChanges, formatValue, paramDef } from "../model/params";
import { isOriginal, type Photo, type Version } from "../model/types";
import { useSession } from "../session/Session";
import { Tooltip } from "../ui/Tooltip";
import styles from "./VersionStack.module.css";

/** What Compare adds to the stack: which versions are in the comparison. */
export interface ComparisonControls {
  isCompared(versionId: string): boolean;
  toggle(versionId: string): void;
  /** Brings a version into the comparison if need be, and focuses it. */
  focus(versionId: string): void;
  count: number;
}

/** Newest on top, the original at the bottom, like prints laid on a pile. */
export function VersionStack({ comparison }: { comparison?: ComparisonControls }) {
  const { status, photo, version } = useSession();
  const versions = photo ? [...photo.versions].reverse() : [];
  const count = photo ? photo.versions.length - 1 : 0;

  return (
    <aside className={styles.panel} aria-label="Versions">
      <header className={styles.header}>
        <h2 className={styles.heading}>Versions</h2>
        {status === "ready" && count > 0 && (
          <span className={`${styles.count} num`}>{comparison ? `${comparison.count} of ${count} compared` : count}</span>
        )}
      </header>

      {status === "empty" && <p className={styles.note}>No photo open.</p>}
      {status === "loading" && <p className={styles.note}>Reading versions…</p>}

      {status === "ready" && photo && version && (
        <>
          <ol className={styles.list}>
            {versions.map((item) => (
              <VersionRow key={item.id} photo={photo} item={item} selected={item.id === version.id} comparison={comparison} />
            ))}
          </ol>
          {count === 0 && (
            <p className={styles.note}>No versions yet. Your agent adds them, or move a slider to start one yourself.</p>
          )}
          {comparison ? (
            <footer className={styles.keys} aria-hidden="true">
              <span>
                <kbd>1</kbd>–<kbd>6</kbd> focus
              </span>
              <span>
                <kbd>X</kbd> drop
              </span>
              <span>
                <kbd>U</kbd> restore
              </span>
              <span>
                <kbd>P</kbd> pick
              </span>
            </footer>
          ) : (
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
          )}
        </>
      )}
    </aside>
  );
}

interface VersionRowProps {
  photo: Photo;
  item: Version;
  selected: boolean;
  comparison?: ComparisonControls;
}

function VersionRow({ photo, item, selected, comparison }: VersionRowProps) {
  const { selectVersion, togglePick } = useSession();
  const compared = comparison?.isCompared(item.id) ?? false;
  const original = isOriginal(item);
  const picked = photo.pickId === item.id;
  const parent = item.parentId ? photo.versions.find((v) => v.id === item.parentId) : undefined;
  const label = original ? "Original" : `Version ${item.letter}`;
  // A person's version has no rationale, so the row says what they moved.
  const changes = parent && !item.rationale ? describeChanges(item.params, parent.params) : "";

  return (
    <li
      className={styles.row}
      data-selected={(comparison ? selected && compared : selected) || undefined}
      data-original={original || undefined}
      data-comparing={comparison ? (compared ? "in" : "out") : undefined}
    >
      <button
        type="button"
        className={styles.main}
        aria-current={selected || undefined}
        aria-label={`${label}, ${item.name}`}
        onClick={() => (comparison ? comparison.focus(item.id) : selectVersion(item.id))}
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

      {comparison && (
        <Tooltip label={compared ? "Drop from the comparison" : "Add to the comparison"} keys={compared ? "X" : undefined} side="right">
          <button
            type="button"
            className={styles.compare}
            aria-pressed={compared}
            aria-label={compared ? `Drop ${label} from the comparison` : `Add ${label} to the comparison`}
            onClick={() => comparison.toggle(item.id)}
          >
            {compared ? <Minus size={16} /> : <Plus size={16} />}
          </button>
        </Tooltip>
      )}

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
