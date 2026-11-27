/*
 * Geometry of a zoomed, panned photo inside a tile. Pure arithmetic; the
 * pixels themselves are never touched here.
 */

/** The view every linked tile shares. */
export interface View {
  /** True while the whole photo is fitted to the tile. */
  fit: boolean;
  /** Screen pixels per photo pixel. Ignored while fitted. */
  scale: number;
  /** Centre of the view, as fractions of the photo. */
  cx: number;
  cy: number;
}

/** How one tile differs from the shared view after being moved alone. */
export interface Offset {
  /** Multiplies the shared scale. */
  k: number;
  dx: number;
  dy: number;
}

export interface Size {
  width: number;
  height: number;
}

export const FIT_VIEW: View = { fit: true, scale: 0, cx: 0.5, cy: 0.5 };

/** Never zoom past four screen pixels per photo pixel. */
const MAX_PIXEL_RATIO = 4;

export function maxScale(): number {
  return MAX_PIXEL_RATIO / window.devicePixelRatio;
}

/** Scale at which one photo pixel is one screen pixel. */
export function actualSizeScale(): number {
  return 1 / window.devicePixelRatio;
}

export function fitScale(viewport: Size, photo: Size): number {
  if (viewport.width <= 0 || viewport.height <= 0) return 0;
  return Math.min(viewport.width / photo.width, viewport.height / photo.height);
}

/** Keeps the photo covering the tile when it is larger, centred when smaller. */
export function clampCentre(centre: number, size: number, viewport: number): number {
  if (size <= viewport) return 0.5;
  const margin = viewport / (2 * size);
  return Math.min(1 - margin, Math.max(margin, centre));
}

export interface Placement {
  fitScale: number;
  scale: number;
  /** Size of the photo on screen. */
  width: number;
  height: number;
  /** Top-left corner of the photo, relative to the tile. */
  left: number;
  top: number;
  cx: number;
  cy: number;
  fitted: boolean;
}

/** Where a photo sits in a tile for a given view and, optionally, its own offset. */
export function place(view: View, offset: Offset | undefined, viewport: Size, photo: Size): Placement {
  const fit = fitScale(viewport, photo);
  const scale = view.fit ? fit : Math.min(maxScale(), Math.max(fit, view.scale * (offset?.k ?? 1)));
  const width = photo.width * scale;
  const height = photo.height * scale;
  const cx = clampCentre(view.fit ? 0.5 : view.cx + (offset?.dx ?? 0), width, viewport.width);
  const cy = clampCentre(view.fit ? 0.5 : view.cy + (offset?.dy ?? 0), height, viewport.height);
  const fitted = scale <= fit * 1.002;
  const left = viewport.width / 2 - cx * width;
  const top = viewport.height / 2 - cy * height;
  return {
    fitScale: fit,
    scale,
    width,
    height,
    // Whole pixels while fitted keep the photo's edges crisp.
    left: fitted ? Math.round(left) : left,
    top: fitted ? Math.round(top) : top,
    cx,
    cy,
    fitted,
  };
}

/** The shared view written out in full, for when a fitted view starts to move. */
export function explicit(view: View, fit: number): View {
  return view.fit ? { fit: false, scale: fit, cx: 0.5, cy: 0.5 } : view;
}
