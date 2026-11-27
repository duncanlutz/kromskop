// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { actualSizeScale, clampCentre, explicit, FIT_VIEW, fitScale, maxScale, place, type Offset, type View } from "./view";

const PHOTO = { width: 6000, height: 4000 };
const TILE = { width: 600, height: 400 };

beforeAll(() => {
  Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
});

describe("fit", () => {
  it("fits by the tighter side", () => {
    expect(fitScale(TILE, PHOTO)).toBeCloseTo(0.1);
    expect(fitScale({ width: 600, height: 200 }, PHOTO)).toBeCloseTo(0.05);
    expect(fitScale({ width: 300, height: 400 }, PHOTO)).toBeCloseTo(0.05);
  });

  it("is zero before the tile has a size", () => {
    expect(fitScale({ width: 0, height: 0 }, PHOTO)).toBe(0);
  });

  it("places a fitted photo centred, on whole pixels", () => {
    const at = place(FIT_VIEW, undefined, { width: 601, height: 500 }, PHOTO);
    expect(at.fitted).toBe(true);
    expect(at.width).toBeCloseTo(601);
    expect(Number.isInteger(at.left)).toBe(true);
    expect(Number.isInteger(at.top)).toBe(true);
    // 601 x 400.67 in a 601 x 500 tile: about 50 px above and below.
    expect(at.top).toBe(50);
  });

  it("ignores a tile's own offset while fitted", () => {
    const own: Offset = { k: 3, dx: 0.2, dy: 0.2 };
    expect(place(FIT_VIEW, own, TILE, PHOTO)).toEqual(place(FIT_VIEW, undefined, TILE, PHOTO));
  });
});

describe("scale limits", () => {
  it("defines 100% as one photo pixel per screen pixel", () => {
    expect(actualSizeScale()).toBe(0.5);
  });

  it("never goes below fit or above four screen pixels per photo pixel", () => {
    expect(maxScale()).toBe(2);
    expect(place({ fit: false, scale: 0.01, cx: 0.5, cy: 0.5 }, undefined, TILE, PHOTO).scale).toBeCloseTo(0.1);
    expect(place({ fit: false, scale: 50, cx: 0.5, cy: 0.5 }, undefined, TILE, PHOTO).scale).toBe(2);
  });
});

describe("clamping", () => {
  it("centres a photo smaller than the tile", () => {
    expect(clampCentre(0.9, 300, 600)).toBe(0.5);
  });

  it("keeps a larger photo covering the tile", () => {
    // 3000 px wide in a 600 px tile: the centre may range from 0.1 to 0.9.
    expect(clampCentre(0, 3000, 600)).toBeCloseTo(0.1);
    expect(clampCentre(1, 3000, 600)).toBeCloseTo(0.9);
    expect(clampCentre(0.4, 3000, 600)).toBe(0.4);
  });

  it("never shows surround at an edge when zoomed", () => {
    const at = place({ fit: false, scale: 0.5, cx: 0, cy: 1 }, undefined, TILE, PHOTO);
    expect(at.left).toBeCloseTo(0);
    expect(at.top + at.height).toBeCloseTo(TILE.height);
  });
});

describe("zoom about a point", () => {
  /** The view after zooming to `scale` with the photo point under the pointer held still. */
  function zoomAbout(view: View, pointer: { x: number; y: number }, scale: number): View {
    const now = place(view, undefined, TILE, PHOTO);
    const px = pointer.x - TILE.width / 2;
    const py = pointer.y - TILE.height / 2;
    const u = now.cx + px / now.width;
    const v = now.cy + py / now.height;
    return { fit: false, scale, cx: u - px / (PHOTO.width * scale), cy: v - py / (PHOTO.height * scale) };
  }

  /** The photo point, as fractions, under a position in the tile. */
  function under(view: View, pointer: { x: number; y: number }) {
    const at = place(view, undefined, TILE, PHOTO);
    return { u: (pointer.x - at.left) / at.width, v: (pointer.y - at.top) / at.height };
  }

  it("keeps the point under the pointer where it was", () => {
    const pointer = { x: 450, y: 120 };
    const before = under(FIT_VIEW, pointer);
    const zoomed = zoomAbout(FIT_VIEW, pointer, 0.5);
    const after = under(zoomed, pointer);
    expect(after.u).toBeCloseTo(before.u, 6);
    expect(after.v).toBeCloseTo(before.v, 6);
  });

  it("holds that point through a second zoom", () => {
    const pointer = { x: 200, y: 300 };
    const first = zoomAbout(FIT_VIEW, pointer, 0.4);
    const before = under(first, pointer);
    const after = under(zoomAbout(first, pointer, 1.2), pointer);
    expect(after.u).toBeCloseTo(before.u, 6);
    expect(after.v).toBeCloseTo(before.v, 6);
  });
});

describe("linked tiles", () => {
  const view: View = { fit: false, scale: 0.5, cx: 0.4, cy: 0.6 };

  it("gives tiles of the same size the same placement for the same view", () => {
    expect(place(view, undefined, TILE, PHOTO)).toEqual(place(view, undefined, { ...TILE }, PHOTO));
  });

  it("shows the same centre in tiles of different sizes", () => {
    const small = place(view, undefined, TILE, PHOTO);
    const large = place(view, undefined, { width: 1200, height: 800 }, PHOTO);
    expect(small.cx).toBe(large.cx);
    expect(small.cy).toBe(large.cy);
    expect(small.scale).toBe(large.scale);
  });

  it("moves one tile alone by its offset and leaves the shared view as it was", () => {
    const own: Offset = { k: 1, dx: 0.1, dy: -0.1 };
    const moved = place(view, own, TILE, PHOTO);
    const others = place(view, undefined, TILE, PHOTO);
    expect(moved.cx).toBeCloseTo(0.5);
    expect(moved.cy).toBeCloseTo(0.5);
    expect(others.cx).toBe(0.4);
    expect(moved.scale).toBe(others.scale);
  });

  it("scales one tile alone by its own factor", () => {
    expect(place(view, { k: 2, dx: 0, dy: 0 }, TILE, PHOTO).scale).toBe(1);
  });

  it("writes a fitted view out in full before it starts to move", () => {
    expect(explicit(FIT_VIEW, 0.1)).toEqual({ fit: false, scale: 0.1, cx: 0.5, cy: 0.5 });
    expect(explicit(view, 0.1)).toBe(view);
  });
});
