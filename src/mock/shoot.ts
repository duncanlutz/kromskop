/*
 * MOCK DATA. A made-up shoot built on the CC0 sample photos in /samples.
 * File names, capture details, versions and rationales are all invented.
 * The engine will replace this with what it reads from a real folder.
 */

import { ALL_PARAMS, type ParamId } from "../model/params";
import {
  ORIGINAL_ID,
  type Author,
  type CaptureInfo,
  type Note,
  type Params,
  type Photo,
  type Region,
  type Shoot,
  type Version,
} from "../model/types";

const sampleUrls = import.meta.glob<string>("../../samples/*.jpg", { eager: true, query: "?url", import: "default" });

function sample(name: string): string {
  const url = sampleUrls[`../../samples/${name}.jpg`];
  if (!url) throw new Error(`Missing sample photo: ${name}`);
  return url;
}

export const MOCK_CLIENT = "Claude Code";
const AGENT: Author = { kind: "agent", client: MOCK_CLIENT };
const YOU: Author = { kind: "you" };

type Overrides = Partial<Record<ParamId, number>>;

export function neutralParams(asShot: { temp: number; tint: number }): Params {
  const params = {} as Record<ParamId, number>;
  for (const def of ALL_PARAMS) params[def.id] = def.neutral;
  params.temp = asShot.temp;
  params.tint = asShot.tint;
  return params;
}

interface VersionSpec {
  letter: string;
  name: string;
  author: Author;
  rationale?: string;
  /** Letter of the parent version; leave out for the original. */
  from?: string;
  /** Changes relative to the parent. */
  changes: Overrides;
  seen?: boolean;
}

interface PhotoSpec {
  id: string;
  fileName: string;
  sample: string;
  width: number;
  height: number;
  capture: CaptureInfo;
  asShot: { temp: number; tint: number };
  versions: VersionSpec[];
  pick?: string;
}

function buildPhoto(spec: PhotoSpec): Photo {
  const original: Version = {
    id: ORIGINAL_ID,
    letter: "",
    name: "Original",
    author: null,
    rationale: null,
    parentId: null,
    params: neutralParams(spec.asShot),
    seen: true,
  };
  const versions: Version[] = [original];
  const idOf = (letter: string) => `${spec.id}-${letter.toLowerCase()}`;
  for (const v of spec.versions) {
    const parent = v.from ? versions.find((x) => x.letter === v.from) : original;
    if (!parent) throw new Error(`Version ${v.letter} of ${spec.id} names a parent that does not exist`);
    versions.push({
      id: idOf(v.letter),
      letter: v.letter,
      name: v.name,
      author: v.author,
      rationale: v.rationale ?? null,
      parentId: parent.id,
      params: { ...parent.params, ...v.changes },
      seen: v.seen ?? true,
    });
  }
  return {
    id: spec.id,
    fileName: spec.fileName,
    previewUrl: sample(spec.sample),
    width: spec.width,
    height: spec.height,
    capture: spec.capture,
    versions,
    pickId: spec.pick ? idOf(spec.pick) : null,
  };
}

const CAMERA = "Canon EOS 6D";

