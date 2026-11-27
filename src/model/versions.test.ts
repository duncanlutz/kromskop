import { describe, expect, it } from "vitest";
import { ALL_PARAMS, type ParamId } from "./params";
import type { Author, Params, Photo, Version } from "./types";
import { addVersion, changedParams, changeParam, hasChildren, isChanged, nextLetter, parentOf, resetValue } from "./versions";

const AGENT: Author = { kind: "agent", client: "Test Agent" };
const YOU: Author = { kind: "you" };

function params(overrides: Partial<Record<ParamId, number>> = {}): Params {
  const all = {} as Record<ParamId, number>;
  for (const def of ALL_PARAMS) all[def.id] = def.neutral;
  // An as-shot balance that is not a multiple of the arrow step.
  all.temp = 5237;
  return { ...all, ...overrides };
}

function version(id: string, letter: string, parentId: string | null, author: Author | null, overrides = {}): Version {
  return { id, letter, name: letter || "Original", author, rationale: null, parentId, params: params(overrides), seen: true };
}

/** Freezes everything, so any attempt to mutate throws. */
function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}

/**
 * original
 * └─ A  agent   exposure +0.2
 *    ├─ B  agent   temp 5800
 *    └─ C  you     contrast +8
 */
function photo(): Photo {
  return frozen({
    id: "p1",
    fileName: "IMG_0001.CR2",
    previewUrl: "",
    width: 6000,
    height: 4000,
    capture: { camera: "", focalLength: "", aperture: "", shutter: "", iso: "" },
    versions: [
      version("original", "", null, null),
      version("p1-a", "A", "original", AGENT, { exposure: 0.2 }),
      version("p1-b", "B", "p1-a", AGENT, { exposure: 0.2, temp: 5800 }),
      version("p1-c", "C", "p1-a", YOU, { exposure: 0.2, contrast: 8 }),
    ],
    pickId: null,
  } as Photo);
}

const byId = (p: Photo, id: string) => p.versions.find((v) => v.id === id)!;
const LABEL = { name: "Adjusted" };

describe("changed relative to the parent", () => {
  it("compares a version with its parent, not with the original", () => {
    const p = photo();
    const b = byId(p, "p1-b");
    expect(changedParams(p, b)).toEqual(["temp"]);
    expect(isChanged(b, parentOf(p, b), "exposure")).toBe(false);
    expect(isChanged(b, parentOf(p, b), "temp")).toBe(true);
  });

  it("counts nothing as changed on the original", () => {
    const p = photo();
    expect(changedParams(p, byId(p, "original"))).toEqual([]);
  });

  it("treats a value equal to the parent's as unchanged, whatever it is", () => {
    const p = photo();
    const a = byId(p, "p1-a");
    expect(isChanged(a, parentOf(p, a), "temp")).toBe(false);
    expect(changedParams(p, a)).toEqual(["exposure"]);
  });
});

describe("reset", () => {
  it("restores the parent's exact value, off the arrow step or not", () => {
    const p = photo();
    expect(resetValue(p, byId(p, "p1-b"), "temp")).toBe(5237);
    const reset = changeParam(p, "p1-c", "temp", resetValue(p, byId(p, "p1-c"), "temp"), YOU, LABEL);
    expect(changedParams(reset.photo, byId(reset.photo, reset.versionId))).toEqual(["contrast"]);
  });

  it("leaves a reset row unchanged after a round trip", () => {
    const p = photo();
    const moved = changeParam(p, "p1-c", "temp", 6000, YOU, LABEL);
    const c = byId(moved.photo, "p1-c");
    const back = changeParam(moved.photo, "p1-c", "temp", resetValue(moved.photo, c, "temp"), YOU, LABEL);
    expect(changedParams(back.photo, byId(back.photo, "p1-c"))).toEqual(["contrast"]);
  });
});

