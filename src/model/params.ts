/*
 * The adjustments of the first release, with Lightroom's names and ranges.
 * This file describes controls only; it does no image processing.
 */

export const HUE_BANDS = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"] as const;
export type HueBand = (typeof HUE_BANDS)[number];

export const MIXER_CHANNELS = ["hue", "sat", "lum"] as const;
export type MixerChannel = (typeof MIXER_CHANNELS)[number];

export const MIXER_CHANNEL_LABELS: Record<MixerChannel, string> = {
  hue: "Hue",
  sat: "Saturation",
  lum: "Luminance",
};

export type ToneParamId = "exposure" | "contrast" | "highlights" | "shadows" | "whites" | "blacks";
export type ColourParamId = "temp" | "tint" | "vibrance" | "saturation";
export type MixerParamId = `${MixerChannel}.${HueBand}`;
export type ParamId = ToneParamId | ColourParamId | MixerParamId;

export interface ParamDef {
  id: ParamId;
  label: string;
  min: number;
  max: number;
  /** Arrow keys move by this much. Values need not be multiples of it. */
  step: number;
  /** Shift and arrow keys move by this much. */
  bigStep: number;
  /** Value on a photo that has not been edited. Temp and Tint use the as-shot values instead. */
  neutral: number;
  /** Digits after the decimal point. */
  decimals: number;
  /** Show a plus sign on positive values. */
  signed: boolean;
  /** How value maps to position along the track. */
  scale: "linear" | "log";
  unit?: string;
}

function percent(id: ParamId, label: string): ParamDef {
  return { id, label, min: -100, max: 100, step: 1, bigStep: 10, neutral: 0, decimals: 0, signed: true, scale: "linear" };
}

export const LIGHT_PARAMS: ParamDef[] = [
  { id: "exposure", label: "Exposure", min: -5, max: 5, step: 0.05, bigStep: 0.25, neutral: 0, decimals: 2, signed: true, scale: "linear" },
  percent("contrast", "Contrast"),
  percent("highlights", "Highlights"),
  percent("shadows", "Shadows"),
  percent("whites", "Whites"),
  percent("blacks", "Blacks"),
];

export const COLOUR_PARAMS: ParamDef[] = [
  { id: "temp", label: "Temp", min: 2000, max: 15000, step: 50, bigStep: 250, neutral: 5500, decimals: 0, signed: false, scale: "log", unit: "K" },
  { id: "tint", label: "Tint", min: -150, max: 150, step: 1, bigStep: 10, neutral: 0, decimals: 0, signed: true, scale: "linear" },
  percent("vibrance", "Vibrance"),
  percent("saturation", "Saturation"),
];

const BAND_LABELS: Record<HueBand, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  aqua: "Aqua",
  blue: "Blue",
  purple: "Purple",
  magenta: "Magenta",
};

/** The band a mixer slider belongs to, or null for any other adjustment. */
export function hueBandOf(id: ParamId): HueBand | null {
  const band = id.split(".")[1];
  return HUE_BANDS.find((item) => item === band) ?? null;
}

export function mixerParams(channel: MixerChannel): ParamDef[] {
  return HUE_BANDS.map((band) => percent(`${channel}.${band}`, BAND_LABELS[band]));
}

export const MIXER_PARAMS: Record<MixerChannel, ParamDef[]> = {
  hue: mixerParams("hue"),
  sat: mixerParams("sat"),
  lum: mixerParams("lum"),
};

export const ALL_PARAMS: ParamDef[] = [
  ...LIGHT_PARAMS,
  ...COLOUR_PARAMS,
  ...MIXER_PARAMS.hue,
  ...MIXER_PARAMS.sat,
  ...MIXER_PARAMS.lum,
];

const BY_ID = new Map(ALL_PARAMS.map((def) => [def.id, def]));

