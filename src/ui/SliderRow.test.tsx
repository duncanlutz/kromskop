// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ALL_PARAMS, paramDef, type ParamId } from "../model/params";
import type { Author, Params, Photo, Version } from "../model/types";
import { beginEdit, changeParam, commitEdit, editParam, previewEdit, resetValue, type Edit } from "../model/versions";
import { SliderRow } from "./SliderRow";

const contrast = paramDef("contrast");

/** A track 200 px wide starting at x = 100, so positions are easy to reason about. */
const TRACK = { left: 100, width: 200 };
/** Screen x of a value on the Contrast track, which runs from -100 to 100. */
const xOf = (value: number) => TRACK.left + ((value + 100) / 200) * TRACK.width;

beforeAll(() => {
  // jsdom lays nothing out and has no pointer capture.
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { left: TRACK.left, top: 0, right: TRACK.left + TRACK.width, bottom: 24, width: TRACK.width, height: 24, x: TRACK.left, y: 0, toJSON: () => ({}) };
  };
});

afterEach(cleanup);

const slider = () => screen.getByRole("slider", { name: "Contrast" });
const field = () => screen.getByRole("textbox", { name: "Contrast value" });

describe("the number field", () => {
  function setup() {
    const onChange = vi.fn();
    render(<SliderRow def={contrast} value={14} parentValue={0} onChange={onChange} />);
    return onChange;
  }

  it("cancels on Escape and leaves the value alone", async () => {
    const onChange = setup();
    await userEvent.click(field());
    await userEvent.keyboard("55{Escape}");
    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveProperty("value", "+14");
    expect(document.activeElement).not.toBe(field());
  });

  it("commits once on Enter", async () => {
    const onChange = setup();
    await userEvent.click(field());
    await userEvent.keyboard("55{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(55);
  });

  it("commits when focus leaves", async () => {
    const onChange = setup();
    await userEvent.click(field());
    await userEvent.keyboard("-20");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(-20);
  });

  it("ignores text it cannot read", async () => {
    const onChange = setup();
    await userEvent.click(field());
    await userEvent.keyboard("warm{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits a later edit after an earlier one was cancelled", async () => {
    const onChange = setup();
    await userEvent.click(field());
    await userEvent.keyboard("55{Escape}");
    await userEvent.click(field());
    await userEvent.keyboard("30{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(30);
  });
});

describe("the track", () => {
  function setup(value = 14, parentValue: number | null = 0) {
    const onChange = vi.fn();
    render(<SliderRow def={contrast} value={value} parentValue={parentValue} onChange={onChange} />);
    return onChange;
  }

  it("does not move on a press alone", () => {
    const onChange = setup();
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(60) });
    fireEvent.pointerUp(slider(), { clientX: xOf(60) });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not move until the pointer has travelled the drag threshold", () => {
    const onChange = setup();
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(60) });
    fireEvent.pointerMove(slider(), { clientX: xOf(60) + 1 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(slider(), { clientX: xOf(60) + 4 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("brings the value to the pointer once dragged from away from the thumb", () => {
    const onChange = setup();
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(60) });
    fireEvent.pointerMove(slider(), { clientX: xOf(70) });
    expect(onChange).toHaveBeenLastCalledWith(70);
  });

  it("drags from the thumb without a jump", () => {
    const onChange = setup();
    // Two pixels off the thumb is still a grab of the thumb.
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(14) + 2 });
    fireEvent.pointerMove(slider(), { clientX: xOf(14) + 12 });
    expect(onChange).toHaveBeenLastCalledWith(24);
  });

  it("steps with the arrow keys, and further with Shift", async () => {
    const onChange = setup();
    slider().focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(15);
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it("resets to the parent's value on Delete", async () => {
    const onChange = setup(14, 3);
    slider().focus();
    await userEvent.keyboard("{Delete}");
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("resets on a double-click, without moving first", async () => {
    const onChange = setup(14, 3);
    await userEvent.dblClick(slider());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("has nothing to reset to on the original", async () => {
    const onChange = setup(0, null);
    await userEvent.dblClick(slider());
    slider().focus();
    await userEvent.keyboard("{Delete}");
    expect(onChange).not.toHaveBeenCalled();
  });
});

/* ---------- the slider wired to the version rules, as the app wires it ---------- */

const AGENT: Author = { kind: "agent", client: "Test Agent" };
const YOU: Author = { kind: "you" };

function params(overrides: Partial<Record<ParamId, number>> = {}): Params {
  const all = {} as Record<ParamId, number>;
  for (const def of ALL_PARAMS) all[def.id] = def.neutral;
  return { ...all, ...overrides };
}

function version(id: string, letter: string, parentId: string | null, author: Author | null, overrides = {}): Version {
  return { id, letter, name: letter || "Original", author, rationale: null, parentId, params: params(overrides), seen: true };
}

/** original → A (agent, contrast +14) → B (you, contrast +14 and shadows +10) */
function photo(): Photo {
  return {
    id: "p1",
    versions: [
      version("original", "", null, null),
      version("p1-a", "A", "original", AGENT, { contrast: 14 }),
      version("p1-b", "B", "p1-a", YOU, { contrast: 14, shadows: 10 }),
    ],
    pickId: null,
  } as unknown as Photo;
}

/** One Contrast slider on one version, changing the photo through the model. */
function Harness({ start, param = "contrast" }: { start: string; param?: ParamId }) {
  const [state, setState] = useState({ photo: photo(), shown: start });
  const shown = state.photo.versions.find((v) => v.id === state.shown)!;
  const def = paramDef(param);
  return (
    <>
      <SliderRow
        def={def}
        name="Contrast"
        value={shown.params[param]}
        parentValue={shown.parentId === null ? null : resetValue(state.photo, shown, param)}
        onChange={(value) => {
          const change = changeParam(state.photo, state.shown, param, value, YOU, { name: "Adjusted" });
          setState({ photo: change.photo, shown: change.versionId });
        }}
      />
      <output data-testid="shown">{state.shown}</output>
      <output data-testid="versions">{state.photo.versions.map((v) => v.id).join(" ")}</output>
    </>
  );
}

const shown = () => screen.getByTestId("shown").textContent;
const versions = () => screen.getByTestId("versions").textContent;

describe("reset, with the version rules behind the slider", () => {
  it("starts a version when an agent's version is reset by a clean double-click", async () => {
    render(<Harness start="p1-a" />);
    await userEvent.dblClick(slider());
    // A's contrast went back to the original's 0: that is a change to A, so it is a new version.
    expect(versions()).toBe("original p1-a p1-b p1-c");
    expect(shown()).toBe("p1-c");
    expect(slider().getAttribute("aria-valuenow")).toBe("0");
  });

  it("leaves nothing behind when the first press of a double-click drifts on an agent's version", async () => {
    render(<Harness start="p1-a" />);
    // The press drifts three pixels: a drag, which starts a version of the person's own.
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(14) });
    fireEvent.pointerMove(slider(), { clientX: xOf(14) + 3 });
    fireEvent.pointerUp(slider(), { clientX: xOf(14) + 3 });
    expect(versions()).toBe("original p1-a p1-b p1-c");
    // The double-click then resets that version's only change.
    await userEvent.dblClick(slider());
    expect(versions()).toBe("original p1-a p1-b");
    expect(shown()).toBe("p1-a");
    expect(slider().getAttribute("aria-valuenow")).toBe("14");
  });

  it("removes the person's own version when its only change is reset", async () => {
    // B differs from A only in shadows.
    render(<Harness start="p1-b" param="shadows" />);
    await userEvent.dblClick(slider());
    expect(versions()).toBe("original p1-a");
    expect(shown()).toBe("p1-a");
  });

  it("keeps the person's own version when it still differs in something else", async () => {
    // B already differs from A in shadows. Give it a second change, in contrast, then reset that one.
    render(<Harness start="p1-b" />);
    await userEvent.click(field());
    await userEvent.keyboard("{Control>}a{/Control}20{Enter}");
    expect(slider().getAttribute("aria-valuenow")).toBe("20");
    expect(versions()).toBe("original p1-a p1-b");
    slider().focus();
    await userEvent.keyboard("{Delete}");
    expect(slider().getAttribute("aria-valuenow")).toBe("14");
    expect(versions()).toBe("original p1-a p1-b");
    expect(shown()).toBe("p1-b");
  });

  it("resets the person's own version from the keyboard too", async () => {
    render(<Harness start="p1-b" param="shadows" />);
    slider().focus();
    await userEvent.keyboard("{Delete}");
    expect(versions()).toBe("original p1-a");
    expect(shown()).toBe("p1-a");
  });
});

describe("gestures", () => {
  function setup() {
    const calls: string[] = [];
    render(
      <SliderRow
        def={contrast}
        value={14}
        parentValue={0}
        onChange={(value) => calls.push(`change ${value}`)}
        onGestureStart={() => calls.push("start")}
        onGestureEnd={() => calls.push("end")}
      />,
    );
    return calls;
  }

  it("brackets a whole drag as one gesture", () => {
    const calls = setup();
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(14) });
    fireEvent.pointerMove(slider(), { clientX: xOf(20) });
    fireEvent.pointerMove(slider(), { clientX: xOf(30) });
    fireEvent.pointerUp(slider(), { clientX: xOf(30) });
    expect(calls).toEqual(["start", "change 20", "change 30", "end"]);
  });

  it("announces no gesture for a press that never moves", () => {
    const calls = setup();
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(60) });
    fireEvent.pointerUp(slider(), { clientX: xOf(60) });
    expect(calls).toEqual([]);
  });

  it("ends the gesture when the pointer is cancelled", () => {
    const calls = setup();
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(14) });
    fireEvent.pointerMove(slider(), { clientX: xOf(20) });
    fireEvent.pointerCancel(slider());
    expect(calls).toEqual(["start", "change 20", "end"]);
  });

  it("treats a held arrow key as one gesture, from press to release", () => {
    const calls = setup();
    slider().focus();
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    fireEvent.keyDown(slider(), { key: "ArrowRight", repeat: true });
    fireEvent.keyDown(slider(), { key: "ArrowRight", repeat: true });
    fireEvent.keyUp(slider(), { key: "ArrowRight" });
    expect(calls.filter((call) => call === "start")).toHaveLength(1);
    expect(calls.filter((call) => call === "end")).toHaveLength(1);
    expect(calls[0]).toBe("start");
    expect(calls[calls.length - 1]).toBe("end");
  });

  it("treats a stay in the number field as one gesture, ended after the commit", async () => {
    const calls = setup();
    await userEvent.click(field());
    await userEvent.keyboard("55");
    expect(calls).toEqual(["start"]);
    await userEvent.tab();
    expect(calls).toEqual(["start", "change 55", "end"]);
  });

  it("ends a gesture left open when the row goes away", () => {
    const calls: string[] = [];
    const { unmount } = render(
      <SliderRow def={contrast} value={14} parentValue={0} onChange={() => undefined} onGestureStart={() => calls.push("start")} onGestureEnd={() => calls.push("end")} />,
    );
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(14) });
    fireEvent.pointerMove(slider(), { clientX: xOf(20) });
    unmount();
    expect(calls).toEqual(["start", "end"]);
  });
});

