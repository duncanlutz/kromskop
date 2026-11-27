import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { ORIGINAL_ID, type Photo, type Version } from "../model/types";
import { useSession } from "../session/Session";
import { usePrefs } from "../shell/Prefs";
import { useView } from "../shell/ViewState";
import { Button } from "../ui/Button";
import { useElementSize } from "../ui/useElementSize";
import { useCompare } from "./CompareState";
import styles from "./CompareStage.module.css";
import { TileLabel } from "./TileLabel";
import { Viewport } from "./Viewport";

/** The compared versions on the surround, laid out for the mode in use. */
export function CompareStage() {
  const { photo } = useSession();
  const { surround } = usePrefs();
  const compare = useCompare();
  const { compared, focus, against, mode } = compare;

  if (!photo) return <div className={styles.stage} />;

  const enough = compared.length >= 2 && focus && against;
  const indexOf = (version: Version) => compared.findIndex((v) => v.id === version.id);

  return (
    <div
      className={styles.stage}
      style={{ background: surround.colour }}
      data-tone={surround.id === "assess" || surround.id === "white" ? "light" : "dark"}
    >
      {!enough && <NothingToCompare photo={photo} />}

      {enough && mode === "grid" && (
        <div className={styles.grid} data-count={compared.length} data-shape={photo.width > photo.height ? "landscape" : "portrait"}>
          {compared.map((version, index) => (
            <Frame key={version.id} photo={photo}>
              <Viewport photo={photo} layers={[{ version }]} activeId={version.id} />
              <TileLabel photo={photo} version={version} index={index} />
            </Frame>
          ))}
        </div>
      )}

      {enough && mode === "flip" && (
        <div className={styles.single}>
          <Frame photo={photo}>
            {/* Every version stays mounted, so a swap only changes which one shows. */}
            <Viewport
              photo={photo}
              layers={compared.map((version) => ({ version, hidden: version.id !== focus.id }))}
              activeId={focus.id}
            />
            <div className={styles.labels}>
              {compared.map((version, index) => (
                <TileLabel key={version.id} photo={photo} version={version} index={index} compact />
              ))}
            </div>
          </Frame>
        </div>
      )}

      {enough && mode === "split" && (
        <div className={styles.single}>
          <Frame photo={photo}>
            {/* Each version shows on its own side of the divider, with its own notes. */}
            <Viewport
              photo={photo}
              layers={[
                { version: focus, clip: { from: compare.split, to: 1 } },
                { version: against, clip: { from: 0, to: compare.split } },
              ]}
              activeId={focus.id}
              focusOnPress={false}
            >
              <Divider />
            </Viewport>
            <div className={styles.labels} data-ends>
              <TileLabel photo={photo} version={against} index={indexOf(against)} />
              <TileLabel photo={photo} version={focus} index={indexOf(focus)} align="end" />
            </div>
          </Frame>
        </div>
      )}

      {enough && mode === "reference" && (
        <div className={styles.grid} data-count={2}>
          <Frame photo={photo}>
            <Viewport photo={photo} layers={[{ version: against }]} activeId={against.id} />
            <TileLabel photo={photo} version={against} index={indexOf(against)} />
          </Frame>
          <Frame photo={photo}>
            <Viewport
              photo={photo}
              layers={compared
                .filter((version) => version.id !== against.id)
                .map((version) => ({ version, hidden: version.id !== focus.id }))}
              activeId={focus.id}
            />
            <div className={styles.labels}>
              {compared
                .filter((version) => version.id !== against.id)
                .map((version) => (
                  <TileLabel key={version.id} photo={photo} version={version} index={indexOf(version)} compact />
                ))}
            </div>
          </Frame>
        </div>
      )}
    </div>
  );
}

/** Height of the label line and the gap that separates it from the photo. */
const LABEL_SPACE = 28 + 8;

/**
 * One tile: a window the shape of the photo, as large as its cell allows,
 * with its label directly beneath. The window keeps that shape when zoomed,
 * so every tile shows the same part of the photo.
 */
function Frame({ photo, children }: { photo: Photo; children: ReactNode }) {
  const [cell, space] = useElementSize<HTMLDivElement>();
  const scale = Math.max(0, Math.min(space.width / photo.width, (space.height - LABEL_SPACE) / photo.height));
  const size = { width: Math.floor(photo.width * scale), "--tile-height": `${Math.floor(photo.height * scale)}px` };

  return (
    <div ref={cell} className={styles.cell}>
      <div className={styles.tile} style={size as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

/** The Split divider. It is dragged by its line or by the grip under it. */
function Divider() {
  const { split, setSplit, beginDrag, endDrag } = useCompare();
  const dragging = useRef(false);
  const stop = () => {
    dragging.current = false;
    endDrag();
  };
  // A divider that goes away mid-drag ends the drag, so the flag cannot stick.
  useEffect(
    () => () => {
      if (dragging.current) endDrag();
    },
    [endDrag],
  );

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget.parentElement?.getBoundingClientRect();
    if (viewport) setSplit((event.clientX - viewport.left) / viewport.width);
  };

  return (
    <div
      className={styles.divider}
      style={{ left: `${split * 100}%` }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Split position"
      aria-valuenow={Math.round(split * 100)}
      onPointerDown={(event) => {
        event.stopPropagation();
        dragging.current = true;
        // The agent may not change what is on either side while the divider moves.
        beginDrag();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        if (dragging.current) move(event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        stop();
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        stop();
      }}
    />
  );
}

/** Fewer than two versions to judge. Says why, and what would change that. */
function NothingToCompare({ photo }: { photo: Photo }) {
  const compare = useCompare();
  const { setView } = useView();
  const versions = photo.versions.filter((v) => v.letter);
  const inComparison = compare.compared.length;
  const originalIn = compare.isCompared(ORIGINAL_ID);

  let lead: string;
  if (versions.length === 0) {
    lead = `${photo.fileName} has no versions yet. Ask your agent for a few interpretations, or make one yourself in Develop.`;
  } else if (versions.length === 1 && inComparison <= 1) {
    lead = `${photo.fileName} has one version. Compare needs two or more: ask your agent for alternatives, make another in Develop, or set this one against the original.`;
  } else {
    lead = `${inComparison === 0 ? "No version is" : "Only one version is"} left in the comparison. Bring others back from the list on the left, or press U to restore the last one you dropped.`;
  }

  return (
    <div className={styles.nothing}>
      <h1 className={styles.heading}>Nothing to compare yet</h1>
      <p className={styles.lead}>{lead}</p>
      <div className={styles.actions}>
        {versions.length > 0 && !originalIn && (
          <Button primary onClick={() => compare.toggleCompared(ORIGINAL_ID)}>
            Compare with the original
          </Button>
        )}
        {compare.canRestore && versions.length > 1 && (
          <Button keys="U" onClick={compare.restoreLast}>
            Restore last dropped
          </Button>
        )}
        <Button keys="D" onClick={() => setView("develop")}>
          Open in Develop
        </Button>
      </div>
    </div>
  );
}