export function paramDef(id: ParamId): ParamDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown adjustment: ${id}`);
  return def;
}

/**
 * Clamps to the range and rounds to the control's own precision. This is
 * what any value may be: a typed 5237 K stays 5237 K, and 0.33 stays 0.33.
 */
export function clampValue(def: ParamDef, value: number): number {
  const clamped = Math.min(def.max, Math.max(def.min, value));
  return Number(clamped.toFixed(def.decimals));
}

/**
 * Clamps to the range and snaps to the arrow step. Only for values that come
 * from a position along the track, where finer control would be false precision.
 */
export function normalise(def: ParamDef, value: number): number {
  const clamped = Math.min(def.max, Math.max(def.min, value));
  const snapped = Math.round(clamped / def.step) * def.step;
  return Number(snapped.toFixed(def.decimals));
}

/** Position along the track, 0 to 1. */
export function toPosition(def: ParamDef, value: number): number {
  const v = Math.min(def.max, Math.max(def.min, value));
  if (def.scale === "log") return Math.log(v / def.min) / Math.log(def.max / def.min);
  return (v - def.min) / (def.max - def.min);
}

export function fromPosition(def: ParamDef, position: number): number {
  const p = Math.min(1, Math.max(0, position));
  const raw = def.scale === "log" ? def.min * Math.pow(def.max / def.min, p) : def.min + p * (def.max - def.min);
  return normalise(def, raw);
}

const MINUS = "−";

/** "+0.35", "−12", "0", "5350". Uses a true minus sign so signs align. */
export function formatValue(def: ParamDef, value: number): string {
  const magnitude = Math.abs(value).toFixed(def.decimals);
  if (Number(magnitude) === 0) return def.decimals > 0 ? (0).toFixed(def.decimals) : "0";
  if (value < 0) return MINUS + magnitude;
  return def.signed ? `+${magnitude}` : magnitude;
}

/** "Exposure +0.25 · Contrast +8", for versions that carry no rationale. */
export function describeChanges(params: Record<ParamId, number>, parent: Record<ParamId, number>, limit = 3): string {
  const changed = ALL_PARAMS.filter((def) => params[def.id] !== parent[def.id]);
  const named = changed.slice(0, limit).map((def) => {
    const [channel] = def.id.split(".");
    const prefix = def.id.includes(".") ? `${MIXER_CHANNEL_LABELS[channel as MixerChannel]} ` : "";
    return `${prefix}${def.label} ${formatValue(def, params[def.id])}`;
  });
  if (changed.length > limit) named.push(`${changed.length - limit} more`);
  return named.join(" · ");
}

/** True when `text` is digits grouped in threes by `separator`, as in 1,234,567. */
function groupedInThrees(text: string, separator: string): boolean {
  const [first = "", ...rest] = text.split(separator);
  return /^[0-9]{1,3}$/.test(first) && rest.every((group) => /^[0-9]{3}$/.test(group));
}

/**
 * Reads an unsigned number that may use a comma or a point as either the
 * decimal mark or the thousands separator. Returns null when it cannot tell
 * which was meant, rather than guessing.
 */
function readNumber(digits: string, decimals: number): number | null {
  const marks = digits.match(/[.,]/g) ?? [];
  if (marks.length === 0) return Number(digits);

  const lastAt = Math.max(digits.lastIndexOf("."), digits.lastIndexOf(","));
  const last = digits[lastAt]!;
  const head = digits.slice(0, lastAt);
  const tail = digits.slice(lastAt + 1);

  if (new Set(marks).size === 2) {
    // Both marks: the last is the decimal mark and the other groups thousands,
    // as in 1,234.5 or 1.234,5. Anything else is not a number.
    const other = last === "." ? "," : ".";
    if (head.includes(last) || !groupedInThrees(head, other)) return null;
    return Number(`${head.split(other).join("")}.${tail}`);
  }

  if (marks.length > 1) {
    // One mark repeated can only be grouping, as in 1,234,567.
    return groupedInThrees(digits, last) ? Number(digits.split(last).join("")) : null;
  }

  // A single mark with three digits after it and a non-zero group before it
  // reads as thousands ("5,200") and as a decimal ("5.200") alike. A control
  // without decimals can only mean thousands; one with decimals cannot tell.
  if (tail.length === 3 && /^[1-9][0-9]{0,2}$/.test(head)) return decimals === 0 ? Number(head + tail) : null;

  return Number(`${head || "0"}.${tail || "0"}`);
}

/**
 * Reads what a person typed: "+0.3", "-12", "−12", "5200 K", "5,200 K",
 * "0,35". A unit after the number is ignored. Returns null for anything
 * that is not a number or whose separators are ambiguous.
 */
export function parseValue(def: ParamDef, text: string): number | null {
  const match = text
    .trim()
    .replace(MINUS, "-")
    .match(/^([+-]?)\s*([0-9][0-9.,\s\u00a0\u202f]*|[.,][0-9]+)\s*[a-zA-Z%°]*$/);
  if (!match) return null;
  const number = readNumber(match[2]!.replace(/[\s\u00a0\u202f]/g, ""), def.decimals);
  if (number === null || !Number.isFinite(number)) return null;
  return clampValue(def, match[1] === "-" ? -number : number);
}
