/*
 * Whose key is it? A handler on the window sees every key press, including
 * the ones a focused control is about to use. These say when to stand back.
 */

const ACTIVATED = 'button, a[href], summary, select, [role="button"], [role="tab"], [role="radio"], [role="option"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="link"]';
const ARROW_DRIVEN = '[role="slider"], [role="tab"], select, input[type="range"]';

function element(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

/** True when the target takes typed text, so every key belongs to it. */
export function isTextEntry(target: EventTarget | null): boolean {
  const el = element(target);
  if (!el) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  return !["button", "checkbox", "radio", "range", "submit", "reset", "color", "file", "image"].includes(type);
}

/**
 * True when a focused control will act on this key itself, so a shortcut
 * must not also fire: any key in a text field, Space and Enter on anything
 * that is pressed (buttons, links, tabs, options) unless it is the tab or
 * option already chosen, and the arrows and their relatives on controls
 * that move with them.
 */
export function belongsToControl(event: KeyboardEvent): boolean {
  const el = element(event.target);
  if (!el) return false;
  if (isTextEntry(el)) return true;
  if (event.key === " " || event.key === "Enter") {
    const control = el.closest(ACTIVATED);
    // Pressing the tab or option that is already chosen would do nothing,
    // so the key is free for the page: Space still swaps the pair with
    // focus resting on the current layout's tab.
    if (control?.matches('[role="tab"][aria-selected="true"], [role="radio"][aria-checked="true"]')) return false;
    return control !== null || el.tagName === "INPUT";
  }
  if (/^(Arrow|Home$|End$|Page)/.test(event.key) || event.key === "Delete" || event.key === "Backspace") {
    return el.closest(ARROW_DRIVEN) !== null;
  }
  return false;
}
