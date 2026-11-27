import { describe, expect, it } from "vitest";
import { clampValue, formatValue, fromPosition, normalise, paramDef, parseValue, toPosition } from "./params";

const exposure = paramDef("exposure");
const temp = paramDef("temp");
const contrast = paramDef("contrast");

describe("formatValue", () => {
  it("signs values and uses a true minus", () => {
    expect(formatValue(exposure, 0.35)).toBe("+0.35");
    expect(formatValue(contrast, -12)).toBe("−12");
    expect(formatValue(contrast, 0)).toBe("0");
    expect(formatValue(exposure, 0)).toBe("0.00");
  });

  it("leaves unsigned controls unsigned", () => {
    expect(formatValue(temp, 5350)).toBe("5350");
  });
});

describe("track position", () => {
  it("round-trips the ends and the middle of a linear control", () => {
    expect(toPosition(contrast, -100)).toBe(0);
    expect(toPosition(contrast, 100)).toBe(1);
    expect(fromPosition(contrast, 0.5)).toBe(0);
  });

  it("uses a log scale for temperature", () => {
    expect(toPosition(temp, temp.min)).toBe(0);
    expect(toPosition(temp, temp.max)).toBeCloseTo(1);
    // Halfway along the track is the geometric mean of the ends.
    expect(fromPosition(temp, 0.5)).toBe(5500);
  });
});

describe("clampValue", () => {
  it("keeps a value at the control's own precision, not the arrow step", () => {
    expect(clampValue(temp, 5237)).toBe(5237);
    expect(clampValue(exposure, 0.33)).toBe(0.33);
    expect(clampValue(contrast, 12)).toBe(12);
  });

  it("rounds away digits the control does not have", () => {
    expect(clampValue(exposure, 0.333)).toBe(0.33);
    expect(clampValue(contrast, 12.6)).toBe(13);
  });

  it("holds values inside the range", () => {
    expect(clampValue(exposure, 9)).toBe(5);
    expect(clampValue(temp, 100)).toBe(2000);
    expect(clampValue(contrast, -250)).toBe(-100);
  });
});

describe("normalise", () => {
  it("snaps to the arrow step, for values read off the track", () => {
    expect(normalise(temp, 5237)).toBe(5250);
    expect(normalise(exposure, 0.33)).toBe(0.35);
  });

  it("leaves no floating-point noise", () => {
    expect(normalise(exposure, 0.1 + 0.2)).toBe(0.3);
  });
});

describe("parseValue", () => {
  it("reads plain and signed numbers", () => {
    expect(parseValue(contrast, "12")).toBe(12);
    expect(parseValue(contrast, "+12")).toBe(12);
    expect(parseValue(contrast, "-12")).toBe(-12);
    expect(parseValue(contrast, "\u221212")).toBe(-12);
    expect(parseValue(exposure, "+0.3")).toBe(0.3);
    expect(parseValue(exposure, ".5")).toBe(0.5);
  });

  it("ignores a unit and stray spaces", () => {
    expect(parseValue(temp, "5200 K")).toBe(5200);
    expect(parseValue(temp, " 5200K ")).toBe(5200);
  });

  it("reads thousands separators on a control without decimals", () => {
    expect(parseValue(temp, "5,200 K")).toBe(5200);
    expect(parseValue(temp, "5.200")).toBe(5200);
    expect(parseValue(temp, "5 200")).toBe(5200);
    expect(parseValue(temp, "12,000")).toBe(12000);
  });

  it("reads a decimal comma", () => {
    expect(parseValue(exposure, "0,35")).toBe(0.35);
    expect(parseValue(exposure, "-1,5")).toBe(-1.5);
    expect(parseValue(exposure, "0,350")).toBe(0.35);
  });

  it("reads both marks together either way round", () => {
    expect(parseValue(temp, "5,200.4")).toBe(5200);
    expect(parseValue(temp, "5.200,4")).toBe(5200);
  });

  it("keeps the control's precision instead of snapping to the step", () => {
    expect(parseValue(temp, "5237")).toBe(5237);
    expect(parseValue(exposure, "0.33")).toBe(0.33);
  });

  it("clamps to the range", () => {
    expect(parseValue(temp, "900")).toBe(2000);
    expect(parseValue(exposure, "12")).toBe(5);
  });

  it("rejects what it cannot read rather than guessing", () => {
    // Thousands or decimal? A control with decimals cannot tell.
    expect(parseValue(exposure, "1,250")).toBeNull();
    expect(parseValue(exposure, "1.250")).toBeNull();
    expect(parseValue(temp, "5,20,0")).toBeNull();
    expect(parseValue(temp, "5.2.0,1")).toBeNull();
    expect(parseValue(temp, "")).toBeNull();
    expect(parseValue(temp, "-")).toBeNull();
    expect(parseValue(temp, "warm")).toBeNull();
    expect(parseValue(temp, "52e3")).toBeNull();
  });
});
