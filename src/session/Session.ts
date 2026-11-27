import { createContext, useContext } from "react";
import type { ParamId } from "../model/params";
import type { AgentStatus, HistogramData, LoadProgress, PageStatus, Photo, Shoot, Version } from "../model/types";

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

  /** The version of a photo that is, or would be, on screen. */
  shownVersion(photo: Photo): Version;

  openFolder(): void;
  selectPhoto(photoId: string): void;
  selectVersion(versionId: string): void;
  togglePick(versionId: string): void;
  /**
   * A person moves a slider. Versions are immutable, so the first change to
   * a version that is not their own working copy starts a new one.
   */
  setParam(id: ParamId, value: number): void;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession needs a session provider above it");
  return session;
}
