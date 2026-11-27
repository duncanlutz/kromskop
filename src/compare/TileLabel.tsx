import { PushPin } from "@phosphor-icons/react";
import type { Photo, Version } from "../model/types";
import { useSession } from "../session/Session";
import { Tooltip } from "../ui/Tooltip";
import { useCompare } from "./CompareState";
import styles from "./TileLabel.module.css";

interface TileLabelProps {
  photo: Photo;
  version: Version;
  /** Position among the compared versions; its number key focuses it. */
  index: number;
  /** A shorter form for rows that hold several labels. */
  compact?: boolean;
  align?: "start" | "end";
}

/**
 * The line under a tile: letter, name, who made it, and whether it is the
 * pick. It sits on chrome beside the photo, never over its pixels, and it is
 * also where the focused tile shows that it is focused.
 */
export function TileLabel({ photo, version, index, compact = false, align = "start" }: TileLabelProps) {
  const session = useSession();
  const compare = useCompare();
  const focused = compare.focus?.id === version.id;
  const isAgainst = compare.against?.id === version.id;
  const pinned = compare.referenceId === version.id;
  const picked = photo.pickId === version.id;
  const rendering = session.rendering.has(version.id);
  const author = version.author?.kind === "agent" ? version.author.client : version.author ? "You" : null;

  return (
    <div
      className={styles.label}
      data-focused={focused || undefined}
      data-against={isAgainst || undefined}
      data-compact={compact || undefined}
      data-align={align}
    >
      <button
        type="button"
        className={styles.main}
        aria-current={focused || undefined}
        aria-label={`${version.letter ? `Version ${version.letter}` : "Original"}, ${version.name}`}
        onClick={() => compare.focusVersion(version.id)}
      >
        <span className={styles.tile} aria-hidden="true">
          {version.letter || "O"}
        </span>
        <span className={styles.name}>{version.name}</span>
        {rendering ? (
          <span className={styles.rendering}>Rendering</span>
        ) : (
          !compact &&
          author && (
            <span className={styles.author} data-agent={version.author?.kind === "agent" || undefined}>
              {author}
            </span>
          )
        )}
        {picked && (
          <span className={styles.pick}>
            <span className={styles.pickDot} />
            {!compact && "Pick"}
          </span>
        )}
      </button>

      {(!compact || pinned) && (
        <Tooltip label={pinned ? "Unpin reference" : "Pin as the reference"} side="top">
          <button
            type="button"
            className={styles.pin}
            aria-pressed={pinned}
            aria-label={pinned ? `Unpin ${version.name} as the reference` : `Pin ${version.name} as the reference`}
            onClick={() => compare.setReference(pinned ? null : version.id)}
          >
            <PushPin size={16} />
            {pinned && !compact && <span>Reference</span>}
          </button>
        </Tooltip>
      )}
      <kbd className={`${styles.key} num`} aria-hidden="true">
        {index + 1}
      </kbd>
    </div>
  );
}
