/*
 * MOCK ONLY. Stands in for the engine and the MCP server.
 *
 * It holds the made-up shoot in memory, answers the Session interface the
 * real app will implement, and plays a scripted "agent" so the page can be
 * judged in motion. Nothing here reads or writes a file.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { clampValue, paramDef, type ParamId } from "../model/params";
import {
  ORIGINAL_ID,
  type AgentPointer,
  type AgentState,
  type AgentStatus,
  type AgentViewRequest,
  type Author,
  type Note,
  type PageStatus,
  type Photo,
  type Region,
  type Shoot,
  type Version,
} from "../model/types";
import {
  addVersion,
  beginEdit,
  changeParam,
  commitEdit,
  editParam,
  nextLetter,
  previewEdit,
  type Change,
  type Edit,
} from "../model/versions";
import { startupOptions } from "../platform/query";
import { SessionContext, type Session } from "../session/Session";
import { mockLook } from "./filter";
import { countLevels, loadPixels } from "./histogram";
import { MockSessionPreview } from "./MockPreview";
import { MockSessionPixels } from "./MockVersionCanvas";
import {
  buildMockNotes,
  buildMockShoot,
  FIRST_PHOTO_ID,
  FIRST_VERSION_ID,
  MOCK_CLIENT,
  mockPointer,
  withVersionCount,
} from "./shoot";

/* ---------- state ---------- */

interface MockState {
  page: PageStatus;
  /** Previews "decoded" so far while the page is loading. */
  loaded: number;
  shoot: Shoot;
  photoId: string;
  /** The version on screen for each photo the person has visited. */
  shown: Record<string, string>;
  agent: AgentStatus;
  agentTouched: Partial<Record<ParamId, number>>;
  touchCount: number;
  /** The person's gesture in progress, if any, and the photo it is on. */
  edit: (Edit & { photoId: string }) | null;
  /** The version the scripted agent is writing, while it is. */
  agentRun: { photoId: string; versionId: string; name: string; rationale: string } | null;
  /** Notes by photo id. */
  notes: Record<string, Note[]>;
  pointer: (AgentPointer & { photoId: string }) | null;
  agentView: AgentViewRequest | null;
  /** Counts pointers and view requests. */
  stamp: number;
  /** Version ids whose pixels are "still rendering". */
  rendering: Record<string, true>;
  /** A reviewer holding all tiles but the first in their rendering state. */
  holdRendering: boolean;
}

type Action =
  | { type: "page"; page: PageStatus }
  | { type: "loaded"; count: number }
  | { type: "selectPhoto"; photoId: string }
  | { type: "selectVersion"; versionId: string }
  | { type: "togglePick"; versionId: string }
  | { type: "setDropped"; versionId: string; dropped: boolean }
  | { type: "setParam"; id: ParamId; value: number }
  | { type: "beginEdit" }
  | { type: "commitEdit" }
  | { type: "agentState"; state: AgentState; detail?: string }
  | { type: "agentNever" }
  | { type: "agentStart"; name: string; rationale: string }
  | { type: "agentSet"; id: ParamId; value: number }
  | { type: "agentFinish" }
  | { type: "agentSettle"; id: ParamId; count: number }
  | { type: "addNote"; versionId: string; region: Region; text: string }
  | { type: "removeNote"; noteId: string }
  | { type: "keepPointer" }
  | { type: "clearPointer"; id?: number }
  | { type: "versionCount"; count: number }
  | { type: "agentPoint" }
  | { type: "agentRead" }
  | { type: "agentAddress"; noteId: string; versionId: string }
  | { type: "rendered"; versionId: string }
  | { type: "holdRendering"; on: boolean };

function agentDetail(state: AgentState, photo: Photo | undefined): string {
  const file = photo?.fileName ?? "the shoot";
  switch (state) {
    case "working":
      return `Editing ${file}`;
    case "waiting":
      return `Wants your pick on ${file}`;
    case "error":
      return "A tool call failed: set_adjustments";
    case "done":
      return "Finished 6 photos, 10 versions";
    case "disconnected":
      return "Last connected 12 minutes ago";
  }
}