const PHOTOS: PhotoSpec[] = [
  {
    id: "p0412",
    fileName: "IMG_0412.CR2",
    sample: "field-laughing",
    width: 5472,
    height: 3648,
    capture: { camera: CAMERA, focalLength: "50 mm", aperture: "f/1.6", shutter: "1/4000 s", iso: "ISO 100" },
    asShot: { temp: 5350, tint: 6 },
    pick: "B",
    versions: [
      {
        letter: "A",
        name: "Neutral base",
        author: AGENT,
        rationale: "Set the overcast sky as the neutral reference and opened the shadows under the jacket collar.",
        changes: { exposure: 0.2, contrast: 6, highlights: -18, shadows: 14, blacks: -4 },
      },
      {
        letter: "B",
        name: "Warm afternoon",
        author: AGENT,
        from: "A",
        rationale: "Warmed the white balance by 450 K so the dry grass reads golden, then eased orange saturation to keep skin natural.",
        changes: { temp: 5800, tint: 10, vibrance: 12, "sat.orange": -8, "lum.orange": 6 },
      },
      {
        letter: "C",
        name: "Cool and quiet",
        author: AGENT,
        from: "A",
        rationale: "Cooler and flatter, closer to the light on the day. The denim stays blue without drifting cyan.",
        changes: { temp: 5050, contrast: -4, saturation: -12, blacks: 4, "hue.blue": 6, "lum.blue": -10 },
        seen: false,
      },
    ],
  },
  {
    id: "p0431",
    fileName: "IMG_0431.CR2",
    sample: "window-smile",
    width: 5472,
    height: 3648,
    capture: { camera: CAMERA, focalLength: "35 mm", aperture: "f/1.4", shutter: "1/4000 s", iso: "ISO 800" },
    asShot: { temp: 4700, tint: 12 },
    pick: "A",
    versions: [
      {
        letter: "A",
        name: "Window light",
        author: AGENT,
        rationale: "Held the window highlights and balanced for the daylight side of her face rather than the tungsten room.",
        changes: { exposure: 0.15, highlights: -32, shadows: 18, temp: 4950, tint: 8 },
      },
      {
        letter: "B",
        name: "Mixed light kept",
        author: AGENT,
        rationale: "Left the warm room lights in so the café still feels lit from inside.",
        changes: { exposure: 0.1, highlights: -20, temp: 4500, vibrance: 8, "sat.orange": -6 },
      },
      {
        letter: "C",
        name: "Adjusted",
        author: YOU,
        from: "A",
        changes: { exposure: 0.3, contrast: 8 },
      },
    ],
  },
  {
    id: "p0456",
    fileName: "IMG_0456.CR2",
    sample: "close-portrait",
    width: 5472,
    height: 3648,
    capture: { camera: CAMERA, focalLength: "50 mm", aperture: "f/1.8", shutter: "1/250 s", iso: "ISO 100" },
    asShot: { temp: 5600, tint: 2 },
    versions: [
      {
        letter: "A",
        name: "True to skin",
        author: AGENT,
        rationale: "Added a third of a stop and lifted orange luminance so skin holds detail without looking lit.",
        changes: { exposure: 0.35, shadows: 10, "lum.orange": 8, "sat.orange": 4 },
        seen: false,
      },
      {
        letter: "B",
        name: "Deeper contrast",
        author: AGENT,
        from: "A",
        rationale: "Same balance with firmer blacks, for a print that will sit on white paper.",
        changes: { contrast: 18, blacks: -12, whites: 6 },
        seen: false,
      },
    ],
  },
  {
    id: "p0467",
    fileName: "IMG_0467.CR2",
    sample: "red-hair-sky",
    width: 5472,
    height: 3648,
    capture: { camera: CAMERA, focalLength: "50 mm", aperture: "f/5", shutter: "1/4000 s", iso: "ISO 400" },
    asShot: { temp: 6100, tint: 4 },
    pick: "C",
    versions: [
      {
        letter: "A",
        name: "High key",
        author: AGENT,
        rationale: "Kept the sky just under clipping so it prints as paper white with a trace of tone.",
        changes: { exposure: 0.25, highlights: -24, whites: -6 },
      },
      {
        letter: "B",
        name: "Copper hair",
        author: AGENT,
        from: "A",
        rationale: "Shifted orange toward red and raised its saturation; the hair is the only warm thing in the frame.",
        changes: { "hue.orange": -8, "sat.orange": 14, "sat.red": 6 },
      },
      {
        letter: "C",
        name: "Copper hair, cooler sky",
        author: AGENT,
        from: "B",
        rationale: "Cooled the white balance by 300 K so the sky separates from the hair.",
        changes: { temp: 5800, "sat.blue": 8 },
      },
      {
        letter: "D",
        name: "Soft and grey",
        author: AGENT,
        from: "A",
        rationale: "A muted alternative with lower contrast, in case the set leans quiet.",
        changes: { contrast: -14, saturation: -18, shadows: 10 },
      },
    ],
  },
  {
    id: "p0489",
    fileName: "IMG_0489.CR2",
    sample: "blanket-couple",
    width: 3648,
    height: 5472,
    capture: { camera: CAMERA, focalLength: "35 mm", aperture: "f/1.6", shutter: "1/4000 s", iso: "ISO 400" },
    asShot: { temp: 5900, tint: 8 },
    versions: [
      {
        letter: "A",
        name: "Plaid held back",
        author: AGENT,
        rationale: "Pulled red saturation down so the blanket stops competing with their faces.",
        changes: { exposure: 0.1, shadows: 12, "sat.red": -16, "lum.red": -6, vibrance: 6 },
      },
    ],
  },
  {
    id: "p0502",
    fileName: "IMG_0502.CR2",
    sample: "sunset-backlit",
    width: 5472,
    height: 3648,
    capture: { camera: CAMERA, focalLength: "85 mm", aperture: "f/2", shutter: "1/1000 s", iso: "ISO 200" },
    asShot: { temp: 6400, tint: 10 },
    versions: [],
  },
];

