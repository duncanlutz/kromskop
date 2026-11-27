/*
 * The rules of versions, as plain functions over plain data.
 *
 * A version is an immutable snapshot with a parent. Once another version has
 * been made from it, it never changes again. Nobody edits someone else's
 * version: the first change to it starts a new one. Only an author's own
 * open working copy, with nothing built on it, takes a change directly, and
 * even then as a new snapshot object rather than a mutation.
 *
 * A person's working copy that ends up equal to its parent says nothing, so
 * it is discarded, unless something has been built on it.
 *
 * A gesture is one edit. While a slider is being dragged, a key held or a
 * number typed, nothing is created, discarded or renamed: the changes are
 * held beside the photo and the rules above are applied once, when the
 * gesture ends.
 *
 * A letter, and the id made from it, is never issued twice for one photo,
 * not even after the version that had it was discarded.
 *
 * Nothing here changes its arguments.
 */

import { ALL_PARAMS, type ParamId } from "./params";
import type { Author, Params, Photo, Version } from "./types";

/**
 * The letter for the nth version of a photo, counting from zero: A to Z,
 * then AA, AB and so on, the way spreadsheet columns are named. A photo
 * with more than 26 versions is unlikely but must not break anything.
 */
export function letterAt(index: number): string {
  let letters = "";
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) letters = String.fromCharCode(65 + (n % 26)) + letters;
  return letters;
}

