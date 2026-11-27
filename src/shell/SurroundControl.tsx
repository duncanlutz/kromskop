import { Tooltip } from "../ui/Tooltip";
import { SURROUNDS, usePrefs } from "./Prefs";
import styles from "./SurroundControl.module.css";

/** Five neutral chips. The one in use carries a light ring. */
export function SurroundControl() {
  const { surround, setSurround } = usePrefs();

  return (
    <div className={styles.group} role="radiogroup" aria-label="Surround">
      <span className={styles.caption}>Surround</span>
      {SURROUNDS.map((option) => (
        <Tooltip key={option.id} label={`${option.label} surround`}>
          <button
            type="button"
            role="radio"
            aria-checked={option.id === surround.id}
            aria-label={`${option.label} surround`}
            className={styles.option}
            onClick={() => setSurround(option.id)}
          >
            <span className={styles.chip} style={{ background: option.colour }} data-frame={option.frame || undefined} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
