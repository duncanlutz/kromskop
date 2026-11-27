/** True inside the Tauri desktop shell, false in a plain browser tab. */
export const isDesktopShell = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

/**
 * macOS draws its window controls over the left end of our toolbar. A plain
 * browser has none, so review screenshots show stand-ins in the same place.
 */
export const windowControls: "native" | "stand-in" | "none" = isDesktopShell ? (isMac ? "native" : "none") : "stand-in";
