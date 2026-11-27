import { windowControls } from "../platform/window";
import { useSession } from "../session/Session";
import { AgentStatusItem } from "./AgentStatusItem";
import { SurroundControl } from "./SurroundControl";
import styles from "./Toolbar.module.css";
import { ViewSwitch, type View } from "./ViewSwitch";

/**
 * Runs through the title-bar area. On macOS the window controls are drawn
 * over its left end, and every empty part of it drags the window.
 */
export function Toolbar({ view, onViewChange }: { view: View; onViewChange(view: View): void }) {
  const { shoot, photo } = useSession();
  const index = shoot && photo ? shoot.photos.findIndex((p) => p.id === photo.id) : -1;

  return (
    <header className={styles.toolbar} data-window-controls={windowControls} data-tauri-drag-region>
      {windowControls === "stand-in" && (
        <div className={styles.standIn} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      <div className={styles.title} data-tauri-drag-region>
        {shoot ? (
          <>
            <span className={styles.folder} data-tauri-drag-region>
              {shoot.name}
            </span>
            {photo && (
              <>
                <span className={styles.separator} data-tauri-drag-region>
                  /
                </span>
                <span className={styles.file} data-tauri-drag-region>
                  {photo.fileName}
                </span>
                <span className={`${styles.count} num`} data-tauri-drag-region>
                  {index + 1} of {shoot.photos.length}
                </span>
              </>
            )}
          </>
        ) : (
          <span className={styles.file} data-tauri-drag-region>
            Kromskop
          </span>
        )}
      </div>

      <div className={styles.centre}>
        <ViewSwitch view={view} onChange={onViewChange} />
      </div>

      <div className={styles.right} data-tauri-drag-region>
        <SurroundControl />
        <span className={styles.divider} />
        <AgentStatusItem />
      </div>
    </header>
  );
}