/** Before any client has connected: nobody to name. */
const NO_AGENT_YET: AgentStatus = {
  client: null,
  state: "disconnected",
  detail: "Kromskop is ready for an agent, but none has connected yet.",
};

function defaultVersionId(photo: Photo): string {
  return photo.pickId ?? photo.versions[photo.versions.length - 1]?.id ?? ORIGINAL_ID;
}

function shownVersionId(state: MockState, photo: Photo): string {
  return state.shown[photo.id] ?? defaultVersionId(photo);
}

function updatePhoto(state: MockState, photoId: string, change: (photo: Photo) => Photo): Shoot {
  return { ...state.shoot, photos: state.shoot.photos.map((p) => (p.id === photoId ? change(p) : p)) };
}

function markSeen(photo: Photo, versionId: string): Photo {
  if (photo.versions.every((v) => v.id !== versionId || v.seen)) return photo;
  return { ...photo, versions: photo.versions.map((v) => (v.id === versionId ? { ...v, seen: true } : v)) };
}

function show(state: MockState, photoId: string, versionId: string): MockState {
  return {
    ...state,
    photoId,
    shown: { ...state.shown, [photoId]: versionId },
    shoot: updatePhoto(state, photoId, (p) => markSeen(p, versionId)),
  };
}

/** How long the agent's pointer stays before it has faded. */
const POINTER_LIFETIME_MS = 9000;

/** The oldest note of the person's that no version has answered yet. */
function openNote(notes: readonly Note[]): Note | undefined {
  return notes.find((n) => n.author.kind === "you" && (n.state.kind === "waiting" || n.state.kind === "read"));
}

const PERSONS_FORK = { name: "Adjusted" };

/** Puts the outcome of an edit into the state and shows the version it ended on. */
function applyChange(state: MockState, photo: Photo, change: Change): MockState {
  if (change.photo === photo) return state;
  // A working copy that was discarded hands its notes to the version it
  // was made from, which looks the same, and is no longer dropped.
  const gone = change.discarded;
  const next = gone ? { ...change.photo, droppedIds: change.photo.droppedIds.filter((id) => id !== gone) } : change.photo;
  const notes = gone
    ? { ...state.notes, [photo.id]: (state.notes[photo.id] ?? []).map((n) => (n.versionId === gone ? { ...n, versionId: change.versionId } : n)) }
    : state.notes;
  return {
    ...state,
    shoot: updatePhoto(state, photo.id, () => next),
    shown: { ...state.shown, [photo.id]: change.versionId },
    notes,
  };
}