/*
 * Spare looks, so a reviewer can ask for any number of versions of a photo.
 * The entry at index n becomes the photo's version n + 1 when it has none.
 */
const SPARE_LOOKS: Array<Omit<VersionSpec, "letter" | "changes"> & { changes(parent: Params): Overrides }> = [
  {
    name: "Neutral base",
    author: AGENT,
    rationale: "A plain starting point: a small exposure lift and nothing else.",
    changes: () => ({ exposure: 0.15, highlights: -10 }),
  },
  {
    name: "Warmer",
    author: AGENT,
    from: "A",
    rationale: "The same base, 350 K warmer, for a late-afternoon feel.",
    changes: (parent) => ({ temp: parent.temp + 350, vibrance: 8 }),
  },
  {
    name: "Cooler",
    author: AGENT,
    from: "A",
    rationale: "The same base, 300 K cooler and a little less saturated, closer to open shade.",
    changes: (parent) => ({ temp: parent.temp - 300, saturation: -10 }),
  },
  {
    name: "Open shadows",
    author: AGENT,
    from: "A",
    rationale: "Lifted the shadows and held the highlights for a softer, flatter file to grade from.",
    changes: () => ({ shadows: 28, highlights: -30, blacks: 8 }),
  },
  {
    name: "Muted",
    author: AGENT,
    from: "B",
    rationale: "Pulled saturation back by a fifth for a quieter set.",
    changes: () => ({ saturation: -20, vibrance: 0, contrast: -8 }),
  },
  {
    name: "Crisp",
    author: AGENT,
    from: "A",
    rationale: "Firmer blacks and more contrast, aimed at a print on white paper.",
    changes: () => ({ contrast: 22, blacks: -14, whites: 8 }),
  },
];

/** The same photo with exactly `count` lettered versions. */
export function withVersionCount(photo: Photo, count: number): Photo {
  const original = photo.versions[0]!;
  const versions = photo.versions.slice(0, count + 1);
  while (versions.length < count + 1) {
    const index = versions.length - 1;
    const look = SPARE_LOOKS[index % SPARE_LOOKS.length]!;
    const letter = String.fromCharCode(65 + index);
    const parent = versions.find((v) => v.letter === look.from) ?? original;
    versions.push({
      id: `${photo.id}-${letter.toLowerCase()}`,
      letter,
      name: look.name,
      author: look.author,
      rationale: look.rationale ?? null,
      parentId: parent.id,
      params: { ...parent.params, ...look.changes(parent.params) },
      seen: true,
    });
  }
  const pickId = versions.some((v) => v.id === photo.pickId) ? photo.pickId : null;
  return { ...photo, versions, pickId };
}

/** Notes already on the first photo, one in each state. */
export function buildMockNotes(): Record<string, Note[]> {
  return {
    p0412: [
      {
        id: "p0412-n1",
        number: 1,
        versionId: "p0412-a",
        region: { x: 0.04, y: 0.03, width: 0.26, height: 0.17 },
        text: "Sky is close to clipping at the top left.",
        author: YOU,
        state: { kind: "read" },
      },
      {
        id: "p0412-n2",
        number: 2,
        versionId: "p0412-a",
        region: { x: 0.07, y: 0.66, width: 0.3, height: 0.25 },
        text: "Grass feels grey here. Can it be warmer?",
        author: YOU,
        state: { kind: "addressed", versionId: "p0412-b" },
      },
      {
        id: "p0412-n3",
        number: 3,
        versionId: "p0412-c",
        region: { x: 0.505, y: 0.6, width: 0, height: 0 },
        text: "The denim looks right in this one.",
        author: YOU,
        state: { kind: "waiting" },
      },
    ],
  };
}

/** What the scripted agent points at, per photo, and a fallback for the rest. */
const POINTERS: Record<string, { region: Region; caption: string }> = {
  p0412: {
    region: { x: 0.452, y: 0.262, width: 0.09, height: 0.14 },
    caption: "Skin runs a little orange on the cheek here.",
  },
};

export function mockPointer(photoId: string): { region: Region; caption: string } {
  return (
    POINTERS[photoId] ?? {
      region: { x: 0.38, y: 0.24, width: 0.22, height: 0.26 },
      caption: "This area carries the most colour difference between the versions.",
    }
  );
}

export function buildMockShoot(): Shoot {
  return { name: "2026-11-14 Ozark portraits", photos: PHOTOS.map(buildPhoto) };
}

export const FIRST_PHOTO_ID = "p0412";
export const FIRST_VERSION_ID = "p0412-b";
