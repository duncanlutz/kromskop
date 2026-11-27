import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { ORIGINAL_ID, type Photo, type Region, type Version } from "../model/types";
import { fromQuery } from "../platform/query";
import { useSession } from "../session/Session";
import { useView } from "../shell/ViewState";
import { actualSizeScale, clampCentre, explicit, FIT_VIEW, maxScale, place, type Offset, type Size, type View } from "./view";

export type CompareMode = "grid" | "flip" | "split" | "reference";

export const COMPARE_MODES: Array<{ id: CompareMode; label: string; key: string; hint: string }> = [
  { id: "grid", label: "Grid", key: "Esc", hint: "Every version side by side" },
  { id: "flip", label: "Flip", key: "F", hint: "One at a time, swapped in place" },
  { id: "split", label: "Split", key: "S", hint: "Two versions across a divider" },
  { id: "reference", label: "Reference", key: "R", hint: "One pinned, the others beside it" },
];

/** Most versions shown at once. */
export const MAX_COMPARED = 6;

/** A note that has a place but no words yet. */
export interface NoteDraft {
  versionId: string;
  region: Region;
}

/* ---------- what is compared, and how ---------- */

interface CompareState {
  mode: CompareMode;
  setMode(mode: CompareMode): void;

  /** Versions in the comparison, in the order of their tiles. */
  compared: Version[];
  isCompared(versionId: string): boolean;
  /** Adds a version to the comparison or takes it out. Nothing is deleted. */
  toggleCompared(versionId: string): void;
  dropFocused(): void;
  /** Brings back the version dropped most recently. */
  restoreLast(): void;
  canRestore: boolean;

  /** The tile that keys act on. It is the session's current version. */
  focus: Version | null;
  focusVersion(versionId: string): void;
  /** What the focused version is measured against. */
  against: Version | null;
  swapPair(): void;
  /** A pinned version every other one is compared with. */
  referenceId: string | null;
  setReference(versionId: string | null): void;

  /** True while the view is where the agent put it. Any input from a person ends it. */
  following: boolean;
  humanInput(): void;
  /** Set while a person is dragging; the agent must not move the view then. */
  dragging: MutableRefObject<boolean>;

  markersHidden: boolean;
  toggleMarkers(): void;
  panelsHidden: boolean;
  togglePanels(): void;

  /** True while the next press on a tile places a note. */
  noteTool: boolean;
  setNoteTool(on: boolean): void;
  draft: NoteDraft | null;
  setDraft(draft: NoteDraft | null): void;
  highlightedNoteId: string | null;
  highlightNote(noteId: string | null): void;

  /** Position of the Split divider, 0 to 1 across the tile. */
  split: number;
  setSplit(position: number): void;
}

/* ---------- zoom and pan, kept apart so panels do not redraw per frame ---------- */

export interface Gesture {
  versionId: string;
  viewport: Size;
  /** Move this tile only (Shift), leaving the others where they are. */
  alone: boolean;
}

interface CompareView {
  view: View;
  offsets: Readonly<Record<string, Offset>>;
  /** Scale of a fitted photo in the focused tile, for the zoom readout. */
  fitScale: number;
  reportFitScale(scale: number): void;
  pan(gesture: Gesture, dx: number, dy: number): void;
  /** Zooms by a factor, keeping the point under the pointer still. */
  zoomAt(gesture: Gesture, pointer: { x: number; y: number }, factor: number): void;
  /** Fitted goes to 100% at the pointer; anything else goes back to fitted. */
  toggleZoom(gesture: Gesture, pointer: { x: number; y: number }): void;
  fitAll(): void;
}

const StateContext = createContext<CompareState | null>(null);
const ViewContext = createContext<CompareView | null>(null);

export function useCompare(): CompareState {
  const state = useContext(StateContext);
  if (!state) throw new Error("useCompare needs CompareProvider above it");
  return state;
}

export function useCompareView(): CompareView {
  const view = useContext(ViewContext);
  if (!view) throw new Error("useCompareView needs CompareProvider above it");
  return view;
}

interface PhotoChoices {
  dropped: string[];
  againstId: string | null;
  referenceId: string | null;
}

/** The original stays out until asked for: versions are what is being judged. */
const DEFAULT_CHOICES: PhotoChoices = { dropped: [ORIGINAL_ID], againstId: null, referenceId: null };