function reduce(state: MockState, action: Action): MockState {
  // Moving to another photo or version ends a gesture that was left open.
  if (state.edit && (action.type === "selectPhoto" || action.type === "selectVersion" || action.type === "page")) {
    return reduce(reduce(state, { type: "commitEdit" }), action);
  }
  const photo = state.shoot.photos.find((p) => p.id === state.photoId);

  switch (action.type) {
    case "page":
      return { ...state, page: action.page, loaded: 0 };

    case "loaded":
      return { ...state, loaded: action.count };

    case "selectPhoto": {
      const next = state.shoot.photos.find((p) => p.id === action.photoId);
      return next ? show(state, next.id, shownVersionId(state, next)) : state;
    }

    case "selectVersion":
      return photo ? show(state, photo.id, action.versionId) : state;

    case "togglePick": {
      if (!photo) return state;
      const shoot = updatePhoto(state, photo.id, (p) => ({
        ...markSeen(p, action.versionId),
        pickId: p.pickId === action.versionId ? null : action.versionId,
      }));
      return { ...state, shoot };
    }

    case "setDropped": {
      if (!photo || photo.droppedIds.includes(action.versionId) === action.dropped) return state;
      const droppedIds = action.dropped
        ? [...photo.droppedIds, action.versionId]
        : photo.droppedIds.filter((id) => id !== action.versionId);
      return { ...state, shoot: updatePhoto(state, photo.id, (p) => ({ ...p, droppedIds })) };
    }

    case "beginEdit":
      if (!photo || state.edit) return state;
      return { ...state, edit: { ...beginEdit(shownVersionId(state, photo), { kind: "you" }), photoId: photo.id } };

    case "setParam": {
      if (!photo) return state;
      // Inside a gesture the change is only noted. The photo, its versions,
      // its pick, its notes and what was dropped stay exactly as they are
      // until the commit.
      if (state.edit) return { ...state, edit: { ...state.edit, ...editParam(state.edit, action.id, action.value) } };
      // Outside one, the change is an edit of its own. The rules live in
      // model/versions: a change to the original, to the agent's version, or
      // to anything with versions built on it starts a new version.
      return applyChange(state, photo, changeParam(photo, shownVersionId(state, photo), action.id, action.value, { kind: "you" }, PERSONS_FORK));
    }

    case "commitEdit": {
      const edit = state.edit;
      if (!edit) return state;
      const edited = state.shoot.photos.find((p) => p.id === edit.photoId);
      const closed = { ...state, edit: null };
      return edited ? applyChange(closed, edited, commitEdit(edited, edit, PERSONS_FORK)) : closed;
    }

    case "agentState":
      return {
        ...state,
        agent: { client: MOCK_CLIENT, state: action.state, detail: action.detail ?? agentDetail(action.state, photo) },
      };

    case "agentNever":
      return { ...state, agent: NO_AGENT_YET };

    case "agentStart": {
      if (!photo) return state;
      const agent: Author = { kind: "agent", client: MOCK_CLIENT };
      // The person is watching it being made, so it counts as seen.
      const added = addVersion(photo, shownVersionId(state, photo), agent, { name: action.name, rationale: action.rationale, seen: true });
      return {
        ...state,
        shoot: updatePhoto(state, photo.id, () => added.photo),
        shown: { ...state.shown, [photo.id]: added.version.id },
        agentRun: { photoId: photo.id, versionId: added.version.id, name: action.name, rationale: action.rationale },
        agent: { client: MOCK_CLIENT, state: "working", detail: `Editing ${photo.fileName}, version ${added.version.letter}` },
      };
    }

    case "agentSet": {
      const run = state.agentRun;
      const target = state.shoot.photos.find((p) => p.id === run?.photoId);
      if (!run || !target) return state;
      // If the person has built on the version meanwhile, the agent may not
      // reach into it any more: its next change starts a version of its own.
      const change = changeParam(
        target,
        run.versionId,
        action.id,
        action.value,
        { kind: "agent", client: MOCK_CLIENT },
        { name: run.name, rationale: run.rationale, seen: false },
      );
      const watching = state.photoId === target.id && shownVersionId(state, target) === run.versionId;
      const touchCount = state.touchCount + 1;
      return {
        ...state,
        shoot: updatePhoto(state, target.id, () => change.photo),
        agentRun: { ...run, versionId: change.versionId },
        // The view follows the agent only while the person is still on its version.
        shown: watching ? { ...state.shown, [target.id]: change.versionId } : state.shown,
        touchCount,
        // A row is marked only where the change can be seen.
        agentTouched: watching ? { ...state.agentTouched, [action.id]: touchCount } : state.agentTouched,
      };
    }

    case "agentFinish": {
      const run = state.agentRun;
      const made = state.shoot.photos.find((p) => p.id === run?.photoId)?.versions.find((v) => v.id === run?.versionId);
      return {
        ...state,
        agentRun: null,
        agent: { client: MOCK_CLIENT, state: "waiting", detail: made ? `Version ${made.letter} is ready to compare` : state.agent.detail },
      };
    }

    case "agentSettle": {
      if (state.agentTouched[action.id] !== action.count) return state;
      const agentTouched = { ...state.agentTouched };
      delete agentTouched[action.id];
      return { ...state, agentTouched };
    }

    case "addNote": {
      if (!photo) return state;
      const existing = state.notes[photo.id] ?? [];
      const number = existing.reduce((max, n) => Math.max(max, n.number), 0) + 1;
      const note: Note = {
        id: `${photo.id}-n${number}`,
        number,
        versionId: action.versionId,
        region: action.region,
        text: action.text,
        author: { kind: "you" },
        state: { kind: "waiting" },
      };
      return { ...state, notes: { ...state.notes, [photo.id]: [...existing, note] } };
    }

    case "removeNote": {
      if (!photo) return state;
      const kept = (state.notes[photo.id] ?? []).filter((n) => n.id !== action.noteId);
      return { ...state, notes: { ...state.notes, [photo.id]: kept } };
    }

    case "keepPointer": {
      const pointer = state.pointer;
      if (!pointer) return state;
      const existing = state.notes[pointer.photoId] ?? [];
      const number = existing.reduce((max, n) => Math.max(max, n.number), 0) + 1;
      const note: Note = {
        id: `${pointer.photoId}-n${number}`,
        number,
        versionId: pointer.versionId,
        region: pointer.region,
        text: pointer.caption,
        author: { kind: "agent", client: MOCK_CLIENT },
        state: { kind: "kept" },
      };
      return { ...state, pointer: null, notes: { ...state.notes, [pointer.photoId]: [...existing, note] } };
    }

    case "clearPointer":
      if (!state.pointer || (action.id !== undefined && state.pointer.id !== action.id)) return state;
      return { ...state, pointer: null };

    case "versionCount": {
      if (!photo) return state;
      const next = withVersionCount(photo, action.count);
      const ids = new Set(next.versions.map((v) => v.id));
      const shownId = shownVersionId(state, photo);
      return {
        ...state,
        shoot: updatePhoto(state, photo.id, () => next),
        shown: { ...state.shown, [photo.id]: ids.has(shownId) ? shownId : defaultVersionId(next) },
        notes: { ...state.notes, [photo.id]: (state.notes[photo.id] ?? []).filter((n) => ids.has(n.versionId)) },
        pointer: null,
      };
    }

    case "agentPoint": {
      if (!photo) return state;
      // Point at something other than what is on screen, so the view has to move.
      const lettered = photo.versions.filter((v) => v.letter);
      const shownId = shownVersionId(state, photo);
      const target =
        lettered.find((v) => v.id === photo.pickId && v.id !== shownId) ?? lettered.find((v) => v.id !== shownId) ?? lettered[0];
      if (!target) return state;
      const stamp = state.stamp + 1;
      const { region, caption } = mockPointer(photo.id);
      return {
        ...state,
        stamp,
        pointer: { id: stamp, photoId: photo.id, versionId: target.id, region, caption, lifetime: POINTER_LIFETIME_MS },
        agentView: {
          stamp,
          photoId: photo.id,
          focusVersionId: target.id,
          centre: { x: region.x + region.width / 2, y: region.y + region.height / 2 },
          magnification: 2.4,
        },
        agent: { client: MOCK_CLIENT, state: "waiting", detail: `Pointing at version ${target.letter} of ${photo.fileName}` },
      };
    }

    case "agentRead": {
      if (!photo) return state;
      const notes = (state.notes[photo.id] ?? []).map((n) =>
        n.state.kind === "waiting" ? { ...n, state: { kind: "read" } as const } : n,
      );
      return { ...state, notes: { ...state.notes, [photo.id]: notes } };
    }

    case "agentAddress": {
      if (!photo) return state;
      const notes = state.notes[photo.id] ?? [];
      const note = notes.find((n) => n.id === action.noteId);
      const base = photo.versions.find((v) => v.id === (photo.pickId ?? note?.versionId)) ?? photo.versions[0];
      if (!note || !base) return state;
      const first = note.id === "p0412-n1";
      const added = addVersion(photo, base.id, { kind: "agent", client: MOCK_CLIENT }, {
        name: first ? "Sky held" : `Note ${note.number} answered`,
        rationale: first
          ? "Pulled highlights and whites down so the sky at the top left keeps its tone. Answers note 1."
          : `Eased the highlights and opened the shadows in the marked area. Answers note ${note.number}.`,
        seen: true,
      });
      const letter = added.version.letter;
      const version: Version = {
        ...added.version,
        params: {
          ...base.params,
          highlights: Math.max(-100, base.params.highlights - 34),
          whites: Math.max(-100, base.params.whites - 14),
          shadows: first ? base.params.shadows : Math.min(100, base.params.shadows + 10),
        },
      };
      const withVersion = { ...added.photo, versions: added.photo.versions.map((v) => (v.id === version.id ? version : v)) };
      const stamp = state.stamp + 1;
      return {
        ...state,
        stamp,
        shoot: updatePhoto(state, photo.id, () => withVersion),
        // The agent asks Compare to show its new version; Compare decides
        // whether and when, so a drag in progress is not interrupted.
        notes: {
          ...state.notes,
          [photo.id]: notes.map((n) =>
            n.id === note.id
              ? { ...n, state: { kind: "addressed", versionId: version.id } as const }
              : n.state.kind === "waiting"
                ? { ...n, state: { kind: "read" } as const }
                : n,
          ),
        },
        rendering: { ...state.rendering, [version.id]: true },
        agentView: { stamp, photoId: photo.id, focusVersionId: version.id },
        agent: { client: MOCK_CLIENT, state: "working", detail: `Rendering version ${letter} of ${photo.fileName}` },
      };
    }

    case "rendered": {
      const rendering = { ...state.rendering };
      delete rendering[action.versionId];
      return { ...state, rendering };
    }

    case "holdRendering":
      return { ...state, holdRendering: action.on };
  }
}

