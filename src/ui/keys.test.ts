// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { belongsToControl, isTextEntry } from "./keys";

function press(html: string, key: string, selector?: string): boolean {
  document.body.innerHTML = html;
  const target = selector ? document.querySelector(selector)! : document.body.firstElementChild!;
  let result = false;
  const listener = (event: KeyboardEvent) => {
    result = belongsToControl(event);
  };
  window.addEventListener("keydown", listener);
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  window.removeEventListener("keydown", listener);
  return result;
}

describe("belongsToControl", () => {
  it("leaves Space and Enter to anything that is pressed", () => {
    expect(press("<button>Add a note</button>", " ")).toBe(true);
    expect(press("<button>Add a note</button>", "Enter")).toBe(true);
    expect(press('<div role="tab" tabindex="0">Develop</div>', " ")).toBe(true);
    expect(press('<a href="#x">link</a>', "Enter")).toBe(true);
    expect(press('<div role="option" tabindex="0">photo</div>', " ")).toBe(true);
    expect(press('<input type="checkbox">', " ")).toBe(true);
  });

  it("gives Space and Enter back to the page on the tab or option that is already chosen", () => {
    expect(press('<div role="tab" aria-selected="true" tabindex="0">Flip</div>', " ")).toBe(false);
    expect(press('<div role="tab" aria-selected="true" tabindex="0">Flip</div>', "Enter")).toBe(false);
    expect(press('<button role="radio" aria-checked="true">Picks</button>', " ")).toBe(false);
    // One that is not chosen still gets the key, so a keyboard user can choose it.
    expect(press('<div role="tab" aria-selected="false" tabindex="0">Split</div>', " ")).toBe(true);
    expect(press('<button role="radio" aria-checked="false">Original</button>', "Enter")).toBe(true);
  });

  it("counts a press on something inside a button as the button's", () => {
    expect(press("<button><span>Pick</span></button>", " ", "span")).toBe(true);
  });

  it("lets letter and digit shortcuts through when a button has focus", () => {
    expect(press("<button>Add a note</button>", "x")).toBe(false);
    expect(press("<button>Add a note</button>", "3")).toBe(false);
    expect(press("<button>Add a note</button>", "Escape")).toBe(false);
  });

  it("leaves every key to a text field", () => {
    expect(press('<input type="text">', "x")).toBe(true);
    expect(press('<input type="text">', " ")).toBe(true);
    expect(press("<textarea></textarea>", "ArrowLeft")).toBe(true);
  });

  it("leaves the arrows to sliders and tabs, but not to buttons", () => {
    expect(press('<div role="slider" tabindex="0"></div>', "ArrowLeft")).toBe(true);
    expect(press('<div role="slider" tabindex="0"></div>', "Delete")).toBe(true);
    expect(press('<div role="tab" tabindex="0"></div>', "ArrowRight")).toBe(true);
    expect(press('<input type="range">', "ArrowRight")).toBe(true);
    expect(press("<button>Fit</button>", "ArrowLeft")).toBe(false);
  });

  it("claims nothing when no control has focus", () => {
    expect(press("<div>photo</div>", " ")).toBe(false);
    expect(press("<div>photo</div>", "Enter")).toBe(false);
  });
});

describe("isTextEntry", () => {
  it("tells text fields from other inputs", () => {
    document.body.innerHTML = '<input type="text" id="a"><input type="range" id="b"><input type="checkbox" id="c">';
    expect(isTextEntry(document.getElementById("a"))).toBe(true);
    expect(isTextEntry(document.getElementById("b"))).toBe(false);
    expect(isTextEntry(document.getElementById("c"))).toBe(false);
  });
});
