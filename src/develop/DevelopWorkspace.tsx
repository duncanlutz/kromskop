import { useEffect } from "react";
import { ORIGINAL_ID } from "../model/types";
import { useSession } from "../session/Session";
import { AdjustPanel } from "./AdjustPanel";
import styles from "./DevelopWorkspace.module.css";
import { Filmstrip } from "./Filmstrip";
import { VersionStack } from "./VersionStack";
import { Viewer } from "./Viewer";

/** True when a key press belongs to a control rather than to the workspace. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.getAttribute("role") === "slider";
}

/** Versions on the left, the photo in the middle, adjustments on the right. */
export function DevelopWorkspace() {
  const session = useSession();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (session.status === "empty") session.openFolder();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const { shoot, photo, version } = session;
      if (session.status !== "ready" || !shoot || !photo || !version) return;

      // The stack lists the newest version first, so "up" means newer.
      const stack = [...photo.versions].reverse();
      const versionIndex = stack.findIndex((v) => v.id === version.id);
      const photoIndex = shoot.photos.findIndex((p) => p.id === photo.id);

      switch (event.key) {
        case "ArrowUp":
        case "ArrowDown": {
          const next = stack[versionIndex + (event.key === "ArrowUp" ? -1 : 1)];
          if (next) session.selectVersion(next.id);
          break;
        }
        case "ArrowLeft":
        case "ArrowRight": {
          const next = shoot.photos[photoIndex + (event.key === "ArrowLeft" ? -1 : 1)];
          if (next) session.selectPhoto(next.id);
          break;
        }
        case "p":
        case "P":
          session.togglePick(version.id);
          break;
        case "\\": {
          // Flip to the original, and back to the pick or else the newest version.
          const newest = stack[0];
          session.selectVersion(version.id === ORIGINAL_ID && newest ? (photo.pickId ?? newest.id) : ORIGINAL_ID);
          break;
        }
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session]);

  return (
    <div className={styles.workspace}>
      <VersionStack />
      <Viewer />
      <AdjustPanel />
      <Filmstrip />
    </div>
  );
}
