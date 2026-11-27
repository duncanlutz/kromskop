import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { useId, type ReactNode } from "react";
import styles from "./Group.module.css";

interface GroupProps {
  title: string;
  open: boolean;
  onToggle(): void;
  /** How many controls in the group differ from the parent version. */
  changed: number;
  /** Set while the agent has just changed something inside. */
  agentMark?: number;
  disabled?: boolean;
  children: ReactNode;
}

/** A collapsible set of adjustments. The header reports changes when closed. */
export function Group({ title, open, onToggle, changed, agentMark, disabled = false, children }: GroupProps) {
  const bodyId = useId();
  const expanded = open && !disabled;

  return (
    <section className={styles.group} data-disabled={disabled || undefined}>
      <h3 className={styles.heading}>
        <button
          type="button"
          className={styles.header}
          aria-expanded={expanded}
          // The body is not in the document while the group is closed.
          aria-controls={expanded ? bodyId : undefined}
          disabled={disabled}
          onClick={onToggle}
        >
          <span className={styles.caret}>{expanded ? <CaretDown size={16} /> : <CaretRight size={16} />}</span>
          <span className={styles.title}>{title}</span>
          {changed > 0 && (
            <span
              className={`${styles.changed} num`}
              data-agent-mark={agentMark === undefined ? undefined : agentMark % 2 === 0 ? "even" : "odd"}
              aria-label={`${changed} changed`}
            >
              <span className={styles.dot} />
              {changed}
            </span>
          )}
        </button>
      </h3>
      {expanded && (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      )}
    </section>
  );
}
