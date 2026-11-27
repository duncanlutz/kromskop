import { describe, expect, it } from "vitest";
import { formatValue, fromPosition, paramDef, toPosition } from "./params";

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
