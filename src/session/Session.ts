import { createContext, useContext, type ComponentType, type CSSProperties } from "react";
import type { ParamId } from "../model/params";
import type {
  AgentPointer,
  AgentStatus,
  AgentViewRequest,
  HistogramData,
  LoadProgress,
  Note,
  PageStatus,
  Photo,
  Region,
  Shoot,
  Version,
} from "../model/types";

/** What the interface says when it wants a version of a photo drawn. */
export interface PreviewProps {
  photo: Photo;
  version: Version;
  /** A small rendering, for the filmstrip and grids, or the full preview. */
  size?: "full" | "thumbnail";
  /** For assistive technology. Empty when a label beside it already names the photo. */
  alt: string;
  className?: string;
  style?: CSSProperties;
}

/** What Compare says when it wants a version's pixels to zoom and pan. */
export interface PixelsProps {
  photo: Photo;
  version: Version;
  className?: string;
  /** Compare lays the surface out once and then only transforms it. */
  style?: CSSProperties;
}

/**
 * Everything the interface reads and every action it can take.
 *
 * The interface talks to this and nothing else. Today a mock in `src/mock`
 * provides it; the engine and MCP server will replace that provider without
 * the components changing.
 */
export interface Session {
  status: PageStatus;
  progress: LoadProgress | null;
  shoot: Shoot | null;
  photo: Photo | null;
  version: Version | null;
  /** The version the current one was made from; null for the original. */
  parent: Version | null;
  agent: AgentStatus;
  /**
   * Adjustments the agent changed most recently, each with a counter that
   * goes up on every change so a row can mark it again.
   */
  agentTouched: Readonly<Partial<Record<ParamId, number>>>;
  histogram: HistogramData | null;
  /**
   * Draws a version of a photo. The session supplies the component, so no
   * part of the interface knows how the pixels are made.
   */
  Preview: ComponentType<PreviewProps>;
  /**
   * A version at the preview's full resolution, on a surface that can be
   * scaled and moved freely without being drawn again.
   */
  Pixels: ComponentType<PixelsProps>;

  /** Notes on the current photo, oldest first. */
  notes: readonly Note[];
  /** What the agent is pointing at on the current photo, if anything. */
  agentPointer: AgentPointer | null;
  /** The agent's latest request to move the Compare view. */
  agentView: AgentViewRequest | null;
  /** Versions of the current photo whose pixels are not ready yet. */
  rendering: ReadonlySet<string>;

  /** The version of a photo that is, or would be, on screen. */
  shownVersion(photo: Photo): Version;

  openFolder(): void;
  selectPhoto(photoId: string): void;
  selectVersion(versionId: string): void;
  togglePick(versionId: string): void;
  /** Takes a version of the current photo out of the comparison, or puts it back. */
  setDropped(versionId: string, dropped: boolean): void;
  /**
   * Brackets one gesture on the adjustments: a drag, a held key, a stay in
   * a number field. Between the two, `setParam` moves what is shown but
   * creates, discards and renames nothing; the version rules are applied
   * once, at the commit. `version` and `parent` describe the edit in
   * progress meanwhile.
   */
  beginEdit(): void;
  commitEdit(): void;
  /**
   * A person moves a slider. Versions are immutable, so the first change to
   * a version that is not their own working copy starts a new one. Outside
   * a gesture this is an edit of its own, committed at once.
   */
  setParam(id: ParamId, value: number): void;

  /** Pins a note to a region of a version. The agent reads it when it next asks. */
  addNote(versionId: string, region: Region, text: string): void;
  removeNote(noteId: string): void;
  /** Turns what the agent is pointing at into a note, so it does not fade. */
  keepAgentPointer(): void;
  dismissAgentPointer(): void;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession needs a session provider above it");
  return session;
}
