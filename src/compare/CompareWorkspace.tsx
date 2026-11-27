import { useEffect } from "react";
import { Filmstrip } from "../develop/Filmstrip";
import { VersionStack } from "../develop/VersionStack";
import { Viewer } from "../develop/Viewer";
import { useSession } from "../session/Session";
import { belongsToControl } from "../ui/keys";
import { CompareBar } from "./CompareBar";
import { useCompare, useCompareView } from "./CompareState";
import { CompareStage } from "./CompareStage";
import styles from "./CompareWorkspace.module.css";
import { DifferencesPanel } from "./DifferencesPanel";

/**
 * The main screen: the versions of one photo, judged against each other.
 * Versions on the left, the comparison in the middle, what differs and the
 * person's notes on the right.
 */
export function CompareWorkspace() {
  const session = useSession();
  const compare = useCompare();
  const { fitAll } = useCompareView();
  const ready = session.status === "ready";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A focused control keeps its own keys: Space on a button presses the
      // button, it does not swap the pair.
      if (event.metaKey || event.ctrlKey || event.altKey || belongsToControl(event)) return;
      const { shoot, photo } = session;
      if (!ready || !shoot || !photo) return;
      const { compared, focus } = compare;
      const index = focus ? compared.findIndex((v) => v.id === focus.id) : -1;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key >= "1" && key <= "6") {
        const target = compared[Number(key) - 1];
        if (target) compare.focusVersion(target.id);
      } else if (key === "ArrowUp" || key === "ArrowDown") {
        const target = compared[index + (key === "ArrowDown" ? 1 : -1)];
        if (target) compare.focusVersion(target.id);
      } else if (key === "ArrowLeft" || key === "ArrowRight") {
        const at = shoot.photos.findIndex((p) => p.id === photo.id);
        const target = shoot.photos[at + (key === "ArrowLeft" ? -1 : 1)];
        if (target) session.selectPhoto(target.id);
      } else if (key === " ") {
        compare.swapPair();
      } else if (key === "x") {
        compare.dropFocused();
      } else if (key === "u") {
        compare.restoreLast();
      } else if (key === "p") {
        if (focus) session.togglePick(focus.id);
      } else if (key === "f") {
        compare.setMode(compare.mode === "flip" ? "grid" : "flip");
      } else if (key === "s") {
        compare.setMode(compare.mode === "split" ? "grid" : "split");
      } else if (key === "r") {
        compare.setMode(compare.mode === "reference" ? "grid" : "reference");
      } else if (key === "n") {
        compare.setNoteTool(!compare.noteTool);
      } else if (key === "h") {
        compare.toggleMarkers();
      } else if (key === "0") {
        fitAll();
      } else if (key === "t") {
        // Not Tab: that key has to keep moving focus between controls.
        compare.togglePanels();
      } else if (key === "Escape") {
        if (compare.noteTool || compare.draft) {
          compare.setNoteTool(false);
          compare.setDraft(null);
        } else {
          compare.setMode("grid");
        }
      } else {
        return;
      }
      // A key that Compare acts on takes the view back from the agent.
      compare.humanInput();
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session, compare, fitAll, ready]);

  const hidden = compare.panelsHidden && ready;

  return (
    <div
      className={styles.workspace}
      data-panels={hidden ? "hidden" : undefined}
      // The one place that ends following: anything the person does anywhere
      // in Compare, by pointer, wheel or key, takes the view back from the agent.
      onPointerDownCapture={compare.humanInput}
      onWheelCapture={compare.humanInput}
      onKeyDownCapture={compare.humanInput}
    >
      {!hidden && (
        <VersionStack
          comparison={{
            standing: compare.standing,
            message: compare.fullMessage,
            toggle: compare.toggleCompared,
            focus: compare.focusVersion,
            count: compare.compared.length,
          }}
        />
      )}
      {ready ? (
        <section className={styles.centre} aria-label="Comparison">
          <CompareStage />
          <CompareBar />
        </section>
      ) : (
        // No folder, or one still opening: the same states as Develop.
        <Viewer />
      )}
      {!hidden && <DifferencesPanel />}
      {!hidden && <Filmstrip />}
    </div>
  );
}
