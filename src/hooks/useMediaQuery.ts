import { useEffect, useState } from "react";

/**
 * Lets a screen react to the window size (or other CSS "media queries"), e.g. switching to the
 * one-day-at-a-time phone layout when the window is narrow. It re-renders whenever the answer changes.
 */

/** Live `window.matchMedia` result, safe when matchMedia isn't available (tests, old browsers). */
export function useMediaQuery(query: string): boolean {
  // Asks the browser right now whether the query matches (false where the browser can't answer).
  const get = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    // Some browsers and embedded views skip "change" events; a resize always fires, so re-check on it too.
    window.addEventListener("resize", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [query]);

  return matches;
}
