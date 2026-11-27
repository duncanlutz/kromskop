import { Popover } from "@base-ui/react/popover";
import { useSession } from "../session/Session";
import { AGENT_STATE_LABELS, AgentIndicator } from "./AgentIndicator";
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
  const label = AGENT_STATE_LABELS[agent.state];
  const connected = agent.state !== "disconnected";

  return (
    <Popover.Root>
      <Popover.Trigger className={styles.item} data-state={agent.state} aria-label={`Agent: ${agent.client}, ${label}`}>
        <AgentIndicator state={agent.state} />
        <span className={styles.client}>{agent.client}</span>
        <span className={styles.state}>{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8}>
          <Popover.Popup className={styles.popup}>
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
            {HINTS[agent.state] && <p className={styles.hint}>{HINTS[agent.state]}</p>}
            {!connected && <code className={`${styles.command} selectable`}>kromskop mcp</code>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
