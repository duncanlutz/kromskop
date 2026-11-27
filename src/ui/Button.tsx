import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;
  /** Keyboard shortcut, shown after the label. */
  keys?: string;
}

export function Button({ primary, keys, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={styles.button} data-primary={primary || undefined} {...rest}>
      {children}
      {keys && <span className={styles.keys}>{keys}</span>}
    </button>
  );
}
