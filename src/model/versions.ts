/*
 * The rules of versions, as plain functions over plain data.
 *
 * A version is an immutable snapshot with a parent. Once another version has
 * been made from it, it never changes again. Nobody edits someone else's
 * version: the first change to it starts a new one. Only an author's own
 * open working copy, with nothing built on it, takes a change directly, and
 * even then as a new snapshot object rather than a mutation.
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
  /** The version that now holds the change: the same one, or a new one. */
  versionId: string;
  forked: boolean;
}

/**
 * One adjustment made by `by` to a version.
 *
 * It starts a new version when the target is the original, is someone
 * else's, or already has versions built on it. Otherwise the author's own
 * working copy is replaced by a new snapshot under the same id.
 */
export function changeParam(photo: Photo, versionId: string, id: ParamId, value: number, by: Author, fork: ForkLabel): Change {
  const target = photo.versions.find((v) => v.id === versionId);
  if (!target || target.params[id] === value) return { photo, versionId, forked: false };

  const ownWorkingCopy = sameAuthor(target.author, by) && !hasChildren(photo, versionId);
  if (ownWorkingCopy) {
    const next: Version = { ...target, params: { ...target.params, [id]: value } };
    return { photo: { ...photo, versions: photo.versions.map((v) => (v.id === versionId ? next : v)) }, versionId, forked: false };
  }

  const added = addVersion(photo, versionId, by, fork);
  const changed: Version = { ...added.version, params: { ...added.version.params, [id]: value } };
  return {
    photo: { ...added.photo, versions: added.photo.versions.map((v) => (v.id === changed.id ? changed : v)) },
    versionId: changed.id,
    forked: true,
  };
}
