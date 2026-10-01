import { useCallback, useState } from "react";

/**
 * Decides whether to show the welcome screen: only the first time someone opens the app in this
 * browser. A small "seen it" flag is kept in localStorage (the browser's own key/value store).
 */

/** The localStorage key holding "1" once the welcome screen has been closed. */
const KEY = "shiftfit:welcomed";

/** True if this browser has already seen the welcome screen. Blocked storage counts as "not yet". */
function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers whether the welcome screen has been seen (best effort: if storage is blocked it just shows again). */
export function useFirstRun() {
  const [welcomed, setWelcomed] = useState(read);
  const markWelcomed = useCallback(() => {
    setWelcomed(true);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);
  return { showWelcome: !welcomed, markWelcomed };
}
