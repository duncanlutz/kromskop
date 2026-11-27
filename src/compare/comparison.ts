/*
 * Which versions of a photo are in the comparison: plain rules over plain
 * data, with nothing here changing its arguments.
 *
 * At most six versions are compared at once. A tile never leaves the
 * comparison unless the person takes it out: when the comparison is full, a
 * version that arrives waits outside it, and an attempt to add one is
 * refused with the reason rather than making room by removing another.
 */

import { ORIGINAL_ID, type Photo, type Version } from "../model/types";

/** Most versions shown at once. */
export const MAX_COMPARED = 6;

/** What Compare remembers about one photo's comparison, beyond what the person dropped. */
export interface Comparison {
  /** The original is a guest: it is out until the person asks for it. */
  withOriginal: boolean;
  /** Versions kept out only because there was no room when they appeared. */
  waiting: readonly string[];
  /** Every version seen so far, so a new one can be told from an old one. */
  known: readonly string[];
}

/** Where a version stands. Only "compared" has a tile. */
export type Standing =
  | "compared"
  /** Taken out by the person. Stays out until they restore it. */
  | "dropped"
  /** Not in because the comparison was full when it arrived. */
  | "waiting"
  /** The original, not asked for. */
  | "out";

const lettered = (photo: Photo) => photo.versions.filter((v) => v.letter);

/** A photo seen for the first time: its first six undropped versions are compared. */
export function startComparison(photo: Photo): Comparison {
  const candidates = lettered(photo).filter((v) => !photo.droppedIds.includes(v.id));
  return {
    withOriginal: false,
    waiting: candidates.slice(MAX_COMPARED).map((v) => v.id),
    known: photo.versions.map((v) => v.id),
  };
}

export function standingOf(comparison: Comparison, photo: Photo, versionId: string): Standing {
  if (versionId === ORIGINAL_ID) return comparison.withOriginal ? "compared" : "out";
  if (photo.droppedIds.includes(versionId)) return "dropped";
  return comparison.waiting.includes(versionId) ? "waiting" : "compared";
}

/** The versions that have tiles, lettered ones in order and the original last. */
export function comparedVersions(comparison: Comparison, photo: Photo): Version[] {
  const tiles = lettered(photo).filter((v) => standingOf(comparison, photo, v.id) === "compared");
  const original = photo.versions.find((v) => !v.letter);
  return comparison.withOriginal && original ? [...tiles, original] : tiles;
}

export function isFull(comparison: Comparison, photo: Photo): boolean {
  return comparedVersions(comparison, photo).length >= MAX_COMPARED;
}

/**
 * Brings the record up to date with the photo. A version that has appeared
 * since joins the comparison when there is room and waits when there is
 * not; what is already compared is never displaced. Versions that no longer
 * exist are forgotten.
 */
export function reconcile(comparison: Comparison, photo: Photo): Comparison {
  const ids = photo.versions.map((v) => v.id);
  const arrivals = lettered(photo).filter((v) => !comparison.known.includes(v.id));
  const gone = comparison.known.some((id) => !ids.includes(id));
  if (arrivals.length === 0 && !gone) return comparison;

  const next: Comparison = { ...comparison, waiting: comparison.waiting.filter((id) => ids.includes(id)), known: ids };
  // Room is counted before the arrivals are seated: an arrival is not yet a
  // tile, so it must not count against itself. Each one that is seated then
  // takes a place the next cannot have.
  const arriving = new Set(arrivals.map((v) => v.id));
  let seated = comparedVersions(next, photo).filter((v) => !arriving.has(v.id)).length;
  const waiting = [...next.waiting];
  for (const arrival of arrivals) {
    if (photo.droppedIds.includes(arrival.id)) continue;
    if (seated < MAX_COMPARED) seated += 1;
    else waiting.push(arrival.id);
  }
  return { ...next, waiting };
}

export type AddResult =
  | { outcome: "added"; comparison: Comparison; /** True when the caller must also clear the person's drop. */ restore: boolean }
  | { outcome: "already"; comparison: Comparison }
  /** Six are compared already. Nothing changes; the person has to drop one first. */
  | { outcome: "full"; comparison: Comparison };

/** The person asks for a version to be compared. */
export function addToComparison(comparison: Comparison, photo: Photo, versionId: string): AddResult {
  const standing = standingOf(comparison, photo, versionId);
  if (standing === "compared") return { outcome: "already", comparison };
  if (isFull(comparison, photo)) return { outcome: "full", comparison };
  if (standing === "out") return { outcome: "added", comparison: { ...comparison, withOriginal: true }, restore: false };
  return {
    outcome: "added",
    comparison: { ...comparison, waiting: comparison.waiting.filter((id) => id !== versionId) },
    restore: standing === "dropped",
  };
}

/**
 * The person takes a version out. The original simply leaves; a lettered
 * version is dropped, which the caller records with the photo. Nothing that
 * was waiting moves in to fill the gap: narrowing a comparison must narrow it.
 */
export function removeFromComparison(comparison: Comparison, versionId: string): { comparison: Comparison; drop: boolean } {
  if (versionId === ORIGINAL_ID) return { comparison: { ...comparison, withOriginal: false }, drop: false };
  return { comparison, drop: true };
}

/**
 * Whether the view may move to a version because the agent asked. It may
 * only when the version already has a tile: the agent does not undo a drop
 * or push its way into a full comparison.
 */
export function agentMayFocus(comparison: Comparison, photo: Photo, versionId: string): boolean {
  return standingOf(comparison, photo, versionId) === "compared";
}

/** A focus that Reference moved off the pinned version, so it can be put back. */
export interface FocusShift {
  from: string;
  to: string;
}

/**
 * The focus to return to on leaving Reference. Entering it may have moved
 * the focus off the version that became the reference; unless the person
 * has chosen another since, leaving puts it back.
 */
export function focusAfterReference(shift: FocusShift | null, focusId: string | undefined, compared: readonly Version[]): string | null {
  if (!shift || focusId !== shift.to) return null;
  return compared.some((v) => v.id === shift.from) ? shift.from : null;
}
