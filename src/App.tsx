import { useEffect, useState } from "react";
import { DevelopWorkspace } from "./develop/DevelopWorkspace";
import { MockControlsPopover } from "./mock/MockControlsPopover";
import { MockSessionProvider } from "./mock/MockSession";
import { PrefsProvider } from "./shell/Prefs";
import { StubView } from "./shell/StubView";
import { Toolbar } from "./shell/Toolbar";
import { VIEWS, type View } from "./shell/ViewSwitch";
import { TooltipProvider } from "./ui/Tooltip";
import styles from "./App.module.css";

export function App() {
  const [view, setView] = useState<View>("develop");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement) return;
      const match = VIEWS.find((option) => option.key.toLowerCase() === event.key.toLowerCase());
      if (match) setView(match.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <PrefsProvider>
      {/* The mock stands in for the engine and MCP server until they exist. */}
      <MockSessionProvider>
        <TooltipProvider delay={500}>
          <div className={styles.app}>
            <Toolbar view={view} onViewChange={setView} />
            {view === "develop" && <DevelopWorkspace />}
            {view === "library" && (
              <StubView name="Library" purpose="Every photo in the shoot as a grid, to sort, filter and choose what to develop." />
            )}
            {view === "compare" && (
              <StubView name="Compare" purpose="Two to six versions side by side with linked zoom, to pick one and pin comments." />
            )}
            <MockControlsPopover />
          </div>
        </TooltipProvider>
      </MockSessionProvider>
    </PrefsProvider>
  );
}
