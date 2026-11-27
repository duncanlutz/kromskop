import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { fromQuery } from "../platform/query";

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

interface Prefs {
  surround: Surround;
  setSurround(id: Surround["id"]): void;
  histogramChannels: boolean;
  setHistogramChannels(on: boolean): void;
}

const PrefsContext = createContext<Prefs | null>(null);

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs needs PrefsProvider above it");
  return prefs;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [surroundId, setSurround] = useState<Surround["id"]>(() =>
    fromQuery("surround", SURROUNDS.map((s) => s.id), "dark"),
  );
  const [histogramChannels, setHistogramChannels] = useState(false);

  const prefs = useMemo<Prefs>(
    () => ({
      surround: SURROUNDS.find((s) => s.id === surroundId) ?? SURROUNDS[1]!,
      setSurround,
      histogramChannels,
      setHistogramChannels,
    }),
    [surroundId, histogramChannels],
  );

  return <PrefsContext.Provider value={prefs}>{children}</PrefsContext.Provider>;
}
