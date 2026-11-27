import { describe, expect, it } from "vitest";
import { ORIGINAL_ID, type Photo, type Version } from "../model/types";
import {
  addToComparison,
  agentMayFocus,
  comparedVersions,
  focusAfterReference,
  isFull,
  reconcile,
  removeFromComparison,
  standingOf,
  startComparison,
} from "./comparison";

function version(letter: string): Version {
  const id = letter ? `p-${letter.toLowerCase()}` : ORIGINAL_ID;
  return { id, letter, name: letter || "Original", author: null, rationale: null, parentId: letter ? ORIGINAL_ID : null, seen: true } as Version;
}

function photo(letters: string, dropped: string[] = []): Photo {
  return { id: "p", versions: [version(""), ...letters.split("").map(version)], droppedIds: dropped.map((l) => `p-${l.toLowerCase()}`), pickId: null } as unknown as Photo;
}

const letters = (versions: Version[]) => versions.map((v) => v.letter || "O").join("");

describe("a photo's first comparison", () => {
  it("compares every version when there are six or fewer, and not the original", () => {
    const p = photo("ABC");
    const c = startComparison(p);
    expect(letters(comparedVersions(c, p))).toBe("ABC");
    expect(standingOf(c, p, ORIGINAL_ID)).toBe("out");
  });

  it("leaves out what the person dropped", () => {
    const p = photo("ABCD", ["B"]);
    const c = startComparison(p);
    expect(letters(comparedVersions(c, p))).toBe("ACD");
    expect(standingOf(c, p, "p-b")).toBe("dropped");
  });

  it("compares the first six of more, and has the rest wait", () => {
    const p = photo("ABCDEFGH");
    const c = startComparison(p);
    expect(letters(comparedVersions(c, p))).toBe("ABCDEF");
    expect(standingOf(c, p, "p-g")).toBe("waiting");
    expect(standingOf(c, p, "p-h")).toBe("waiting");
  });
});

describe("a version arriving", () => {
  it("joins when there is room", () => {
    const before = photo("ABC");
    const after = photo("ABCD");
    const c = reconcile(startComparison(before), after);
    expect(letters(comparedVersions(c, after))).toBe("ABCD");
  });

  it("waits when six are compared, and displaces nothing", () => {
    const before = photo("ABCDEF");
    const after = photo("ABCDEFG");
    const c = reconcile(startComparison(before), after);
    expect(letters(comparedVersions(c, after))).toBe("ABCDEF");
    expect(standingOf(c, after, "p-g")).toBe("waiting");
  });

  it("waits when the original fills the sixth place", () => {
    const before = photo("ABCDE");
    const withOriginal = addToComparison(startComparison(before), before, ORIGINAL_ID).comparison;
    const after = photo("ABCDEF");
    const c = reconcile(withOriginal, after);
    expect(letters(comparedVersions(c, after))).toBe("ABCDEO");
    expect(standingOf(c, after, "p-f")).toBe("waiting");
  });

  it("changes nothing when nothing has arrived", () => {
    const p = photo("ABC");
    const c = startComparison(p);
    expect(reconcile(c, p)).toBe(c);
  });
});

describe("adding", () => {
  it("is refused when six are compared, and nothing changes", () => {
    const p = photo("ABCDEFG");
    const c = startComparison(p);
    const result = addToComparison(c, p, "p-g");
    expect(result.outcome).toBe("full");
    expect(result.comparison).toBe(c);
    expect(letters(comparedVersions(result.comparison, p))).toBe("ABCDEF");
  });

  it("is refused for the original and for a dropped version alike when full", () => {
    const p = photo("ABCDEFG", ["G"]);
    const c = startComparison(p);
    expect(isFull(c, p)).toBe(true);
    expect(addToComparison(c, p, ORIGINAL_ID).outcome).toBe("full");
    expect(addToComparison(c, p, "p-g").outcome).toBe("full");
  });

  it("works once the person has dropped one, and only then", () => {
    const full = photo("ABCDEFG");
    const c = startComparison(full);
    // The person drops C. G does not move in by itself.
    const afterDrop = photo("ABCDEFG", ["C"]);
    expect(removeFromComparison(c, "p-c")).toEqual({ comparison: c, drop: true });
    expect(letters(comparedVersions(c, afterDrop))).toBe("ABDEF");
    // Now there is room, and asking for G adds it.
    const result = addToComparison(c, afterDrop, "p-g");
    expect(result.outcome).toBe("added");
    expect(letters(comparedVersions(result.comparison, afterDrop))).toBe("ABDEFG");
  });

  it("tells the caller to clear the drop when a dropped version is restored", () => {
    const p = photo("ABC", ["B"]);
    const result = addToComparison(startComparison(p), p, "p-b");
    expect(result).toMatchObject({ outcome: "added", restore: true });
  });

  it("brings the original in as a guest and lets it leave without being dropped", () => {
    const p = photo("AB");
    const added = addToComparison(startComparison(p), p, ORIGINAL_ID);
    expect(added).toMatchObject({ outcome: "added", restore: false });
    expect(letters(comparedVersions(added.comparison, p))).toBe("ABO");
    const removed = removeFromComparison(added.comparison, ORIGINAL_ID);
    expect(removed.drop).toBe(false);
    expect(letters(comparedVersions(removed.comparison, p))).toBe("AB");
  });

  it("does nothing for a version already compared", () => {
    const p = photo("AB");
    expect(addToComparison(startComparison(p), p, "p-a").outcome).toBe("already");
  });
});

describe("the agent asking the view to move", () => {
  it("may focus a version that has a tile", () => {
    const p = photo("ABC");
    expect(agentMayFocus(startComparison(p), p, "p-b")).toBe(true);
  });

  it("may not bring back a version the person dropped", () => {
    const p = photo("ABC", ["B"]);
    const c = startComparison(p);
    expect(agentMayFocus(c, p, "p-b")).toBe(false);
    expect(standingOf(c, p, "p-b")).toBe("dropped");
  });

  it("may not push into a full comparison or summon the original", () => {
    const p = photo("ABCDEFG");
    const c = startComparison(p);
    expect(agentMayFocus(c, p, "p-g")).toBe(false);
    expect(agentMayFocus(c, p, ORIGINAL_ID)).toBe(false);
  });
});

describe("leaving Reference", () => {
  const compared = [version("A"), version("B"), version("C")];

  it("puts the focus back where it was before Reference moved it", () => {
    expect(focusAfterReference({ from: "p-b", to: "p-a" }, "p-a", compared)).toBe("p-b");
  });

  it("keeps a focus the person chose while in Reference", () => {
    expect(focusAfterReference({ from: "p-b", to: "p-a" }, "p-c", compared)).toBeNull();
  });

  it("does nothing when Reference never moved the focus", () => {
    expect(focusAfterReference(null, "p-a", compared)).toBeNull();
  });

  it("does not return to a version that has left the comparison", () => {
    expect(focusAfterReference({ from: "p-b", to: "p-a" }, "p-a", [version("A"), version("C")])).toBeNull();
  });
});
