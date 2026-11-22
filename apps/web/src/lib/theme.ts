// Single source of truth for the colour theme on the client. Every toggle
// subscribes to this store, so multiple toggles can never disagree, and the
// theme is re-applied whenever <html> loses its data-theme attribute (for
// example after React re-renders the root layout on a client navigation).
export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "serentax-theme";
const EVENT = "serentax:theme";

/** Inline, render-blocking script: applies the theme before first paint. */
export const themeBootScript = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){document.documentElement.dataset.theme='light'}`;

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

export function resolveTheme(): Theme {
  const stored = storedTheme();
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  return current === "dark" || current === "light" ? current : resolveTheme();
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* The theme still applies when browser storage is unavailable. */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Re-applies the persisted theme if <html> lost its attribute. */
export function ensureTheme() {
  const current = document.documentElement.dataset.theme;
  if (current !== "dark" && current !== "light")
    document.documentElement.dataset.theme = resolveTheme();
}

export function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(() => {
    ensureTheme();
    callback();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      document.documentElement.dataset.theme = resolveTheme();
      callback();
    }
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}