/** The slider wired to an edit that is begun and committed around each gesture, as the session does it. */
function GestureHarness({ start, param }: { start: string; param: ParamId }) {
  const [state, setState] = useState<{ photo: Photo; shown: string; edit: Edit | null }>({ photo: photo(), shown: start, edit: null });
  const preview = state.edit ? previewEdit(state.photo, state.edit) : null;
  const stored = state.photo.versions.find((v) => v.id === state.shown)!;
  const shown = preview?.version ?? stored;
  const parentValue = preview ? (preview.parent?.params[param] ?? null) : stored.parentId === null ? null : resetValue(state.photo, stored, param);
  return (
    <>
      <SliderRow
        def={paramDef(param)}
        name="Contrast"
        value={shown.params[param]}
        parentValue={parentValue}
        onGestureStart={() => setState((s) => ({ ...s, edit: beginEdit(s.shown, YOU) }))}
        onGestureEnd={() =>
          setState((s) => {
            if (!s.edit) return s;
            const change = commitEdit(s.photo, s.edit, { name: "Adjusted" });
            return { photo: change.photo, shown: change.versionId, edit: null };
          })
        }
        onChange={(value) =>
          setState((s) => {
            if (s.edit) return { ...s, edit: editParam(s.edit, param, value) };
            const change = changeParam(s.photo, s.shown, param, value, YOU, { name: "Adjusted" });
            return { photo: change.photo, shown: change.versionId, edit: null };
          })
        }
      />
      <output data-testid="shown">{state.shown}</output>
      <output data-testid="versions">{state.photo.versions.map((v) => v.id).join(" ")}</output>
    </>
  );
}

