import { useCallback, useState } from "react";

const KEY = "shiftfit:welcomed";

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
