import { Popover } from "@base-ui/react/popover";
import { useRef } from "react";
import { useSession } from "../session/Session";
import { AgentIndicator, agentLabel } from "./AgentIndicator";
import styles from "./AgentStatusItem.module.css";

const HINTS: Record<string, string | null> = {
  working: null,
  waiting: "Pick a version or flip between them. The agent reads your picks and carries on.",
  error: "The full message is in the agent's own terminal.",
  done: null,
  disconnected: "Add Kromskop to your agent as an MCP server. It runs this command:",
};

export function AgentStatusItem() {
  const { agent } = useSession();
  const label = agentLabel(agent);
  const connected = agent.state !== "disconnected";
  // How the popover was opened decides where focus goes when it closes.
  const openedByPointer = useRef(false);

  return (
    <Popover.Root>
      <Popover.Trigger
        className={styles.item}
        data-state={agent.state}
        aria-label={agent.client ? `Agent: ${agent.client}, ${label}` : `Agent: ${label}`}
        onPointerDown={() => {
          openedByPointer.current = true;
        }}
        onKeyDown={() => {
          openedByPointer.current = false;
        }}
      >
        <AgentIndicator state={agent.state} />
        {agent.client && <span className={styles.client}>{agent.client}</span>}
        <span className={styles.state}>{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={8}>
          <Popover.Popup
            className={styles.popup}
            // Opened from the keyboard, focus returns to the trigger on
            // closing, as usual. Opened with a pointer, it is let go, so the
            // next Space reaches the page rather than opening this again.
            finalFocus={() => !openedByPointer.current}
          >
            {agent.client ? (
              <>
                <Popover.Title className={styles.title}>{agent.client}</Popover.Title>
                <p className={styles.connection}>{connected ? "Connected over MCP on this Mac" : "Not connected"}</p>
                <div className={styles.rule} />
                <div className={styles.status}>
                  <AgentIndicator state={agent.state} />
                  <div>
                    <p className={styles.statusLabel}>{label}</p>
                    <Popover.Description className={styles.detail}>{agent.detail}</Popover.Description>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Popover.Title className={styles.title}>{label}</Popover.Title>
                <Popover.Description className={styles.connection}>{agent.detail}</Popover.Description>
              </>
            )}
            {HINTS[agent.state] && <p className={styles.hint}>{HINTS[agent.state]}</p>}
            {!connected && <code className={`${styles.command} selectable`}>kromskop mcp</code>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
