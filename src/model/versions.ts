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
 * Nothing here changes its arguments.
 */

import { ALL_PARAMS, type ParamId } from "./params";
import type { Author, Photo, Version } from "./types";

/** The letter the photo's next version will take: A, B, C… */
export function nextLetter(photo: Photo): string {
  return String.fromCharCode(65 + photo.versions.filter((v) => v.letter).length);
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
  const letter = nextLetter(photo);
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
  return { photo: { ...photo, versions: [...photo.versions, version] }, version };
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
 * One adjustment made by `by` to a version.
 *
 * It starts a new version when the target is the original, is someone
 * else's, or already has versions built on it. Otherwise the author's own
 * working copy is replaced by a new snapshot under the same id.
 *
 * When that leaves a person's working copy equal to its parent, as a reset
 * of its only change does, the copy is discarded and the parent is what to
 * show: an "Adjusted" version that adjusts nothing should not exist.
 */
export function changeParam(photo: Photo, versionId: string, id: ParamId, value: number, by: Author, fork: ForkLabel): Change {
  const target = photo.versions.find((v) => v.id === versionId);
  if (!target || target.params[id] === value) return { photo, versionId, forked: false, discarded: null };

  const ownWorkingCopy = sameAuthor(target.author, by) && !hasChildren(photo, versionId);
  if (ownWorkingCopy) {
    const next: Version = { ...target, params: { ...target.params, [id]: value } };
    const changed: Photo = { ...photo, versions: photo.versions.map((v) => (v.id === versionId ? next : v)) };
    if (by.kind === "you" && next.parentId !== null && sameAsParent(changed, next)) {
      return { photo: discard(changed, next), versionId: next.parentId, forked: false, discarded: next.id };
    }
    return { photo: changed, versionId, forked: false, discarded: null };
  }

  const added = addVersion(photo, versionId, by, fork);
  const changed: Version = { ...added.version, params: { ...added.version.params, [id]: value } };
  return {
    photo: { ...added.photo, versions: added.photo.versions.map((v) => (v.id === changed.id ? changed : v)) },
    versionId: changed.id,
    forked: true,
    discarded: null,
  };
}