/* ---------- start-up options, so screenshots can be scripted ---------- */

const PAGES: PageStatus[] = ["empty", "loading", "ready"];
const AGENT_STATES: AgentState[] = ["working", "waiting", "error", "done", "disconnected"];

function initialState(): MockState {
  const query = startupOptions();
  const page = PAGES.find((p) => p === query.get("page")) ?? "ready";
  const agentState = AGENT_STATES.find((s) => s === query.get("agent")) ?? "waiting";
  const never = query.get("agent") === "never";
  let shoot = buildMockShoot();
  const photoId = shoot.photos.find((p) => p.id === query.get("photo"))?.id ?? FIRST_PHOTO_ID;
  const count = Number(query.get("versions"));
  if (Number.isInteger(count) && count >= 1 && count <= 6) {
    shoot = { ...shoot, photos: shoot.photos.map((p) => (p.id === photoId ? withVersionCount(p, count) : p)) };
  }
  const first = shoot.photos.find((p) => p.id === photoId);
  const firstVersion = first?.versions.find((v) => v.id === FIRST_VERSION_ID);
  const notes = buildMockNotes();
  for (const [id, list] of Object.entries(notes)) {
    const versions = new Set(shoot.photos.find((p) => p.id === id)?.versions.map((v) => v.id));
    notes[id] = list.filter((n) => versions.has(n.versionId));
  }
  return {
    page,
    loaded: 0,
    shoot,
    photoId,
    shown: firstVersion ? { [photoId]: firstVersion.id } : {},
    notes,
    pointer: null,
    agentView: null,
    stamp: 0,
    rendering: {},
    holdRendering: query.get("tiles") === "rendering",
    agent: never ? NO_AGENT_YET : { client: MOCK_CLIENT, state: agentState, detail: agentDetail(agentState, first) },
    agentTouched: {},
    touchCount: 0,
    edit: null,
    agentRun: null,
  };
}

