import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { isPoint, type Photo, type Region, type Version } from "../model/types";
import { useSession } from "../session/Session";
import { useElementSize } from "../ui/useElementSize";
import { useCompare, useCompareView, type Gesture } from "./CompareState";
import { place, type Placement } from "./view";
import styles from "./Viewport.module.css";

export interface Layer {
  version: Version;
  /** Kept mounted but not shown, so swapping it in costs nothing. */
  hidden?: boolean;
  /** Show only the part of the tile between these fractions of its width. Used by Split. */
  clip?: { from: number; to: number };
}

interface ViewportProps {
  photo: Photo;
  /** Bottom to top. */
  layers: Layer[];
  /** The version whose geometry the tile reports, and the fallback for input. */
  activeId: string;
  /**
   * Whether a press makes the pressed version the focus. Not in Split,
   * where both versions are already on show and focusing would swap them.
   */
  focusOnPress?: boolean;
  children?: ReactNode;
}

/** Pointer travel below this is a click, not a drag. */
const CLICK_SLOP = 3;
/** Height a tag needs above a region, in screen pixels. */
const TAG_ROOM = 22;
/** A dragged note smaller than this, in screen pixels, is a point. */
const POINT_SIZE = 5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface Press {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  note: boolean;
  /** The version under the pointer when it went down. */
  versionId: string;
}

/**
 * A window onto one or more versions at the shared zoom and position.
 * Scroll or pinch zooms about the pointer, a drag pans, a click goes to 100%
 * and back. Shift moves this tile alone.
 */
export function Viewport({ photo, layers, activeId, focusOnPress = true, children }: ViewportProps) {
  const session = useSession();
  const compare = useCompare();
  const { view, offsets, pan, zoomAt, toggleZoom, reportFitScale } = useCompareView();
  const [element, size] = useElementSize<HTMLDivElement>();
  const press = useRef<Press | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  /** A note region while it is being dragged out, as fractions of the photo. */
  const [drawing, setDrawing] = useState<{ versionId: string; x0: number; y0: number; x1: number; y1: number } | null>(null);

  // A tile that goes away mid-press ends its drag, so the flag cannot stick.
  const endDrag = compare.endDrag;
  useEffect(
    () => () => {
      if (press.current) endDrag();
    },
    [endDrag],
  );

  const placeOf = (versionId: string) => place(view, offsets[versionId], size, photo);
  const active = placeOf(activeId);
  const isFocus = compare.focus?.id === activeId;

  useEffect(() => {
    if (isFocus && active.fitScale > 0) reportFitScale(active.fitScale);
  }, [isFocus, active.fitScale, reportFitScale]);

  const gesture = (versionId: string, alone: boolean): Gesture => ({ versionId, viewport: size, alone });
  const local = (event: { clientX: number; clientY: number }) => {
    const rect = element.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  /** The version showing at a position: in Split, whichever side of the divider it is on. */
  const versionAt = (point: { x: number }) => {
    const across = size.width > 0 ? point.x / size.width : 0;
    const showing = [...layers].reverse().find((layer) => !layer.hidden && (!layer.clip || (across >= layer.clip.from && across <= layer.clip.to)));
    return showing?.version.id ?? activeId;
  };
  /** A position in the tile as fractions of a version's photo. */
  const onPhoto = (point: { x: number; y: number }, versionId: string) => {
    const at = placeOf(versionId);
    return { x: clamp01((point.x - at.left) / at.width), y: clamp01((point.y - at.top) / at.height) };
  };

  // Wheel needs a non-passive listener to stop the page from scrolling.
  const wheel = useRef<(event: WheelEvent) => void>(() => undefined);
  wheel.current = (event: WheelEvent) => {
    event.preventDefault();
    // Shift turns a vertical wheel into a horizontal one on macOS.
    const delta = event.deltaY || event.deltaX;
    // Pinch arrives as a wheel with ctrlKey and small deltas.
    const factor = Math.exp(-delta * (event.ctrlKey ? 0.012 : 0.0022));
    const point = local(event);
    zoomAt(gesture(versionAt(point), event.shiftKey), point, factor);
  };
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const listener = (event: WheelEvent) => wheel.current(event);
    target.addEventListener("wheel", listener, { passive: false });
    return () => target.removeEventListener("wheel", listener);
  }, [element]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    // From press to release the view is the person's: the agent waits.
    compare.beginDrag();
    const point = local(event);
    const versionId = versionAt(point);
    press.current = { ...point, lastX: point.x, lastY: point.y, moved: false, note: compare.noteTool, versionId };
    if (compare.noteTool) {
      const start = onPhoto(point, versionId);
      setDrawing({ versionId, x0: start.x, y0: start.y, x1: start.x, y1: start.y });
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pressed = press.current;
    if (!pressed) return;
    const point = local(event);
    if (!pressed.moved && Math.hypot(point.x - pressed.x, point.y - pressed.y) < CLICK_SLOP) return;
    if (pressed.note) {
      pressed.moved = true;
      const end = onPhoto(point, pressed.versionId);
      setDrawing((current) => current && { ...current, x1: end.x, y1: end.y });
      return;
    }
    if (!pressed.moved) {
      pressed.moved = true;
      setGrabbing(true);
    }
    pan(gesture(pressed.versionId, event.shiftKey), point.x - pressed.lastX, point.y - pressed.lastY);
    pressed.lastX = point.x;
    pressed.lastY = point.y;
  };

  /** Ends the press. Returns it, so the caller can act on a completed one. */
  const release = (): Press | null => {
    const pressed = press.current;
    press.current = null;
    setGrabbing(false);
    compare.endDrag();
    return pressed;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const pressed = release();
    if (!pressed) return;

    if (pressed.note) {
      const box = drawing;
      setDrawing(null);
      if (!box) return;
      const at = placeOf(pressed.versionId);
      const wide = Math.abs(box.x1 - box.x0) * at.width;
      const tall = Math.abs(box.y1 - box.y0) * at.height;
      const region: Region =
        wide < POINT_SIZE && tall < POINT_SIZE
          ? { x: box.x0, y: box.y0, width: 0, height: 0 }
          : { x: Math.min(box.x0, box.x1), y: Math.min(box.y0, box.y1), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0) };
      if (focusOnPress) compare.focusVersion(pressed.versionId);
      compare.setDraft({ versionId: pressed.versionId, region });
      compare.setNoteTool(false);
      return;
    }

    if (!pressed.moved) {
      if (focusOnPress) compare.focusVersion(pressed.versionId);
      toggleZoom(gesture(pressed.versionId, event.shiftKey), local(event));
    }
  };

  // The system took the pointer away: nothing was clicked and nothing is drawn.
  const onPointerCancel = () => {
    release();
    setDrawing(null);
  };

  const nextNumber = session.notes.reduce((max, note) => Math.max(max, note.number), 0) + 1;
  const clipOf = (layer: Layer) =>
    layer.clip === undefined ? undefined : `inset(0 ${(1 - layer.clip.to) * 100}% 0 ${layer.clip.from * 100}%)`;

  return (
    <div
      ref={element}
      className={styles.viewport}
      data-cursor={compare.noteTool ? "note" : grabbing ? "grabbing" : active.fitted ? "zoom" : "grab"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {size.width > 0 &&
        layers.map((layer) => {
          const id = layer.version.id;
          const at = placeOf(id);
          // Nothing is marked on a version whose pixels have not arrived.
          const rendering = session.rendering.has(id);
          const notes = compare.markersHidden || rendering ? [] : session.notes.filter((note) => note.versionId === id);
          const pointer = session.agentPointer?.versionId === id ? session.agentPointer : null;
          const draft = compare.draft?.versionId === id ? compare.draft.region : null;
          const drawn: Region | null =
            drawing && drawing.versionId === id
              ? {
                  x: Math.min(drawing.x0, drawing.x1),
                  y: Math.min(drawing.y0, drawing.y1),
                  width: Math.abs(drawing.x1 - drawing.x0),
                  height: Math.abs(drawing.y1 - drawing.y0),
                }
              : null;

          return (
            // Pixels and the marks that belong to them share one clip, so in
            // Split each side shows its own version's notes and no other's.
            <div
              key={id}
              className={styles.layer}
              style={{ visibility: layer.hidden ? "hidden" : undefined, clipPath: clipOf(layer) }}
            >
              {rendering ? (
                <div className={styles.pending} style={frameStyle(at)} />
              ) : (
                <session.Pixels photo={photo} version={layer.version} className={styles.pixels} style={pixelStyle(at, photo)} />
              )}
              {notes.map((note) => (
                <Mark
                  key={note.id}
                  at={at}
                  region={note.region}
                  label={String(note.number)}
                  tone={note.state.kind === "waiting" ? "waiting" : note.state.kind === "addressed" ? "addressed" : "agent"}
                  strong={compare.highlightedNoteId === note.id}
                />
              ))}
              {draft && !compare.markersHidden && <Mark at={at} region={draft} label={String(nextNumber)} tone="draft" strong />}
              {drawn && <Mark at={at} region={drawn} label={String(nextNumber)} tone="draft" strong />}
              {pointer && (
                <Mark
                  key={pointer.id}
                  at={at}
                  region={pointer.region}
                  label={session.agent.client ?? "Agent"}
                  tone="pointer"
                  strong
                  style={{ animationDuration: `${pointer.lifetime}ms` }}
                />
              )}
            </div>
          );
        })}
      {children}
    </div>
  );
}

