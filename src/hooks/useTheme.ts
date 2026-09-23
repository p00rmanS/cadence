import { useCallback, useEffect, useState } from "react";

/**
 * Light / dark / auto theme switcher. "system" means "match the device's
 * setting", done by removing our own override and letting `@media (prefers-
 * color-scheme)` in the CSS take over. The choice is remembered in
 * localStorage so it survives closing the tab.
 */
export type ThemeChoice = "system" | "light" | "dark";
const STORAGE_KEY = "shiftfit:theme";

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore — theme just won't persist across sessions in this browser */
    }
  }, [theme]);

  const setTheme = useCallback((choice: ThemeChoice) => setThemeState(choice), []);

  return { theme, setTheme };
}
