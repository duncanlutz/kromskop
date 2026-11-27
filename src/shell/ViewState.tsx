import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { fromQuery } from "../platform/query";
import type { View } from "./ViewSwitch";

interface ViewState {
  view: View;
  setView(view: View): void;
}

const ViewContext = createContext<ViewState | null>(null);

/** Which of Library, Develop and Compare is on screen. */
export function useView(): ViewState {
  const state = useContext(ViewContext);
  if (!state) throw new Error("useView needs ViewProvider above it");
  return state;
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(() => fromQuery("view", ["library", "develop", "compare"], "develop"));
  const state = useMemo(() => ({ view, setView }), [view]);
  return <ViewContext.Provider value={state}>{children}</ViewContext.Provider>;
}
