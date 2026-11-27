/*
 * MOCK ONLY. Stands in for the engine and the MCP server.
 *
 * It holds the made-up shoot in memory, answers the Session interface the
 * real app will implement, and plays a scripted "agent" so the page can be
 * judged in motion. Nothing here reads or writes a file.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { normalise, paramDef, type ParamId } from "../model/params";
import { ORIGINAL_ID, type AgentState, type AgentStatus, type PageStatus, type Photo, type Shoot, type Version } from "../model/types";
import { SessionContext, type Session } from "../session/Session";
import { mockLook } from "./filter";
import { countLevels, loadPixels } from "./histogram";
import { buildMockShoot, FIRST_PHOTO_ID, FIRST_VERSION_ID, MOCK_CLIENT } from "./shoot";

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
}

type Action =
  | { type: "page"; page: PageStatus }
  | { type: "loaded"; count: number }
  | { type: "selectPhoto"; photoId: string }
  | { type: "selectVersion"; versionId: string }
  | { type: "togglePick"; versionId: string }
  | { type: "setParam"; id: ParamId; value: number }
  | { type: "agentState"; state: AgentState; detail?: string }
  | { type: "agentNever" }
  | { type: "agentStart"; name: string; rationale: string }
  | { type: "agentSet"; versionId: string; photoId: string; id: ParamId; value: number }
  | { type: "agentSettle"; id: ParamId; count: number };

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

function nextLetter(photo: Photo): string {
  const used = photo.versions.filter((v) => v.letter).length;
  return String.fromCharCode(65 + used);
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

function reduce(state: MockState, action: Action): MockState {
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

    case "setParam": {
      if (!photo) return state;
      const current = photo.versions.find((v) => v.id === shownVersionId(state, photo));
      if (!current || current.params[action.id] === action.value) return state;
      const params = { ...current.params, [action.id]: action.value };

      // A person's own working copy takes the change directly. (Each change
      // will be a new snapshot in the engine; one row is enough for the mock.)
      if (current.author?.kind === "you") {
        const shoot = updatePhoto(state, photo.id, (p) => ({
          ...p,
          versions: p.versions.map((v) => (v.id === current.id ? { ...v, params } : v)),
        }));
        return { ...state, shoot };
      }

      // Anything else is immutable, so the first nudge starts a new version.
      const letter = nextLetter(photo);
      const fork: Version = {
        id: `${photo.id}-${letter.toLowerCase()}`,
        letter,
        name: "Adjusted",
        author: { kind: "you" },
        rationale: null,
        parentId: current.id,
        params,
        seen: true,
      };
      const shoot = updatePhoto(state, photo.id, (p) => ({ ...p, versions: [...p.versions, fork] }));
      return { ...state, shoot, shown: { ...state.shown, [photo.id]: fork.id } };
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
      const base = photo.versions.find((v) => v.id === shownVersionId(state, photo));
      if (!base) return state;
      const letter = nextLetter(photo);
      const version: Version = {
        id: `${photo.id}-${letter.toLowerCase()}`,
        letter,
        name: action.name,
        author: { kind: "agent", client: MOCK_CLIENT },
        rationale: action.rationale,
        parentId: base.id,
        params: base.params,
        seen: true,
      };
      const shoot = updatePhoto(state, photo.id, (p) => ({ ...p, versions: [...p.versions, version] }));
      return {
        ...state,
        shoot,
        shown: { ...state.shown, [photo.id]: version.id },
        agent: { client: MOCK_CLIENT, state: "working", detail: `Editing ${photo.fileName}, version ${letter}` },
      };
    }

    case "agentSet": {
      const touchCount = state.touchCount + 1;
      const shoot = updatePhoto(state, action.photoId, (p) => ({
        ...p,
        versions: p.versions.map((v) =>
          v.id === action.versionId ? { ...v, params: { ...v.params, [action.id]: action.value } } : v,
        ),
      }));
      return { ...state, shoot, touchCount, agentTouched: { ...state.agentTouched, [action.id]: touchCount } };
    }

    case "agentSettle": {
      if (state.agentTouched[action.id] !== action.count) return state;
      const agentTouched = { ...state.agentTouched };
      delete agentTouched[action.id];
      return { ...state, agentTouched };
    }
  }
}

/* ---------- start-up options, so screenshots can be scripted ---------- */

const PAGES: PageStatus[] = ["empty", "loading", "ready"];
const AGENT_STATES: AgentState[] = ["working", "waiting", "error", "done", "disconnected"];

function initialState(): MockState {
  const query = new URLSearchParams(window.location.search);
  const page = PAGES.find((p) => p === query.get("page")) ?? "ready";
  const agentState = AGENT_STATES.find((s) => s === query.get("agent")) ?? "waiting";
  const never = query.get("agent") === "never";
  const shoot = buildMockShoot();
  const first = shoot.photos.find((p) => p.id === FIRST_PHOTO_ID);
  return {
    page,
    loaded: 0,
    shoot,
    photoId: FIRST_PHOTO_ID,
    shown: { [FIRST_PHOTO_ID]: FIRST_VERSION_ID },
    agent: never ? NO_AGENT_YET : { client: MOCK_CLIENT, state: agentState, detail: agentDetail(agentState, first) },
    agentTouched: {},
    touchCount: 0,
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
  const version = photo ? (photo.versions.find((v) => v.id === shownVersionId(state, photo)) ?? null) : null;
  const parent = photo && version?.parentId ? (photo.versions.find((v) => v.id === version.parentId) ?? null) : null;
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
    const letter = nextLetter(photo);
    const versionId = `${photo.id}-${letter.toLowerCase()}`;
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
      const value = normalise(paramDef(id), raw);
      later(900 + index * 1200, () => {
        dispatch({ type: "agentSet", photoId: photo.id, versionId, id, value });
      });
    });
    later(900 + edits.length * 1200 + 600, () => {
      dispatch({ type: "agentState", state: "waiting", detail: `Version ${letter} is ready to compare` });
      setAgentEditRunning(false);
    });
  }, [agentEditRunning, later, photo, state.page, version]);

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
      shownVersion: (p) => p.versions.find((v) => v.id === shownVersionId(state, p)) ?? p.versions[0]!,
      openFolder: () => {
        finishLoading.current = true;
        dispatch({ type: "page", page: "loading" });
      },
      selectPhoto: (photoId) => dispatch({ type: "selectPhoto", photoId }),
      selectVersion: (versionId) => dispatch({ type: "selectVersion", versionId }),
      togglePick: (versionId) => dispatch({ type: "togglePick", versionId }),
      setParam: (id, value) => dispatch({ type: "setParam", id, value }),
    };
  }, [state, photo, version, parent, histogram]);

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
    }),
    [state.page, state.agent, runAgentEdit, agentEditRunning],
  );

  return (
    <MockControlsContext.Provider value={controls}>
      <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
    </MockControlsContext.Provider>
  );
}
