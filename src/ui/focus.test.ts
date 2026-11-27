// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isPressedOnly, releaseFocusAfterClick, releaseFocusOnEscape } from "./focus";

beforeEach(() => {
  window.addEventListener("click", releaseFocusAfterClick);
  window.addEventListener("keydown", releaseFocusOnEscape);
});

afterEach(() => {
  window.removeEventListener("click", releaseFocusAfterClick);
  window.removeEventListener("keydown", releaseFocusOnEscape);
  document.body.innerHTML = "";
});

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  const element = document.body.firstElementChild as HTMLElement;
  element.focus();
  return element;
}

const click = (element: Element, detail: number) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
const escape = (element: Element) => element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

describe("after a pointer click", () => {
  it("a button gives focus back", () => {
    const button = mount("<button>Fit</button>");
    expect(document.activeElement).toBe(button);
    click(button, 1);
    expect(document.activeElement).toBe(document.body);
  });

  it("a tab gives focus back, so the page's shortcuts work again", () => {
    const tab = mount('<div role="tab" tabindex="0">Flip</div>');
    click(tab, 1);
    expect(document.activeElement).toBe(document.body);
  });

  it("a click on something inside the control counts", () => {
    const button = mount("<button><span>Pick</span></button>");
    click(button.querySelector("span")!, 1);
    expect(document.activeElement).toBe(document.body);
  });

  it("a slider keeps focus, because the arrows are then meant for it", () => {
    const slider = mount('<div role="slider" tabindex="0"></div>');
    click(slider, 1);
    expect(document.activeElement).toBe(slider);
  });

  it("a text field keeps focus", () => {
    const field = mount('<input type="text">');
    click(field, 1);
    expect(document.activeElement).toBe(field);
  });

  it("leaves focus alone when it has moved somewhere else", () => {
    document.body.innerHTML = '<button id="a">Open</button><input id="b" type="text">';
    const field = document.getElementById("b")!;
    field.focus();
    click(document.getElementById("a")!, 1);
    expect(document.activeElement).toBe(field);
  });
});

describe("after keyboard activation", () => {
  it("a button keeps focus, so it can be pressed again", () => {
    const button = mount("<button>Add a note</button>");
    // Space and Return produce a click with detail 0.
    click(button, 0);
    expect(document.activeElement).toBe(button);
  });
});

describe("Escape", () => {
  it("lets go of a button, a tab and a slider", () => {
    for (const html of ["<button>Fit</button>", '<div role="tab" tabindex="0">Flip</div>', '<div role="slider" tabindex="0"></div>']) {
      const control = mount(html);
      escape(control);
      expect(document.activeElement).toBe(document.body);
    }
  });

  it("leaves a text field to cancel its own edit", () => {
    const field = mount('<input type="text">');
    escape(field);
    expect(document.activeElement).toBe(field);
  });
});

describe("isPressedOnly", () => {
  it("tells pressed controls from the ones that keep the keyboard", () => {
    document.body.innerHTML = '<button id="a"></button><input id="b" type="range"><input id="c" type="checkbox"><div id="d" role="slider"></div>';
    expect(isPressedOnly(document.getElementById("a"))).toBe(true);
    expect(isPressedOnly(document.getElementById("b"))).toBe(false);
    expect(isPressedOnly(document.getElementById("c"))).toBe(false);
    expect(isPressedOnly(document.getElementById("d"))).toBe(false);
    expect(isPressedOnly(null)).toBe(false);
  });
});
