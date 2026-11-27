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
  /** Show only this fraction of the tile, from the left. Used by Split. */
  clip?: number;
}

interface ViewportProps {
  photo: Photo;
  /** Bottom to top. */
  layers: Layer[];
  /** The version that takes input and whose notes are drawn. */
  activeId: string;
  children?: ReactNode;
}

/** Pointer travel below this is a click, not a drag. */
const CLICK_SLOP = 3;
/** Height a tag needs above a region, in screen pixels. */
const TAG_ROOM = 22;
/** A dragged note smaller than this, in screen pixels, is a point. */
const POINT_SIZE = 5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * A window onto one or more versions at the shared zoom and position.
 * Scroll or pinch zooms about the pointer, a drag pans, a click goes to 100%
 * and back. Shift moves this tile alone.
 */
export function Viewport({ photo, layers, activeId, children }: ViewportProps) {
  const session = useSession();
  const compare = useCompare();
  const { view, offsets, pan, zoomAt, toggleZoom, reportFitScale } = useCompareView();
  const [element, size] = useElementSize<HTMLDivElement>();
  const press = useRef<{ x: number; y: number; lastX: number; lastY: number; moved: boolean; note: boolean } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  /** A note region while it is being dragged out, as fractions of the photo. */
  const [drawing, setDrawing] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const active = place(view, offsets[activeId], size, photo);
  const isFocus = compare.focus?.id === activeId;

  useEffect(() => {
    if (isFocus && active.fitScale > 0) reportFitScale(active.fitScale);
  }, [isFocus, active.fitScale, reportFitScale]);

  const gesture = (alone: boolean): Gesture => ({ versionId: activeId, viewport: size, alone });
  const local = (event: { clientX: number; clientY: number }) => {
    const rect = element.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  /** A position in the tile as fractions of the photo. */
  const onPhoto = (point: { x: number; y: number }) => ({
    x: clamp01((point.x - active.left) / active.width),
    y: clamp01((point.y - active.top) / active.height),
  });

  // Wheel needs a non-passive listener to stop the page from scrolling.
  const wheel = useRef<(event: WheelEvent) => void>(() => undefined);
  wheel.current = (event: WheelEvent) => {
    event.preventDefault();
    compare.humanInput();
    // Shift turns a vertical wheel into a horizontal one on macOS.
    const delta = event.deltaY || event.deltaX;
    // Pinch arrives as a wheel with ctrlKey and small deltas.
    const factor = Math.exp(-delta * (event.ctrlKey ? 0.012 : 0.0022));
    zoomAt(gesture(event.shiftKey), local(event), factor);
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
    compare.humanInput();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = local(event);
    press.current = { ...point, lastX: point.x, lastY: point.y, moved: false, note: compare.noteTool };
    if (compare.noteTool) {
      const start = onPhoto(point);
      setDrawing({ x0: start.x, y0: start.y, x1: start.x, y1: start.y });
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pressed = press.current;
    if (!pressed) return;
    const point = local(event);
    if (!pressed.moved && Math.hypot(point.x - pressed.x, point.y - pressed.y) < CLICK_SLOP) return;
    if (pressed.note) {
      pressed.moved = true;
      const end = onPhoto(point);
      setDrawing((current) => current && { ...current, x1: end.x, y1: end.y });
      return;
    }
    if (!pressed.moved) {
      pressed.moved = true;
      compare.dragging.current = true;
      setGrabbing(true);
    }
    pan(gesture(event.shiftKey), point.x - pressed.lastX, point.y - pressed.lastY);
    pressed.lastX = point.x;
    pressed.lastY = point.y;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const pressed = press.current;
    press.current = null;
    compare.dragging.current = false;
    setGrabbing(false);
    if (!pressed) return;

    if (pressed.note) {
      const box = drawing;
      setDrawing(null);
      if (!box) return;
      const wide = Math.abs(box.x1 - box.x0) * active.width;
      const tall = Math.abs(box.y1 - box.y0) * active.height;
      const region: Region =
        wide < POINT_SIZE && tall < POINT_SIZE
          ? { x: box.x0, y: box.y0, width: 0, height: 0 }
          : { x: Math.min(box.x0, box.x1), y: Math.min(box.y0, box.y1), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0) };
      compare.focusVersion(activeId);
      compare.setDraft({ versionId: activeId, region });
      compare.setNoteTool(false);
      return;
    }

    if (!pressed.moved) {
      compare.focusVersion(activeId);
      toggleZoom(gesture(event.shiftKey), local(event));
    }
  };

  // Nothing is marked on a version whose pixels have not arrived.
  const pending = session.rendering.has(activeId);
  const notes = compare.markersHidden || pending ? [] : session.notes.filter((note) => note.versionId === activeId);
  const pointer = session.agentPointer?.versionId === activeId ? session.agentPointer : null;
  const draft = compare.draft?.versionId === activeId ? compare.draft.region : null;
  const drawn: Region | null = drawing && {
    x: Math.min(drawing.x0, drawing.x1),
    y: Math.min(drawing.y0, drawing.y1),
    width: Math.abs(drawing.x1 - drawing.x0),
    height: Math.abs(drawing.y1 - drawing.y0),
  };
  const nextNumber = session.notes.reduce((max, note) => Math.max(max, note.number), 0) + 1;

  return (
    <div
      ref={element}
      className={styles.viewport}
      data-cursor={compare.noteTool ? "note" : grabbing ? "grabbing" : active.fitted ? "zoom" : "grab"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {size.width > 0 &&
        layers.map((layer) => {
          const at = layer.version.id === activeId ? active : place(view, offsets[layer.version.id], size, photo);
          const rendering = session.rendering.has(layer.version.id);
          return (
            <div
              key={layer.version.id}
              className={styles.layer}
              style={{
                visibility: layer.hidden ? "hidden" : undefined,
                clipPath: layer.clip === undefined ? undefined : `inset(0 ${(1 - layer.clip) * 100}% 0 0)`,
              }}
            >
              {rendering ? (
                <div className={styles.pending} style={frameStyle(at)} />
              ) : (
                <session.Pixels photo={photo} version={layer.version} className={styles.pixels} style={pixelStyle(at, photo)} />
              )}
            </div>
          );
        })}

      {notes.map((note) => (
        <Mark
          key={note.id}
          at={active}
          region={note.region}
          label={String(note.number)}
          tone={note.state.kind === "waiting" ? "waiting" : note.state.kind === "addressed" ? "addressed" : "agent"}
          strong={compare.highlightedNoteId === note.id}
        />
      ))}
      {draft && !compare.markersHidden && <Mark at={active} region={draft} label={String(nextNumber)} tone="draft" strong />}
      {drawn && <Mark at={active} region={drawn} label={String(nextNumber)} tone="draft" strong />}
      {pointer && (
        <Mark
          key={pointer.id}
          at={active}
          region={pointer.region}
          label={session.agent.client ?? "Agent"}
          tone="pointer"
          strong
          style={{ animationDuration: `${pointer.lifetime}ms` }}
        />
      )}
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
