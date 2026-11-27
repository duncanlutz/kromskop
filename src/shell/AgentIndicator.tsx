import { Warning } from "@phosphor-icons/react";
import type { AgentState } from "../model/types";
import styles from "./AgentIndicator.module.css";

export const AGENT_STATE_LABELS: Record<AgentState, string> = {
  working: "Working",
  waiting: "Waiting for you",
  error: "Error",
  done: "Done",
  disconnected: "Disconnected",
};

/** A dot, a ring or, for an error, a warning sign. Never an avatar. */
export function AgentIndicator({ state }: { state: AgentState }) {
  return (
    <span className={styles.box} aria-hidden="true">
      {state === "error" ? <Warning size={16} /> : <span className={styles.mark} data-state={state} />}
    </span>
  );
}
