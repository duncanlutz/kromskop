/*
 * MOCK ONLY. A reviewer's panel for driving the mock: agent state, scripted
 * agent actions, the page's empty and loading states, and what Compare
 * shows. Hidden until M is pressed. It is not part of the product and goes
 * away with the mock.
 */

import { useEffect, useState } from "react";
import type { AgentState, PageStatus } from "../model/types";
import { COMPARE_MODES, useCompare } from "../compare/CompareState";
import { startupOptions } from "../platform/query";
import { AGENT_STATE_LABELS } from "../shell/AgentIndicator";
import { useView } from "../shell/ViewState";
import styles from "./MockControlsPopover.module.css";
import { useMockControls } from "./MockSession";

const TOGGLE_KEY = "m";

const AGENT_STATES: Array<{ id: AgentState | "never"; label: string }> = [
  { id: "working", label: AGENT_STATE_LABELS.working },
  { id: "waiting", label: AGENT_STATE_LABELS.waiting },
  { id: "error", label: AGENT_STATE_LABELS.error },
  { id: "done", label: AGENT_STATE_LABELS.done },
  { id: "disconnected", label: "Disconnected (was connected)" },
  { id: "never", label: "Never connected" },
];
const PAGES: Array<{ id: PageStatus; label: string }> = [
  { id: "ready", label: "Photo open" },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "Empty (no folder)" },
];

export function MockControlsPopover() {
  const mock = useMockControls();
  const compare = useCompare();
  const { view, setView } = useView();
  const comparing = view === "compare" && mock.page === "ready";
  const [open, setOpen] = useState(() => startupOptions().has("mock"));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement && event.target.type === "text") return;
      if (event.key.toLowerCase() === TOGGLE_KEY) setOpen((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <aside className={styles.popover} aria-label="Mock controls">
      <header className={styles.header}>
        <h2 className={styles.title}>Mock controls</h2>
        <span className={styles.note}>Not part of the app. Press M to hide.</span>
      </header>

      <Choice
        legend="Agent state"
        name="mock-agent"
        options={AGENT_STATES}
        value={mock.agentState}
        onChange={mock.setAgentState}
      />

      <div className={styles.section}>
        <button
          type="button"
          className={styles.action}
          disabled={mock.agentEditRunning || mock.page !== "ready"}
          onClick={mock.runAgentEdit}
        >
          {mock.agentEditRunning ? "Agent is editing…" : "Play: agent edits three sliders"}
        </button>
      </div>

      <Choice legend="Page state" name="mock-page" options={PAGES} value={mock.page} onChange={mock.setPage} />

      <div className={styles.section}>
        <p className={styles.legend}>Compare</p>
        <Segments
          label="Versions"
          options={[2, 3, 4, 5, 6].map((n) => ({ id: String(n), label: String(n) }))}
          value={String(mock.versionCount)}
          onChange={(count) => {
            mock.setVersionCount(Number(count));
            setView("compare");
          }}
        />
        <Segments
          label="Mode"
          options={COMPARE_MODES}
          value={compare.mode}
          onChange={(mode) => {
            compare.setMode(mode);
            setView("compare");
          }}
        />
        <button type="button" className={styles.action} disabled={!comparing} onClick={mock.agentPoints}>
          Agent points at a region
        </button>
        <button type="button" className={styles.action} disabled={!comparing || mock.waitingNotes === 0} onClick={mock.agentReadsNotes}>
          Agent reads the notes
        </button>
        <button
          type="button"
          className={styles.action}
          disabled={!comparing || mock.openNoteNumber === null}
          onClick={mock.agentAddressesNote}
        >
          {mock.openNoteNumber === null
            ? "Agent addresses a note (none open)"
            : `Agent addresses note ${mock.openNoteNumber} with a new version`}
        </button>
        <label className={styles.option}>
          <input type="checkbox" checked={mock.holdRendering} onChange={(event) => mock.setHoldRendering(event.currentTarget.checked)} />
          <span className={styles.check} />
          Tiles still rendering
        </label>
      </div>
    </aside>
  );
}

interface SegmentsProps<T extends string> {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange(value: T): void;
}

/** A row of small buttons for a choice that should not cost a line each. */
function Segments<T extends string>({ label, options, value, onChange }: SegmentsProps<T>) {
  return (
    <div className={styles.segments} role="radiogroup" aria-label={label}>
      <span className={styles.segmentsLabel}>{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          className={styles.segment}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface ChoiceProps<T extends string> {
  legend: string;
  name: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange(value: T): void;
}

function Choice<T extends string>({ legend, name, options, value, onChange }: ChoiceProps<T>) {
  return (
    <div className={styles.section} role="radiogroup" aria-label={legend}>
      <p className={styles.legend}>{legend}</p>
      {options.map((option) => (
        <label key={option.id} className={styles.option}>
          <input
            type="radio"
            name={name}
            checked={option.id === value}
            onChange={() => onChange(option.id)}
          />
          <span className={styles.radio} />
          {option.label}
        </label>
      ))}
    </div>
  );
}