function frameStyle(at: Placement): CSSProperties {
  const width = Math.round(at.width / (at.scale / at.fitScale));
  const height = Math.round(at.height / (at.scale / at.fitScale));
  return { width, height };
}

/**
 * The canvas is laid out once at the fitted size and then only transformed,
 * so zooming and panning never cause layout.
 */
function pixelStyle(at: Placement, photo: Photo): CSSProperties {
  return {
    width: photo.width * at.fitScale,
    height: photo.height * at.fitScale,
    transform: `translate(${at.left}px, ${at.top}px) scale(${at.scale / at.fitScale})`,
  };
}

interface MarkProps {
  at: Placement;
  region: Region;
  label: string;
  tone: "waiting" | "agent" | "addressed" | "draft" | "pointer";
  strong?: boolean;
  style?: CSSProperties;
}

/**
 * The one thing drawn over pixels: an outline or a small ring where a note
 * or the agent's pointer is, with its number or name on a tag beside it.
 */
function Mark({ at, region, label, tone, strong, style }: MarkProps) {
  const left = at.left + region.x * at.width;
  const top = at.top + region.y * at.height;
  // The tag sits above the outline, clear of what is being pointed at,
  // unless that would push it off the top of the tile.
  const tag = top >= TAG_ROOM ? "above" : "inside";
  if (isPoint(region)) {
    return (
      <span
        className={styles.point}
        data-tone={tone}
        data-strong={strong || undefined}
        // Near the right edge the tag goes to the left of the point.
        data-flip={region.x > 0.85 || undefined}
        style={{ ...style, left, top }}
      >
        <span className={styles.tag}>{label}</span>
      </span>
    );
  }
  return (
    <span
      className={styles.region}
      data-tone={tone}
      data-strong={strong || undefined}
      data-tag={tag}
      style={{ ...style, left, top, width: region.width * at.width, height: region.height * at.height }}
    >
      <span className={styles.tag}>{label}</span>
    </span>
  );
}