describe("changing a version", () => {
  it("starts a new version on the first change to an agent's version", () => {
    const p = photo();
    const change = changeParam(p, "p1-b", "shadows", 15, YOU, LABEL);
    expect(change.forked).toBe(true);
    const made = byId(change.photo, change.versionId);
    expect(made).toMatchObject({ letter: "D", parentId: "p1-b", author: YOU, name: "Adjusted", seen: true });
    expect(changedParams(change.photo, made)).toEqual(["shadows"]);
    // The agent's version is the very same object as before.
    expect(byId(change.photo, "p1-b")).toBe(byId(p, "p1-b"));
  });

  it("starts a new version when the original is changed", () => {
    const p = photo();
    const change = changeParam(p, "original", "exposure", 0.5, YOU, LABEL);
    expect(change.forked).toBe(true);
    expect(byId(change.photo, change.versionId).parentId).toBe("original");
    expect(byId(change.photo, "original").params.exposure).toBe(0);
  });

  it("lets a person's own working copy take the change, as a new snapshot", () => {
    const p = photo();
    const change = changeParam(p, "p1-c", "contrast", 12, YOU, LABEL);
    expect(change).toMatchObject({ forked: false, versionId: "p1-c" });
    expect(byId(change.photo, "p1-c").params.contrast).toBe(12);
    expect(byId(change.photo, "p1-c")).not.toBe(byId(p, "p1-c"));
    expect(change.photo.versions).toHaveLength(4);
  });

  it("starts a new version when the target has versions built on it, even the person's own", () => {
    // The agent builds D on the person's C; the person then changes C.
    const built = addVersion(photo(), "p1-c", AGENT, { name: "Built on yours" });
    const p = frozen(changeParam(built.photo, built.version.id, "exposure", 0.5, AGENT, LABEL).photo);
    expect(hasChildren(p, "p1-c")).toBe(true);

    const change = changeParam(p, "p1-c", "contrast", 20, YOU, LABEL);
    expect(change.forked).toBe(true);
    expect(byId(change.photo, "p1-c")).toBe(byId(p, "p1-c"));
    // What the agent built still differs from C in exactly the way it did.
    expect(changedParams(change.photo, byId(change.photo, built.version.id))).toEqual(["exposure"]);
  });

  it("makes the agent start a new version too, once a person has built on the one it was writing", () => {
    // The agent is writing D. The person nudges it mid-run, which starts E from D.
    const started = addVersion(photo(), "p1-b", AGENT, { name: "Softer", seen: false });
    const first = changeParam(started.photo, started.version.id, "exposure", 0.5, AGENT, { name: "Softer" });
    expect(first.forked).toBe(false);
    const nudged = changeParam(first.photo, first.versionId, "shadows", 15, YOU, LABEL);
    expect(nudged.forked).toBe(true);
    const mine = byId(nudged.photo, nudged.versionId);
    expect(changedParams(nudged.photo, mine)).toEqual(["shadows"]);

    // The agent's next write must not reach into D, which E now depends on.
    const p = frozen(nudged.photo);
    const next = changeParam(p, first.versionId, "temp", 6200, AGENT, { name: "Softer" });
    expect(next.forked).toBe(true);
    expect(byId(next.photo, first.versionId)).toBe(byId(p, first.versionId));
    // The person's version still reads as one change, not as the agent's too.
    expect(changedParams(next.photo, byId(next.photo, mine.id))).toEqual(["shadows"]);
  });

  it("does nothing when the value is the one already there", () => {
    const p = photo();
    const change = changeParam(p, "p1-b", "temp", 5800, YOU, LABEL);
    expect(change.forked).toBe(false);
    expect(change.photo).toBe(p);
  });

  it("never mutates what it is given", () => {
    // Every object in the fixture is frozen; a mutation would throw.
    const p = photo();
    expect(() => changeParam(p, "p1-c", "contrast", 1, YOU, LABEL)).not.toThrow();
    expect(() => changeParam(p, "p1-a", "contrast", 1, YOU, LABEL)).not.toThrow();
    expect(() => addVersion(p, "p1-a", AGENT, LABEL)).not.toThrow();
    expect(byId(p, "p1-c").params.contrast).toBe(8);
  });
});

describe("letters", () => {
  it("gives each new version the next letter", () => {
    const p = photo();
    expect(nextLetter(p)).toBe("D");
    const one = addVersion(p, "p1-a", AGENT, LABEL);
    expect(one.version.letter).toBe("D");
    expect(nextLetter(one.photo)).toBe("E");
  });

  it("marks an agent's new version as not yet seen", () => {
    expect(addVersion(photo(), "p1-a", AGENT, LABEL).version.seen).toBe(false);
    expect(addVersion(photo(), "p1-a", YOU, LABEL).version.seen).toBe(true);
  });
});
