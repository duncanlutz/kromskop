import { Warning } from "@phosphor-icons/react";
import type { AgentState, AgentStatus } from "../model/types";
import styles from "./AgentIndicator.module.css";

export const AGENT_STATE_LABELS: Record<AgentState, string> = {
  working: "Working",
  waiting: "Waiting for you",
  error: "Error",
  done: "Done",
  disconnected: "Disconnected",
};

/**
 * The state in words. A client that has never connected is not "disconnected":
 * there is nobody to name yet.
 */
export function agentLabel(agent: AgentStatus): string {
  return agent.client === null ? "No agent connected" : AGENT_STATE_LABELS[agent.state];
}

/** A dot, a ring or, for an error, a warning sign. Never an avatar. */
export function AgentIndicator({ state }: { state: AgentState }) {
  return (
    <span className={styles.box} aria-hidden="true">
      {state === "error" ? <Warning size={16} /> : <span className={styles.mark} data-state={state} />}
    </span>
  );
}
