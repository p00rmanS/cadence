import { useCallback, useState } from "react";

/**
 * Remembers whether the "details" column (the Schedule health panel) is showing next to the schedule.
 * It starts hidden so a manager sees only the two things that matter most, the students and the
 * schedule; the banner above already says whether everything is covered. The choice is kept on this
 * computer, and the app still works normally if the browser will not let us save it.
 */
const STORAGE_KEY = "shiftfit:details-open";

/** Reads the saved choice (hidden if nothing was saved or the browser refuses to say). */
function readSaved(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Gives the current choice and a function to change it (and save it). */
export function useDetailsPanel(): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(readSaved);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Not saved; it simply starts hidden next time.
    }
  }, []);
  return [open, setOpen];
}
