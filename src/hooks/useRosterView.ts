import { useCallback, useState } from "react";

/**
 * Remembers whether the student list is showing its big "roster" look (wide, with free times and filters)
 * or the small card list. It starts small so a first-time manager sees the simple version; the choice is
 * kept on this computer, and the app still works normally if the browser will not let us save it.
 */
const STORAGE_KEY = "shiftfit:roster-wide";

/** Reads the saved choice (small if nothing was saved or the browser refuses to say). */
function readSaved(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Gives the current choice and a function to flip it (and save it). */
export function useRosterView(): [boolean, () => void] {
  const [wide, setWide] = useState(readSaved);
  const toggle = useCallback(() => {
    setWide((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Not saved; it simply starts small next time.
      }
      return next;
    });
  }, []);
  return [wide, toggle];
}
