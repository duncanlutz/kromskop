import { X } from "@phosphor-icons/react";
import { useSession } from "../session/Session";
import { tabKeys } from "../ui/tabKeys";
import { Tooltip } from "../ui/Tooltip";
import { COMPARE_MODES, useCompare, useCompareView } from "./CompareState";
import styles from "./CompareBar.module.css";

/**
 * The line under the stage: how the versions are laid out, what the agent
 * is doing to the view, and the zoom. Nothing here sits over the photo.
 */
export function CompareBar() {
  const { agent, agentPointer, photo, keepAgentPointer, dismissAgentPointer } = useSession();
  const compare = useCompare();
  const { view, offsets, fitScale, fitAll } = useCompareView();

  const fitted = view.fit || view.scale <= fitScale * 1.002;
  const scale = fitted ? fitScale : view.scale;
  const percent = Math.round(scale * window.devicePixelRatio * 100);
  const movedAlone = Object.keys(offsets).length;
  const pointed = agentPointer ? photo?.versions.find((v) => v.id === agentPointer.versionId) : undefined;
  const client = agent.client ?? "The agent";

  return (
    <footer className={styles.bar}>
      <div
        className={styles.modes}
        role="tablist"
        aria-label="Layout"
        onKeyDown={tabKeys(
          COMPARE_MODES.map((option) => option.id),
          compare.mode,
          compare.setMode,
        )}
      >
        {COMPARE_MODES.map((option) => (
          <Tooltip key={option.id} label={option.hint} keys={option.key} side="top">
            <button
              type="button"
              role="tab"
              className={styles.mode}
              aria-selected={option.id === compare.mode}
              tabIndex={option.id === compare.mode ? 0 : -1}
              onClick={() => compare.setMode(option.id)}
            >
              {option.label}
            </button>
          </Tooltip>
        ))}
      </div>

      <div className={styles.agent}>
        {!(agentPointer && pointed) && compare.compared.length >= 2 && (
          <span className={styles.keys} aria-hidden="true">
            <span>
              <kbd>Space</kbd> swap the pair
            </span>
            <span>
              <kbd>Shift</kbd> move one tile alone
            </span>
            <span>
              <kbd>0</kbd> fit
            </span>
          </span>
        )}
        {agentPointer && pointed && (
          <>
            <span className={styles.pointing}>
              {client} on {pointed.letter || "the original"}
            </span>
            <span className={styles.caption} title={agentPointer.caption}>
              {agentPointer.caption}
            </span>
            <button type="button" className={styles.action} onClick={keepAgentPointer}>
              Keep as note
            </button>
            <button type="button" className={styles.dismiss} aria-label="Dismiss what the agent is pointing at" onClick={dismissAgentPointer}>
              <X size={16} />
            </button>
          </>
        )}
      </div>

      {compare.following && (
        <span className={styles.following} role="status">
          <span className={styles.followingDot} />
          Following agent
        </span>
      )}
      {compare.markersHidden && (
        <button type="button" className={styles.quiet} onClick={compare.toggleMarkers}>
          Notes hidden <kbd>H</kbd>
        </button>
      )}
      {movedAlone > 0 && (
        <Tooltip label="Bring every tile back to the same place" keys="0" side="top">
          <button type="button" className={styles.quiet} onClick={fitAll}>
            {movedAlone === 1 ? "1 tile moved alone" : `${movedAlone} tiles moved alone`}
          </button>
        </Tooltip>
      )}
      <Tooltip label={fitted ? "Click a tile for 100%" : "Fit to tile"} keys="0" side="top">
        <button type="button" className={`${styles.zoom} num`} onClick={fitAll} disabled={fitScale === 0}>
          <span>{fitted ? "Fit" : "Linked"}</span>
          {fitScale === 0 ? "" : `${percent}%`}
        </button>
      </Tooltip>
    </footer>
  );
}
