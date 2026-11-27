import { Tooltip } from "../ui/Tooltip";
import styles from "./ViewSwitch.module.css";

export type View = "library" | "develop" | "compare";

export const VIEWS: Array<{ id: View; label: string; key: string }> = [
  { id: "library", label: "Library", key: "G" },
  { id: "develop", label: "Develop", key: "D" },
  { id: "compare", label: "Compare", key: "C" },
];

export function ViewSwitch({ view, onChange }: { view: View; onChange(view: View): void }) {
  return (
    <div className={styles.switch} role="tablist" aria-label="View">
      {VIEWS.map((option) => (
        <Tooltip key={option.id} label={option.label} keys={option.key}>
          <button
            type="button"
            role="tab"
            aria-selected={option.id === view}
            className={styles.option}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