/* ---------- controls only the mock has ---------- */

export interface MockControls {
  page: PageStatus;
  setPage(page: PageStatus): void;
  /** "never" is the state before any client has connected. */
  agentState: AgentState | "never";
  setAgentState(state: AgentState | "never"): void;
  /** Plays the scripted agent: a new version, then three slider changes. */
  runAgentEdit(): void;
  agentEditRunning: boolean;

  /** Lettered versions of the photo on screen. */
  versionCount: number;
  setVersionCount(count: number): void;
  /** The agent draws a rectangle on a version and moves the view to it. */
  agentPoints(): void;
  /** The agent asks for the notes, so waiting ones become read. */
  agentReadsNotes(): void;
  /** The agent answers the oldest open note with a new version. */
  agentAddressesNote(): void;
  /** Number of the note that would be answered, or null when none is open. */
  openNoteNumber: number | null;
  waitingNotes: number;
  holdRendering: boolean;
  setHoldRendering(on: boolean): void;
}

const MockControlsContext = createContext<MockControls | null>(null);

export function useMockControls(): MockControls {
  const controls = useContext(MockControlsContext);
  if (!controls) throw new Error("useMockControls needs MockSessionProvider above it");
  return controls;
}

/** How long a slider keeps its agent mark. Matches --duration-agent-mark. */
const AGENT_MARK_MS = 2600;
/** Previews the loading state shows as done when a reviewer holds it open. */
const LOADING_HOLD_AT = 4;

