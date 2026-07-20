/**
 * Thin, guarded wrapper around `window.localStorage` (WOW-007B — DJ mode /
 * baseline-key persistence). `localStorage` can throw on read or write in
 * some browsers (private-mode Safari disables it entirely; any browser can
 * hit a quota error) — this installation must keep running regardless, so
 * both operations swallow failures rather than propagating them: `get`
 * returns `null` (same as "key not found") and `set` silently no-ops.
 * Callers that need persistence to survive a reload lose that persistence on
 * failure, not the app itself.
 */
const get = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const set = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private-mode / quota failure — persistence is a nice-to-have here,
    // not a requirement. Drop it silently.
  }
};

export const LocalStorageUtil = {
  get,
  set,
};