/** The position of a letter in that sequence: A is 0, Z is 25, AA is 26. */
export function letterIndex(letter: string): number {
  let index = 0;
  for (const char of letter) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * How many letters the photo has issued. The photo keeps the count, so a
 * discarded version's letter is not handed out again; the letters in use
 * are a floor for photos recorded before the count existed.
 */
export function lettersIssued(photo: Photo): number {
  const inUse = photo.versions.reduce((highest, v) => (v.letter ? Math.max(highest, letterIndex(v.letter) + 1) : highest), 0);
  return Math.max(photo.versionsIssued ?? 0, inUse);
}

/** The letter the photo's next version will take: the one after the highest ever issued. */
export function nextLetter(photo: Photo): string {
  return letterAt(lettersIssued(photo));
}

export function parentOf(photo: Photo, version: Version): Version | null {
  return version.parentId === null ? null : (photo.versions.find((v) => v.id === version.parentId) ?? null);
}

/** True when at least one version was made from this one. */
export function hasChildren(photo: Photo, versionId: string): boolean {
  return photo.versions.some((v) => v.parentId === versionId);
}

/** "Changed" always means: differs from the parent version. The original has changed nothing. */
export function isChanged(version: Version, parent: Version | null, id: ParamId): boolean {
  return parent !== null && version.params[id] !== parent.params[id];
}

/** Every adjustment on which a version differs from its parent, in panel order. */
export function changedParams(photo: Photo, version: Version): ParamId[] {
  const parent = parentOf(photo, version);
  return ALL_PARAMS.map((def) => def.id).filter((id) => isChanged(version, parent, id));
}

/** What Reset restores: the parent's own value, exactly as stored. */
export function resetValue(photo: Photo, version: Version, id: ParamId): number {
  return (parentOf(photo, version) ?? version).params[id];
}

function sameAuthor(a: Author | null, b: Author): boolean {
  if (!a || a.kind !== b.kind) return false;
  return a.kind === "you" || (b.kind === "agent" && a.client === b.client);
}

/** What a new version is called when a change has to start one. */
export interface ForkLabel {
  name: string;
  rationale?: string | null;
  /** Whether the person has already looked at it. Their own versions always are. */
  seen?: boolean;
}

/** A new version made from `parentId`, carrying the parent's values until they are changed. */
export function addVersion(photo: Photo, parentId: string, by: Author, label: ForkLabel): { photo: Photo; version: Version } {
  const parent = photo.versions.find((v) => v.id === parentId);
  if (!parent) throw new Error(`No version ${parentId} to build on`);
  const issued = lettersIssued(photo);
  const letter = letterAt(issued);
  const version: Version = {
    id: `${photo.id}-${letter.toLowerCase()}`,
    letter,
    name: label.name,
    author: by,
    rationale: label.rationale ?? null,
    parentId: parent.id,
    params: parent.params,
    seen: label.seen ?? by.kind === "you",
  };
  return { photo: { ...photo, versions: [...photo.versions, version], versionsIssued: issued + 1 }, version };
}

export interface Change {
  photo: Photo;
  /**
   * The version to show after the change: the one changed, a new one made
   * for it, or the parent when the change emptied a working copy.
   */
  versionId: string;
  forked: boolean;
  /** Id of a working copy the change left equal to its parent, and so removed. */
  discarded: string | null;
}

/** True when a version differs from its parent in nothing. */
export function sameAsParent(photo: Photo, version: Version): boolean {
  const parent = parentOf(photo, version);
  return parent !== null && ALL_PARAMS.every((def) => version.params[def.id] === parent.params[def.id]);
}

/**
 * Removes a version that has become equal to its parent. Anything that
 * pointed at it points at the parent instead, which looks the same.
 */
function discard(photo: Photo, version: Version): Photo {
  return {
    ...photo,
    versions: photo.versions.filter((v) => v.id !== version.id),
    pickId: photo.pickId === version.id ? version.parentId : photo.pickId,
  };
}

/**
 * A gesture in progress on one version: a drag, a held key, a stay in the
 * number field. It holds what the gesture has changed so far. The photo is
 * not touched until the edit is committed.
 */
export interface Edit {
  /** The version the gesture began on. */
  versionId: string;
  by: Author;
  /** Only the adjustments the gesture has moved, at their latest values. */
  changes: Readonly<Partial<Record<ParamId, number>>>;
}

export function beginEdit(versionId: string, by: Author): Edit {
  return { versionId, by, changes: {} };
}

/** One more movement within the gesture. Nothing but the edit changes. */
export function editParam(edit: Edit, id: ParamId, value: number): Edit {
  return { ...edit, changes: { ...edit.changes, [id]: value } };
}

/** True when committing would start a new version rather than update the target. */
function wouldFork(photo: Photo, target: Version, by: Author): boolean {
  return !(sameAuthor(target.author, by) && !hasChildren(photo, target.id));
}

function applied(target: Version, edit: Edit): Params {
  return { ...target.params, ...edit.changes };
}

/**
 * What to show while the gesture is under way: the target with the
 * gesture's changes on it, measured against the parent it will have once
 * committed. For an edit that will start a new version that parent is the
 * target itself, so "changed" already reads as it will afterwards.
 */
export function previewEdit(photo: Photo, edit: Edit): { version: Version; parent: Version | null } | null {
  const target = photo.versions.find((v) => v.id === edit.versionId);
  if (!target) return null;
  const forks = wouldFork(photo, target, edit.by);
  const parent = forks ? target : parentOf(photo, target);
  return { version: { ...target, parentId: parent?.id ?? null, params: applied(target, edit) }, parent };
}

/**
 * The end of the gesture, and the only point at which the photo changes.
 *
 * If the gesture left every value where it began, nothing happens. If the
 * target is the original, someone else's, or has versions built on it, one
 * new version is made. Otherwise the author's own working copy is replaced
 * by a new snapshot under the same id, or, when a person's copy now equals
 * its parent, discarded once, with the parent as what to show: an
 * "Adjusted" version that adjusts nothing should not exist.
 */
export function commitEdit(photo: Photo, edit: Edit, fork: ForkLabel): Change {
  const target = photo.versions.find((v) => v.id === edit.versionId);
  const unchanged: Change = { photo, versionId: edit.versionId, forked: false, discarded: null };
  if (!target) return unchanged;
  const params = applied(target, edit);
  if (ALL_PARAMS.every((def) => params[def.id] === target.params[def.id])) return unchanged;

  if (!wouldFork(photo, target, edit.by)) {
    const next: Version = { ...target, params };
    const changed: Photo = { ...photo, versions: photo.versions.map((v) => (v.id === target.id ? next : v)) };
    if (edit.by.kind === "you" && next.parentId !== null && sameAsParent(changed, next)) {
      return { photo: discard(changed, next), versionId: next.parentId, forked: false, discarded: next.id };
    }
    return { photo: changed, versionId: target.id, forked: false, discarded: null };
  }

  const added = addVersion(photo, target.id, edit.by, fork);
  const made: Version = { ...added.version, params };
  return {
    photo: { ...added.photo, versions: added.photo.versions.map((v) => (v.id === made.id ? made : v)) },
    versionId: made.id,
    forked: true,
    discarded: null,
  };
}

/** One adjustment as an edit of its own: begun, made and committed at once. */
export function changeParam(photo: Photo, versionId: string, id: ParamId, value: number, by: Author, fork: ForkLabel): Change {
  return commitEdit(photo, editParam(beginEdit(versionId, by), id, value), fork);
}
