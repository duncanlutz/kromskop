import { lazy, Suspense, useEffect } from "react";
import { CompareProvider } from "./compare/CompareState";
import { CompareWorkspace } from "./compare/CompareWorkspace";
import { DevelopWorkspace } from "./develop/DevelopWorkspace";
import { MockSessionProvider } from "./mock/MockSession";
import { PrefsProvider } from "./shell/Prefs";
import { StubView } from "./shell/StubView";
import { Toolbar } from "./shell/Toolbar";
import { ViewProvider, useView } from "./shell/ViewState";
import { VIEWS } from "./shell/ViewSwitch";
import { TooltipProvider } from "./ui/Tooltip";
import styles from "./App.module.css";

/*
 * The reviewer's panel for driving the mock. It is loaded in development
 * only: in a release build this is null and the module is never bundled.
 */
const MockControlsPopover = import.meta.env.DEV
  ? lazy(() => import("./mock/MockControlsPopover").then((module) => ({ default: module.MockControlsPopover })))
  : null;

export function App() {
  return (
    <PrefsProvider>
      <ViewProvider>
        {/* The mock stands in for the engine and MCP server until they exist. */}
        <MockSessionProvider>
          <CompareProvider>
            <TooltipProvider delay={500}>
              <Shell />
            </TooltipProvider>
          </CompareProvider>
        </MockSessionProvider>
      </ViewProvider>
    </PrefsProvider>
  );
}

function Shell() {
  const { view, setView } = useView();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement) return;
      const match = VIEWS.find((option) => option.key.toLowerCase() === event.key.toLowerCase());
      if (match) setView(match.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setView]);

  return (
    <div className={styles.app}>
      <Toolbar view={view} onViewChange={setView} />
      {view === "develop" && <DevelopWorkspace />}
      {view === "compare" && <CompareWorkspace />}
      {view === "library" && (
        <StubView name="Library" purpose="Every photo in the shoot as a grid, to sort, filter and choose what to develop." />
      )}
      {MockControlsPopover && (
        <Suspense fallback={null}>
          <MockControlsPopover />
        </Suspense>
      )}
    </div>
  );
}