export function MockSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const [agentEditRunning, setAgentEditRunning] = useState(false);
  /** When true the loading state runs through to ready, as a real open would. */
  const finishLoading = useRef(false);
  const timers = useRef<number[]>([]);

  const later = useCallback((ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const photo = state.shoot.photos.find((p) => p.id === state.photoId) ?? null;
  // While a gesture is open, what is shown is the edit in progress: the
  // version with the gesture's changes, against the parent it will have.
  const editing = photo && state.edit?.photoId === photo.id ? previewEdit(photo, state.edit) : null;
  const stored = photo ? (photo.versions.find((v) => v.id === shownVersionId(state, photo)) ?? null) : null;
  const version = editing?.version ?? stored;
  const parent = editing ? editing.parent : photo && stored?.parentId ? (photo.versions.find((v) => v.id === stored.parentId) ?? null) : null;
  const original = photo?.versions[0] ?? null;

  // Loading: previews arrive one at a time.
  useEffect(() => {
    if (state.page !== "loading") return;
    const total = state.shoot.photos.length;
    const stopAt = finishLoading.current ? total : LOADING_HOLD_AT;
    if (state.loaded >= stopAt) {
      if (!finishLoading.current) return;
      const done = window.setTimeout(() => {
        finishLoading.current = false;
        dispatch({ type: "page", page: "ready" });
      }, 400);
      return () => window.clearTimeout(done);
    }
    const tick = window.setTimeout(() => dispatch({ type: "loaded", count: state.loaded + 1 }), 520);
    return () => window.clearTimeout(tick);
  }, [state.page, state.loaded, state.shoot.photos.length]);

  // Histogram of what is on screen.
  const [pixels, setPixels] = useState<{ url: string; data: ImageData } | null>(null);
  const previewUrl = photo?.previewUrl ?? null;
  useEffect(() => {
    if (!previewUrl) return;
    let current = true;
    loadPixels(previewUrl).then(
      (data) => current && setPixels({ url: previewUrl, data }),
      () => current && setPixels(null),
    );
    return () => {
      current = false;
    };
  }, [previewUrl]);

  const histogram = useMemo(() => {
    if (!pixels || !version || !original || pixels.url !== previewUrl) return null;
    return countLevels(pixels.data, mockLook(version.params, original.params));
  }, [pixels, previewUrl, version, original]);

  const runAgentEdit = useCallback(() => {
    if (agentEditRunning || !photo || !version || state.page !== "ready") return;
    setAgentEditRunning(true);
    const base = version.params;
    const edits: Array<[ParamId, number]> = [
      ["exposure", base.exposure + 0.3],
      ["temp", base.temp + 400],
      ["contrast", base.contrast - 10],
    ];

    dispatch({
      type: "agentStart",
      name: "Softer, warmer",
      rationale: "Lifted exposure by a third of a stop, warmed the balance 400 K and eased contrast for softer skin.",
    });

    edits.forEach(([id, raw], index) => {
      const value = clampValue(paramDef(id), raw);
      later(900 + index * 1200, () => dispatch({ type: "agentSet", id, value }));
    });
    later(900 + edits.length * 1200 + 600, () => {
      dispatch({ type: "agentFinish" });
      setAgentEditRunning(false);
    });
  }, [agentEditRunning, later, photo, state.page, version]);

  const notes = useMemo(() => (photo ? (state.notes[photo.id] ?? []) : []), [photo, state.notes]);
  const pointer = state.pointer && state.pointer.photoId === photo?.id ? state.pointer : null;

  // The agent's pointer fades on its own unless the person keeps it.
  const pointerId = state.pointer?.id;
  useEffect(() => {
    if (pointerId === undefined) return;
    const fade = window.setTimeout(() => dispatch({ type: "clearPointer", id: pointerId }), POINTER_LIFETIME_MS);
    return () => window.clearTimeout(fade);
  }, [pointerId]);

  const agentAddressesNote = useCallback(() => {
    const note = openNote(notes);
    if (!photo || !note || state.page !== "ready") return;
    const letter = nextLetter(photo);
    const versionId = `${photo.id}-${letter.toLowerCase()}`;
    dispatch({ type: "agentAddress", noteId: note.id, versionId });
    later(1800, () => {
      dispatch({ type: "rendered", versionId });
      dispatch({ type: "agentState", state: "waiting", detail: `Version ${letter} answers note ${note.number}` });
    });
  }, [later, notes, photo, state.page]);

  const rendering = useMemo(() => {
    // Held open by a reviewer, the first version has arrived and the rest have not.
    const ids = photo
      ? photo.versions.filter((v, index) => v.letter && ((state.holdRendering && index > 1) || state.rendering[v.id]))
      : [];
    return new Set(ids.map((v) => v.id));
  }, [photo, state.holdRendering, state.rendering]);

  // Let each agent mark fade, then forget it so it does not replay.
  useEffect(() => {
    const pending = Object.entries(state.agentTouched).map(([id, count]) =>
      window.setTimeout(() => dispatch({ type: "agentSettle", id: id as ParamId, count: count ?? 0 }), AGENT_MARK_MS),
    );
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, [state.agentTouched]);

  const session = useMemo<Session>(() => {
    const ready = state.page === "ready";
    return {
      status: state.page,
      progress:
        state.page === "loading"
          ? { done: state.loaded, total: state.shoot.photos.length }
          : null,
      shoot: state.page === "empty" ? null : state.shoot,
      photo: state.page === "empty" ? null : photo,
      version: ready ? version : null,
      parent: ready ? parent : null,
      agent: state.agent,
      agentTouched: state.agentTouched,
      histogram: ready ? histogram : null,
      Preview: MockSessionPreview,
      Pixels: MockSessionPixels,
      notes: ready ? notes : [],
      agentPointer: ready ? pointer : null,
      agentView: state.agentView,
      rendering,
      shownVersion: (p) => p.versions.find((v) => v.id === shownVersionId(state, p)) ?? p.versions[0]!,
      openFolder: () => {
        finishLoading.current = true;
        dispatch({ type: "page", page: "loading" });
      },
      selectPhoto: (photoId) => dispatch({ type: "selectPhoto", photoId }),
      selectVersion: (versionId) => dispatch({ type: "selectVersion", versionId }),
      togglePick: (versionId) => dispatch({ type: "togglePick", versionId }),
      setDropped: (versionId, dropped) => dispatch({ type: "setDropped", versionId, dropped }),
      beginEdit: () => dispatch({ type: "beginEdit" }),
      commitEdit: () => dispatch({ type: "commitEdit" }),
      setParam: (id, value) => dispatch({ type: "setParam", id, value }),
      addNote: (versionId, region, text) => dispatch({ type: "addNote", versionId, region, text }),
      removeNote: (noteId) => dispatch({ type: "removeNote", noteId }),
      keepAgentPointer: () => dispatch({ type: "keepPointer" }),
      dismissAgentPointer: () => dispatch({ type: "clearPointer" }),
    };
  }, [state, photo, version, parent, histogram, notes, pointer, rendering]);

  const controls = useMemo<MockControls>(
    () => ({
      page: state.page,
      setPage: (page) => {
        finishLoading.current = false;
        dispatch({ type: "page", page });
      },
      agentState: state.agent.client === null ? "never" : state.agent.state,
      setAgentState: (agentState) =>
        dispatch(agentState === "never" ? { type: "agentNever" } : { type: "agentState", state: agentState }),
      runAgentEdit,
      agentEditRunning,
      versionCount: photo ? photo.versions.length - 1 : 0,
      setVersionCount: (count) => dispatch({ type: "versionCount", count }),
      agentPoints: () => dispatch({ type: "agentPoint" }),
      agentReadsNotes: () => dispatch({ type: "agentRead" }),
      agentAddressesNote,
      openNoteNumber: openNote(notes)?.number ?? null,
      waitingNotes: notes.filter((n) => n.state.kind === "waiting").length,
      holdRendering: state.holdRendering,
      setHoldRendering: (on) => dispatch({ type: "holdRendering", on }),
    }),
    [state.page, state.agent, state.holdRendering, runAgentEdit, agentEditRunning, photo, notes, agentAddressesNote],
  );

  return (
    <MockControlsContext.Provider value={controls}>
      <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
    </MockControlsContext.Provider>
  );
}