describe("a drag, with the version rules decided at its end", () => {
  /** Screen x of a value on the Shadows track, which has the same range as Contrast. */
  const drag = (...values: number[]) => values.forEach((value) => fireEvent.pointerMove(slider(), { clientX: xOf(value) }));

  it("keeps the person's working copy through the parent's value and out again", () => {
    // B differs from A only in shadows +10. Its parent has shadows 0.
    render(<GestureHarness start="p1-b" param="shadows" />);
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(10) });
    drag(5, 0);
    // At the parent's value, mid-drag: nothing has been removed.
    expect(versions()).toBe("original p1-a p1-b");
    drag(-5, 0, 20);
    fireEvent.pointerUp(slider(), { clientX: xOf(20) });
    expect(versions()).toBe("original p1-a p1-b");
    expect(shown()).toBe("p1-b");
    expect(slider().getAttribute("aria-valuenow")).toBe("20");
  });

  it("discards the working copy once, on release, when the drag ends at the parent's value", () => {
    render(<GestureHarness start="p1-b" param="shadows" />);
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(10) });
    drag(20, 5, 0);
    expect(versions()).toBe("original p1-a p1-b");
    fireEvent.pointerUp(slider(), { clientX: xOf(0) });
    expect(versions()).toBe("original p1-a");
    expect(shown()).toBe("p1-a");
  });

  it("makes no version on an agent's version until the drag is released, then exactly one", () => {
    render(<GestureHarness start="p1-a" param="contrast" />);
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(14) });
    drag(20, 30, 40);
    expect(versions()).toBe("original p1-a p1-b");
    expect(slider().getAttribute("aria-valuenow")).toBe("40");
    fireEvent.pointerUp(slider(), { clientX: xOf(40) });
    expect(versions()).toBe("original p1-a p1-b p1-c");
    expect(shown()).toBe("p1-c");
  });

  it("makes nothing when a drag on an agent's version returns to where it started", () => {
    render(<GestureHarness start="p1-a" param="contrast" />);
    fireEvent.pointerDown(slider(), { button: 0, clientX: xOf(14) });
    drag(30, 14);
    fireEvent.pointerUp(slider(), { clientX: xOf(14) });
    expect(versions()).toBe("original p1-a p1-b");
    expect(shown()).toBe("p1-a");
  });
});
