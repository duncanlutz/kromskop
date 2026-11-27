import { AgentIndicator, agentLabel } from "../shell/AgentIndicator";
import { useSession } from "../session/Session";
import { Button } from "../ui/Button";
import styles from "./EmptyState.module.css";

/** No folder is open. Says what to do, what will happen, and where the agent stands. */
export function EmptyState() {
  const { agent, openFolder } = useSession();
  const connected = agent.state !== "disconnected";

  return (
    <div className={styles.empty}>
      <h1 className={styles.heading}>No folder open</h1>
      <p className={styles.lead}>
        Open a folder of RAW files to begin. Kromskop reads the originals and never changes them; edits are kept
        in a <span className={styles.path}>.kromskop</span> folder beside the photos.
      </p>
      <div className={styles.actions}>
        <Button primary keys="⌘O" onClick={openFolder}>
          Open folder…
        </Button>
      </div>

      <div className={styles.agent}>
        <AgentIndicator state={agent.state} />
        <div>
          <p className={styles.agentLine}>
            {agent.client && <span className={styles.client}>{agent.client}</span>}
            <span>{agent.client && !connected ? "Not connected" : agentLabel(agent)}</span>
          </p>
          <p className={styles.agentNote}>
            {connected ? (
              "Your agent works on the folder you open here. It cannot reach anything else on this Mac."
            ) : (
              <>
                Your agent works on the folder you open here. To connect one, add Kromskop to it as an MCP server
                that runs <code className={`${styles.command} selectable`}>kromskop mcp</code>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
