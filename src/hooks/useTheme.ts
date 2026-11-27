import { useCallback, useEffect, useState } from "react";

/**
 * Light / dark / auto theme switcher. "system" means "match the device's
 * setting", done by removing our own override and letting `@media (prefers-
 * color-scheme)` in the CSS take over. The choice is remembered in
 * localStorage so it survives closing the tab.
 *
 * LIGHT IS THE STANDARD. Syncro opens in the white (light) look for everyone, whatever their device is set
 * to, because that is the look the office manager prefers and the one it was shown in. Dark and Auto are one
 * tap away (More on a phone, or the sun/moon switch in the header) and, once chosen, are remembered.
 */
export type ThemeChoice = "system" | "light" | "dark";

/** What a person sees until they choose something else. */
export const DEFAULT_THEME: ThemeChoice = "light";

const STORAGE_KEY = "shiftfit:theme";
/**
 * Written only when a person picks a theme THEMSELVES. Older versions saved "system" on the very first visit
 * without anyone choosing it, so a saved "system" on its own cannot be trusted as a real choice: without this
 * mark it is treated as "never chose" and gets the light standard. A saved "light" or "dark" was always a real choice.
 */
const CHOSEN_KEY = "shiftfit:themeChosen";

/** The theme this browser should show: the person's real choice if there is one, otherwise the light standard. */
export function readSavedTheme(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    if (saved === "system" && window.localStorage.getItem(CHOSEN_KEY) === "1") return "system";
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Switches the page's colors by setting (or removing) `data-theme` on the <html> tag; the CSS does the rest. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/** The current theme choice and a way to change it; loads the saved choice and saves every change. */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>(readSavedTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore — theme just won't persist across sessions in this browser */
    }
  }, [theme]);

  // Picking a theme is a real choice, so it is marked as one (see CHOSEN_KEY).
  const setTheme = useCallback((choice: ThemeChoice) => {
    try {
      window.localStorage.setItem(CHOSEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setThemeState(choice);
  }, []);

  return { theme, setTheme };
}
