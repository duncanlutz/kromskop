import type { KeyboardEvent } from "react";

/**
 * Keys for a row of tabs, as the ARIA tabs pattern expects: Left and Right
 * move to the neighbouring tab and select it, Home and End go to the ends.
 * Give the handler to the element with role="tablist", and give every tab
 * tabIndex 0 when selected and -1 otherwise, so Tab enters the row once.
 */
export function tabKeys<T>(ids: readonly T[], selected: T, select: (id: T) => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    const at = ids.indexOf(selected);
    const last = ids.length - 1;
    let next: number;
    if (event.key === "ArrowRight") next = at >= last ? 0 : at + 1;
    else if (event.key === "ArrowLeft") next = at <= 0 ? last : at - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;

    // The arrows belong to the tabs here, not to whatever the page does with them.
    event.preventDefault();
    event.stopPropagation();
    const id = ids[next];
    if (id === undefined) return;
    select(id);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };
}
