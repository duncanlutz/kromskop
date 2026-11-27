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
  /** The version the person picked, if any. */
  pickId: string | null;
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

export const ORIGINAL_ID = "original";

export function isOriginal(version: Version): boolean {
  return version.parentId === null;
}
