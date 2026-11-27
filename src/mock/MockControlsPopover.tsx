/*
 * MOCK ONLY. A reviewer's panel for driving the mock: agent state, a scripted
 * agent edit, typeface, and the page's empty and loading states. Hidden until
 * M is pressed. It is not part of the product and goes away with the mock.
 */

import { useEffect, useState } from "react";
import type { AgentState, PageStatus } from "../model/types";
import { AGENT_STATE_LABELS } from "../shell/AgentIndicator";
import { TYPEFACES, usePrefs } from "../shell/Prefs";
import styles from "./MockControlsPopover.module.css";
import { useMockControls } from "./MockSession";

const TOGGLE_KEY = "m";

const AGENT_STATES: AgentState[] = ["working", "waiting", "error", "done", "disconnected"];
const PAGES: Array<{ id: PageStatus; label: string }> = [
  { id: "ready", label: "Photo open" },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "Empty (no folder)" },
];

export function MockControlsPopover() {
  const mock = useMockControls();
  const { typeface, setTypeface } = usePrefs();
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has("mock"));

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
        options={AGENT_STATES.map((id) => ({ id, label: AGENT_STATE_LABELS[id] }))}
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

      <Choice legend="Typeface" name="mock-typeface" options={TYPEFACES} value={typeface} onChange={setTypeface} />
      <Choice legend="Page state" name="mock-page" options={PAGES} value={mock.page} onChange={mock.setPage} />
    </aside>
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