function comparedVersions(photo: Photo | null, choices: PhotoChoices, focusId: string | undefined): Version[] {
  if (!photo) return [];
  const lettered = photo.versions.filter((v) => v.letter && !choices.dropped.includes(v.id));
  const original = photo.versions.filter((v) => !v.letter && !choices.dropped.includes(v.id));
  const all = [...lettered, ...original];
  // More than six cannot be judged at once: the oldest give way, never the pick or the focus.
  while (all.length > MAX_COMPARED) {
    const index = all.findIndex((v) => v.id !== photo.pickId && v.id !== focusId && v.id !== choices.referenceId);
    all.splice(index < 0 ? 0 : index, 1);
  }
  return all;
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const { photo, version, selectVersion, agentView } = session;
  const photoId = photo?.id ?? "";
  // Compare's rules about focus apply only while Compare is on screen.
  const active = useView().view === "compare";

  const [mode, setModeState] = useState<CompareMode>(() => fromQuery("mode", ["grid", "flip", "split", "reference"], "grid"));
  const [choicesByPhoto, setChoicesByPhoto] = useState<Record<string, PhotoChoices>>({});
  const [following, setFollowing] = useState(false);
  const [markersHidden, setMarkersHidden] = useState(false);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [noteTool, setNoteToolState] = useState(false);
  const [draft, setDraftState] = useState<NoteDraft | null>(null);
  const [highlightedNoteId, highlightNote] = useState<string | null>(null);
  const [split, setSplitState] = useState(0.5);
  const [moving, setMoving] = useState<{ view: View; offsets: Record<string, Offset> }>({ view: FIT_VIEW, offsets: {} });
  const [fit, setFit] = useState(0);
  const dragging = useRef(false);

  const choices = choicesByPhoto[photoId] ?? DEFAULT_CHOICES;
  const setChoices = useCallback(
    (change: (current: PhotoChoices) => PhotoChoices) => {
      if (!photoId) return;
      setChoicesByPhoto((all) => ({ ...all, [photoId]: change(all[photoId] ?? DEFAULT_CHOICES) }));
    },
    [photoId],
  );

  const compared = useMemo(() => comparedVersions(photo, choices, version?.id), [photo, choices, version?.id]);
  const focus = compared.find((v) => v.id === version?.id) ?? null;

  // A new photo starts fitted, with nothing half-written.
  useEffect(() => {
    setMoving({ view: FIT_VIEW, offsets: {} });
    setDraftState(null);
    setNoteToolState(false);
    setFollowing(false);
  }, [photoId]);

  // The focus is always one of the tiles. If the current version is not
  // among them (the original, or one just dropped), move to one that is.
  useEffect(() => {
    if (!active || !photo || focus || compared.length === 0) return;
    const next = compared.find((v) => v.id === photo.pickId) ?? compared[0];
    if (next) selectVersion(next.id);
  }, [active, photo, focus, compared, selectVersion]);

  // In Reference the pinned version is never also the one being judged.
  const reference = compared.find((v) => v.id === choices.referenceId) ?? null;
  const against = useMemo(() => {
    const others = compared.filter((v) => v.id !== focus?.id);
    return (
      (reference && reference.id !== focus?.id ? reference : undefined) ??
      others.find((v) => v.id === choices.againstId) ??
      others.find((v) => v.id === photo?.pickId) ??
      others[0] ??
      null
    );
  }, [compared, focus, reference, choices.againstId, photo?.pickId]);

  const focusVersion = useCallback(
    (versionId: string) => {
      if (versionId === version?.id) return;
      // The version just left becomes the other half of the pair.
      if (version && compared.some((v) => v.id === version.id)) {
        setChoices((c) => ({ ...c, againstId: version.id }));
      }
      setChoices((c) => ({ ...c, dropped: c.dropped.filter((id) => id !== versionId) }));
      selectVersion(versionId);
    },
    [version, compared, setChoices, selectVersion],
  );

  const setMode = setModeState;

  // Reference needs a pin: the pick if there is one, else the first tile.
  useEffect(() => {
    if (!active || mode !== "reference" || !photo || reference || compared.length < 2) return;
    const pin = compared.find((v) => v.id === photo.pickId) ?? compared[0];
    if (pin) setChoices((c) => ({ ...c, referenceId: pin.id }));
  }, [active, mode, photo, reference, compared, setChoices]);

  // Keep the judged version distinct from the pinned one while in Reference.
  useEffect(() => {
    if (!active || mode !== "reference" || !reference || !focus || focus.id !== reference.id) return;
    const other = compared.find((v) => v.id !== reference.id);
    if (other) selectVersion(other.id);
  }, [active, mode, reference, focus, compared, selectVersion]);

  const toggleCompared = useCallback(
    (versionId: string) =>
      setChoices((c) => {
        const out = c.dropped.includes(versionId);
        return {
          ...c,
          dropped: out ? c.dropped.filter((id) => id !== versionId) : [...c.dropped, versionId],
          referenceId: !out && c.referenceId === versionId ? null : c.referenceId,
        };
      }),
    [setChoices],
  );

  const dropFocused = useCallback(() => {
    if (!focus) return;
    const index = compared.findIndex((v) => v.id === focus.id);
    const next = compared[index + 1] ?? compared[index - 1];
    toggleCompared(focus.id);
    if (next) selectVersion(next.id);
  }, [focus, compared, toggleCompared, selectVersion]);

  const lastDropped = [...choices.dropped].reverse().find((id) => id !== ORIGINAL_ID) ?? null;
  const restoreLast = useCallback(() => {
    if (lastDropped) setChoices((c) => ({ ...c, dropped: c.dropped.filter((id) => id !== lastDropped) }));
  }, [lastDropped, setChoices]);

  const swapPair = useCallback(() => {
    if (against) focusVersion(against.id);
  }, [against, focusVersion]);

  const setReference = useCallback(
    (versionId: string | null) => setChoices((c) => ({ ...c, referenceId: versionId })),
    [setChoices],
  );

  const humanInput = useCallback(() => setFollowing(false), []);

  /* ----- zoom and pan ----- */

  const photoSize = useMemo<Size>(() => ({ width: photo?.width ?? 1, height: photo?.height ?? 1 }), [photo?.width, photo?.height]);
  // Tiles moved alone keep their own place in Grid and Reference only;
  // Flip and Split exist to hold two versions in exactly the same place.
  const offsetsApply = mode === "grid" || mode === "reference";

  const zoomAt = useCallback(
    (gesture: Gesture, pointer: { x: number; y: number }, factor: number) =>
      setMoving((current) => {
        const offset = offsetsApply ? current.offsets[gesture.versionId] : undefined;
        const now = place(current.view, offset, gesture.viewport, photoSize);
        if (now.fitScale === 0) return current;
        const px = pointer.x - gesture.viewport.width / 2;
        const py = pointer.y - gesture.viewport.height / 2;
        // The point of the photo under the pointer stays under the pointer.
        const u = now.cx + px / now.width;
        const v = now.cy + py / now.height;
        const scale = Math.min(maxScale(), Math.max(now.fitScale, now.scale * factor));
        if (!gesture.alone && scale <= now.fitScale * 1.002) return { view: FIT_VIEW, offsets: {} };
        const width = photoSize.width * scale;
        const height = photoSize.height * scale;
        const cx = clampCentre(u - px / width, width, gesture.viewport.width);
        const cy = clampCentre(v - py / height, height, gesture.viewport.height);
        const base = explicit(current.view, now.fitScale);
        if (gesture.alone && offsetsApply) {
          const own: Offset = { k: scale / base.scale, dx: cx - base.cx, dy: cy - base.cy };
          return { view: base, offsets: { ...current.offsets, [gesture.versionId]: own } };
        }
        const k = offset?.k ?? 1;
        return {
          view: { fit: false, scale: scale / k, cx: cx - (offset?.dx ?? 0), cy: cy - (offset?.dy ?? 0) },
          offsets: current.offsets,
        };
      }),
    [offsetsApply, photoSize],
  );

  const pan = useCallback(
    (gesture: Gesture, dx: number, dy: number) =>
      setMoving((current) => {
        const offset = offsetsApply ? current.offsets[gesture.versionId] : undefined;
        const now = place(current.view, offset, gesture.viewport, photoSize);
        if (now.fitScale === 0 || now.fitted) return current;
        const cx = clampCentre(now.cx - dx / now.width, now.width, gesture.viewport.width);
        const cy = clampCentre(now.cy - dy / now.height, now.height, gesture.viewport.height);
        const base = explicit(current.view, now.fitScale);
        if (gesture.alone && offsetsApply) {
          const own: Offset = { k: offset?.k ?? 1, dx: cx - base.cx, dy: cy - base.cy };
          return { view: base, offsets: { ...current.offsets, [gesture.versionId]: own } };
        }
        return { view: { ...base, cx: cx - (offset?.dx ?? 0), cy: cy - (offset?.dy ?? 0) }, offsets: current.offsets };
      }),
    [offsetsApply, photoSize],
  );

  const fitAll = useCallback(() => setMoving({ view: FIT_VIEW, offsets: {} }), []);

  const toggleZoom = useCallback(
    (gesture: Gesture, pointer: { x: number; y: number }) => {
      const now = place(moving.view, undefined, gesture.viewport, photoSize);
      if (!now.fitted) return fitAll();
      // 100%, or twice the fitted size when the photo already fits at 100%.
      const target = Math.max(actualSizeScale(), now.fitScale * 2);
      zoomAt({ ...gesture, alone: false }, pointer, target / now.scale);
    },
    [moving.view, photoSize, fitAll, zoomAt],
  );

  const reportFitScale = useCallback((scale: number) => setFit((current) => (Math.abs(current - scale) < 1e-6 ? current : scale)), []);

  /* ----- the agent moving the view ----- */

  const appliedStamp = useRef(agentView?.stamp ?? 0);
  useEffect(() => {
    if (!agentView || agentView.stamp <= appliedStamp.current) return;
    appliedStamp.current = agentView.stamp;
    // A person in the middle of a drag keeps the view; the request is let go.
    if (dragging.current || !active) return;
    const target = agentView.focusVersionId;
    if (target) {
      setChoices((c) => ({ ...c, dropped: c.dropped.filter((id) => id !== target) }));
      if (target !== version?.id) selectVersion(target);
    }
    if (agentView.centre && agentView.magnification && fit > 0) {
      const scale = Math.min(maxScale(), fit * agentView.magnification);
      setMoving({ view: { fit: false, scale, cx: agentView.centre.x, cy: agentView.centre.y }, offsets: {} });
    }
    setFollowing(true);
  }, [active, agentView, fit, version?.id, selectVersion, setChoices]);

  const state = useMemo<CompareState>(
    () => ({
      mode,
      setMode,
      compared,
      isCompared: (id) => compared.some((v) => v.id === id),
      toggleCompared,
      dropFocused,
      restoreLast,
      canRestore: lastDropped !== null,
      focus,
      focusVersion,
      against,
      swapPair,
      referenceId: reference?.id ?? null,
      setReference,
      following,
      humanInput,
      dragging,
      markersHidden,
      toggleMarkers: () => setMarkersHidden((hidden) => !hidden),
      panelsHidden,
      togglePanels: () => setPanelsHidden((hidden) => !hidden),
      noteTool,
      setNoteTool: (on) => {
        setNoteToolState(on);
        if (on) {
          // A note needs its marker and the panel it is written in.
          setMarkersHidden(false);
          setPanelsHidden(false);
        }
      },
      draft,
      setDraft: (next) => {
        setDraftState(next);
        if (next) setPanelsHidden(false);
      },
      highlightedNoteId,
      highlightNote,
      split,
      setSplit: (position) => setSplitState(Math.min(0.98, Math.max(0.02, position))),
    }),
    [
      mode,
      setMode,
      compared,
      toggleCompared,
      dropFocused,
      restoreLast,
      lastDropped,
      focus,
      focusVersion,
      against,
      swapPair,
      reference,
      setReference,
      following,
      humanInput,
      markersHidden,
      panelsHidden,
      noteTool,
      draft,
      highlightedNoteId,
      split,
    ],
  );

  const view = useMemo<CompareView>(
    () => ({ view: moving.view, offsets: offsetsApply ? moving.offsets : {}, fitScale: fit, reportFitScale, pan, zoomAt, toggleZoom, fitAll }),
    [moving, offsetsApply, fit, reportFitScale, pan, zoomAt, toggleZoom, fitAll],
  );

  return (
    <StateContext.Provider value={state}>
      <ViewContext.Provider value={view}>{children}</ViewContext.Provider>
    </StateContext.Provider>
  );
}
