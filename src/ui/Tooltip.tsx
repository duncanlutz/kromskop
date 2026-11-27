import { Tooltip as Base } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";
import styles from "./Tooltip.module.css";

interface TooltipProps {
  label: string;
  /** Keyboard shortcut, shown after the label. */
  keys?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement<Record<string, unknown>>;
}

export const TooltipProvider = Base.Provider;

export function Tooltip({ label, keys, side = "bottom", children }: TooltipProps) {
  return (
    <Base.Root>
      <Base.Trigger render={children} />
      <Base.Portal>
        <Base.Positioner side={side} sideOffset={6} collisionPadding={8}>
          <Base.Popup className={styles.popup}>
            {label}
            {keys && <span className={styles.keys}>{keys}</span>}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
