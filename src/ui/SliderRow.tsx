import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clampValue, formatValue, fromPosition, parseValue, toPosition, type ParamDef } from "../model/params";
import styles from "./SliderRow.module.css";

interface SliderRowProps {
  def: ParamDef;
  value: number;
  /** Value in the parent version. Null when there is nothing to compare with. */
  parentValue: number | null;
  onChange(value: number): void;
  /** A CSS colour shown as a small chip before the label, where hue is the meaning. */
  swatch?: string;
  /** Goes up each time the agent changes this slider; marks the row briefly. */
  agentMark?: number;
  disabled?: boolean;
}

/** Pointer travel within this distance of the thumb drags it without a jump. */
const GRAB_RADIUS = 6;
/** A press has to travel this far before it counts as a drag. */
const DRAG_SLOP = 2;

export function SliderRow({ def, value, parentValue, onChange, swatch, agentMark, disabled = false }: SliderRowProps) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; lastX: number; position: number; moving: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  /** Set when Escape or Return has already dealt with the draft, so the blur that follows does not commit it. */
  const settled = useRef(false);

  const changed = parentValue !== null && value !== parentValue;
  const position = toPosition(def, value);
  const parentPosition = parentValue === null ? position : toPosition(def, parentValue);
  const formatted = formatValue(def, value);

  const set = (next: number) => {
    const clean = clampValue(def, next);
    if (clean !== value) onChange(clean);
  };

  // Reset restores the parent's value exactly as it is, whatever its precision,
  // so the row can stop counting as changed.
  const reset = () => {
    if (!disabled && parentValue !== null && parentValue !== value) onChange(parentValue);
  };

  /*
   * Dragging. A press away from the thumb brings the value to the pointer,
   * but only once the pointer moves: a press alone changes nothing, so a
   * double-click can reset without first moving the value, and a stray click
   * cannot start a new version. Alt slows the drag to a quarter.
   */

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || !track.current) return;
    const rect = track.current.getBoundingClientRect();
    const pressed = (event.clientX - rect.left) / rect.width;
    const onThumb = Math.abs(event.clientX - (rect.left + position * rect.width)) <= GRAB_RADIUS;
    const start = onThumb ? position : Math.min(1, Math.max(0, pressed));
    drag.current = { startX: event.clientX, lastX: event.clientX, position: start, moving: false };
    track.current.setPointerCapture(event.pointerId);
    track.current.focus({ preventScroll: true });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held || !track.current) return;
    if (!held.moving) {
      if (Math.abs(event.clientX - held.startX) < DRAG_SLOP) return;
      held.moving = true;
      setDragging(true);
    }
    const width = track.current.getBoundingClientRect().width;
    const travel = (event.clientX - held.lastX) / width;
    held.lastX = event.clientX;
    held.position = Math.min(1, Math.max(0, held.position + travel * (event.altKey ? 0.25 : 1)));
    set(fromPosition(def, held.position));
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  /* Keys. Arrows step, Shift steps larger. */

  const stepBy = (event: KeyboardEvent, direction: 1 | -1) => {
    event.preventDefault();
    set(value + direction * (event.shiftKey ? def.bigStep : def.step));
  };

  const onTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        return stepBy(event, 1);
      case "ArrowLeft":
      case "ArrowDown":
        return stepBy(event, -1);
      case "PageUp":
        event.preventDefault();
        return set(value + def.bigStep);
      case "PageDown":
        event.preventDefault();
        return set(value - def.bigStep);
      case "Home":
        event.preventDefault();
        return set(def.min);
      case "End":
        event.preventDefault();
        return set(def.max);
      // The keyboard's way to reset, where a pointer double-clicks.
      case "Backspace":
      case "Delete":
        event.preventDefault();
        return reset();
    }
  };

  /* The number field. */

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseValue(def, draft);
    if (parsed !== null) set(parsed);
    setDraft(null);
  };

  // Blur commits what was typed, unless a key has already settled it.
  // blur() fires this synchronously, before the state it would read has updated.
  const onFieldBlur = () => {
    if (settled.current) settled.current = false;
    else commitDraft();
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commitDraft();
      settled.current = true;
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      // Cancel: drop the draft and leave the value as it was.
      setDraft(null);
      settled.current = true;
      event.currentTarget.blur();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const parsed = draft === null ? value : (parseValue(def, draft) ?? value);
      const step = event.shiftKey ? def.bigStep : def.step;
      event.preventDefault();
      setDraft(null);
      set(parsed + (event.key === "ArrowUp" ? step : -step));
    }
  };

  const low = Math.min(position, parentPosition);
  const high = Math.max(position, parentPosition);

  return (
    <div
      className={styles.row}
      data-changed={changed || undefined}
      data-disabled={disabled || undefined}
      data-dragging={dragging || undefined}
      // Alternating values restart the mark when the agent touches a row twice.
      data-agent-mark={agentMark === undefined ? undefined : agentMark % 2 === 0 ? "even" : "odd"}
    >
      <span className={styles.marker} aria-hidden="true" />
      <span
        className={styles.label}
        onDoubleClick={reset}
        title={changed ? "Double-click to reset, or press Delete on the slider" : undefined}
      >
        {swatch && <span className={styles.swatch} style={{ background: swatch }} aria-hidden="true" />}
        {def.label}
      </span>

      <div
        ref={track}
        className={styles.track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={def.label}
        aria-valuemin={def.min}
        aria-valuemax={def.max}
        aria-valuenow={value}
        aria-valuetext={def.unit ? `${formatted} ${def.unit}` : formatted}
        aria-disabled={disabled || undefined}
        aria-keyshortcuts="Delete"
        aria-description={changed ? "Changed from the parent version. Delete resets it." : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onTrackKeyDown}
        onDoubleClick={reset}
      >
        <span className={styles.rail} />
        {changed && (
          <>
            <span className={styles.delta} style={{ left: `${low * 100}%`, width: `${(high - low) * 100}%` }} />
            <span className={styles.parentTick} style={{ left: `${parentPosition * 100}%` }} />
          </>
        )}
        <span className={styles.thumb} style={{ left: `${position * 100}%` }} />
      </div>

      <input
        className={`${styles.field} num`}
        type="text"
        inputMode="decimal"
        aria-label={`${def.label} value`}
        disabled={disabled}
        value={draft ?? formatted}
        onFocus={(event) => {
          settled.current = false;
          setDraft(formatted);
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={onFieldBlur}
        onKeyDown={onFieldKeyDown}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
}
