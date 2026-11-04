import { useEffect, useState } from "react";
import { useTextScale } from "./useDisplayPrefs";

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

/**
 * "Is the window at least `minDesignPx` wide?", where the number is measured as if the text were
 * Medium size. With bigger text everything takes more room, so the window must be bigger before
 * the same layout fits: at Extra large (1.41 times) a layout that needs 1024px at Medium needs
 * about 1445px. This is what lets older managers who choose big text get the roomy one-column
 * layout instead of three cramped columns.
 */
export function useLayoutQuery(minDesignPx: number): boolean {
  const scale = useTextScale();
  return useMediaQuery(`(min-width: ${Math.round(minDesignPx * scale)}px)`);
}
