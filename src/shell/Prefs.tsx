import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** The area around the photo. Its brightness changes how the photo reads. */
export interface Surround {
  id: "black" | "dark" | "dim" | "assess" | "white";
  label: string;
  /** A CSS colour; the values live in tokens.css. */
  colour: string;
  /** Assess adds a thin white frame, as a paper-white reference. */
  frame: boolean;
}

export const SURROUNDS: Surround[] = [
  { id: "black", label: "Black", colour: "var(--surround-black)", frame: false },
  { id: "dark", label: "Dark", colour: "var(--surround-dark)", frame: false },
  { id: "dim", label: "Dim", colour: "var(--surround-dim)", frame: false },
  { id: "assess", label: "Assess", colour: "var(--surround-assess)", frame: true },
  { id: "white", label: "White", colour: "var(--surround-white)", frame: false },
];

/** Offered while the owner chooses; one will stay. */
export type Typeface = "system" | "plex" | "inter";

export const TYPEFACES: Array<{ id: Typeface; label: string }> = [
  { id: "system", label: "System (San Francisco)" },
  { id: "plex", label: "IBM Plex Sans" },
  { id: "inter", label: "Inter 4" },
];

interface Prefs {
  surround: Surround;
  setSurround(id: Surround["id"]): void;
  typeface: Typeface;
  setTypeface(typeface: Typeface): void;
  histogramChannels: boolean;
  setHistogramChannels(on: boolean): void;
}

const PrefsContext = createContext<Prefs | null>(null);

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs needs PrefsProvider above it");
  return prefs;
}

function fromQuery<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = new URLSearchParams(window.location.search).get(name);
  return allowed.find((item) => item === value) ?? fallback;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [surroundId, setSurround] = useState<Surround["id"]>(() =>
    fromQuery("surround", SURROUNDS.map((s) => s.id), "dark"),
  );
  const [typeface, setTypeface] = useState<Typeface>(() =>
    fromQuery("typeface", TYPEFACES.map((t) => t.id), "system"),
  );
  const [histogramChannels, setHistogramChannels] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.typeface = typeface;
  }, [typeface]);

  const prefs = useMemo<Prefs>(
    () => ({
      surround: SURROUNDS.find((s) => s.id === surroundId) ?? SURROUNDS[1]!,
      setSurround,
      typeface,
      setTypeface,
      histogramChannels,
      setHistogramChannels,
    }),
    [surroundId, typeface, histogramChannels],
  );

  return <PrefsContext.Provider value={prefs}>{children}</PrefsContext.Provider>;
}
