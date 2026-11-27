import type { ParamId } from "./params";

/** A full set of slider values. Every version stores all of them. */
export type Params = Readonly<Record<ParamId, number>>;

export type Author = { kind: "agent"; client: string } | { kind: "you" };

/**
 * An immutable parameter snapshot with a parent. The original is the root:
 * it has no parent, no letter and the as-shot values.
 */
export interface Version {
  id: string;
  /** "A", "B", "C"… in order of creation. Empty for the original. */
  letter: string;
  name: string;
  author: Author | null;
  /** One sentence from the agent on what it did and why. */
  rationale: string | null;
  parentId: string | null;
  params: Params;
  /** False until a person has looked at an agent's version. */
  seen: boolean;
}

export interface CaptureInfo {
  camera: string;
  focalLength: string;
  aperture: string;
  shutter: string;
  iso: string;
}

export interface Photo {
  id: string;
  /** Untrusted text from the file system. Render as text only. */
  fileName: string;
  /** A rendered preview of the original, as a URL the webview can load. */
  previewUrl: string;
  /** Pixel size of the RAW file. */
  width: number;
  height: number;
  capture: CaptureInfo;
  /** The original first, then versions oldest to newest. */
  versions: Version[];
  /**
   * How many lettered versions this photo has ever had, including any since
   * discarded. The next version takes the letter after that, so a letter
   * and its id are never used twice.
   */
  versionsIssued: number;
  /** The version the person picked, if any. */
  pickId: string | null;
  /**
   * Versions the person dropped from the comparison, oldest first. They are
   * not deleted, and they stay out until the person restores them.
   */
  droppedIds: readonly string[];
}

export interface Shoot {
  /** Folder name. Untrusted text. */
  name: string;
  photos: Photo[];
}

export type AgentState = "working" | "waiting" | "error" | "done" | "disconnected";

export interface AgentStatus {
  /**
   * Name the MCP client reported, for example "Claude Code". Null until a
   * client has connected at least once; the interface then names nobody.
   */
  client: string | null;
  state: AgentState;
  /** A short line on what the state refers to. */
  detail: string;
}

/** Counts per tonal level, 256 bins each, for the displayed image. */
export interface HistogramData {
  luma: Uint32Array;
  red: Uint32Array;
  green: Uint32Array;
  blue: Uint32Array;
  /** Share of pixels at pure black and pure white, 0 to 1. */
  clippedLow: number;
  clippedHigh: number;
}

export type PageStatus = "empty" | "loading" | "ready";

/** Previews decoded so far while a folder opens. */
export interface LoadProgress {
  done: number;
  total: number;
}

/**
 * A place on a photo, as fractions of its width and height so it holds at
 * any zoom. A point is a region with no width and no height.
 */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isPoint(region: Region): boolean {
  return region.width === 0 && region.height === 0;
}

/**
 * Where a note stands. The agent is not told about notes as they are
 * written; it receives them when it next asks, so "waiting" can last.
 */
export type NoteState =
  | { kind: "waiting" }
  | { kind: "read" }
  | { kind: "addressed"; versionId: string }
  /** Something the agent pointed at that the person chose to keep. */
  | { kind: "kept" };

/** A short comment pinned to a region of one version. Not a conversation. */
export interface Note {
  id: string;
  /** Counted per photo, in the order notes were made. Shown on the marker. */
  number: number;
  versionId: string;
  region: Region;
  /** Untrusted when it comes from the agent. Render as text only. */
  text: string;
  author: Author;
  state: NoteState;
}

/** The agent drawing attention to a region. It fades unless kept as a note. */
export interface AgentPointer {
  id: number;
  versionId: string;
  region: Region;
  /** One line from the agent. Untrusted text. */
  caption: string;
  /** How long it stays before it has faded, in milliseconds. */
  lifetime: number;
}

/**
 * The agent asking Compare to look somewhere. The interface decides whether
 * to obey: it never does while a person is dragging.
 */
export interface AgentViewRequest {
  /** Goes up with each request, so the same request is not applied twice. */
  stamp: number;
  /** The photo the request is about. It is let go if another is on screen by then. */
  photoId: string;
  focusVersionId?: string;
  /** Centre of the view, as fractions of the photo. */
  centre?: { x: number; y: number };
  /** Zoom as a multiple of the size that fits the tile. */
  magnification?: number;
}

export const ORIGINAL_ID = "original";

export function isOriginal(version: Version): boolean {
  return version.parentId === null;
}
