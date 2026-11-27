/*
 * Keyboard focus that a mouse click left behind.
 *
 * A click on a button, tab or chip leaves focus on it in some browsers.
 * The next key then belongs to that control: Space presses it again and the
 * arrows walk its row, where the person expected the page's own shortcuts.
 * So a control that was clicked with a pointer gives focus back, as buttons
 * do in a desktop app. A control reached with the keyboard keeps it, and can
 * still be activated with Space or Return. Escape lets go of any control.
 */

const PRESSED = 'button, a[href], summary, [role="button"], [role="tab"], [role="radio"], [role="option"], [role="checkbox"], [role="switch"]';
const TAKES_TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]), textarea, select, [contenteditable="true"]';
/** Controls a person clicks in order to then use the keyboard on them. */
const KEEPS_FOCUS = `${TAKES_TEXT}, [role="slider"], input[type="range"]`;

/** True for a control that is only pressed, so focus on it after a click serves nothing. */
export function isPressedOnly(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.matches(PRESSED) && !element.matches(KEEPS_FOCUS);
}

/** A click handler for the window: a pointer click on a pressed control gives focus back. */
export function releaseFocusAfterClick(event: MouseEvent): void {
  // detail is 0 when a click comes from Space or Return: that person is using the keyboard.
  if (event.detail === 0) return;
  const focused = document.activeElement;
  if (isPressedOnly(focused) && event.target instanceof Node && focused.contains(event.target)) focused.blur();
}

/** A keydown handler for the window: Escape lets go of whatever control has focus. */
export function releaseFocusOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  const focused = document.activeElement;
  // A text field deals with Escape itself, by cancelling what was typed.
  if (focused instanceof HTMLElement && focused !== document.body && !focused.matches(TAKES_TEXT)) focused.blur();
}
