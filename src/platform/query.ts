/*
 * Start-up options from the URL, so a reviewer or a screenshot script can
 * open the app in a particular state. They exist in development builds only:
 * a release build reads none of them.
 */

export function startupOptions(): URLSearchParams {
  return new URLSearchParams(import.meta.env.DEV ? window.location.search : "");
}

/** One option restricted to known values. Anything else falls back. */
export function fromQuery<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = startupOptions().get(name);
  return allowed.find((item) => item === value) ?? fallback;
}
