import { useCallback, useEffect, useState } from "react";

/**
 * ============================================================================
 *  DISPLAY PREFERENCES: TEXT SIZE AND "REDUCE MOTION"
 * ============================================================================
 * Two comfort settings that belong to the person using the computer, not to the schedule:
 *  - how big the writing is (many managers are older, and bigger text is easier on the eyes),
 *  - whether buttons are bigger with more room between them (easier to hit with a shaky hand or a trackpad),
 *  - whether to use high-contrast colors (black and white with strong edges), and
 *  - whether to switch off the animations (calmer for some people).
 * Like the color theme (`useTheme.ts`), they are remembered in this browser's `localStorage` and
 * applied by putting a small marker on the page's <html> tag (`data-text-size`, `data-comfort`,
 * `data-contrast`, `data-motion`).
 * `src/styles/app.css` reads those markers: everything in the app is sized in `rem` units, which
 * scale with the <html> text size, so one change makes the whole app bigger or smaller together.
 * They are NOT part of a schedule backup: a bigger font is a setting of this computer, not of the data.
 */

export type TextSize = "small" | "medium" | "large" | "xlarge";

/** The text sizes offered, smallest to biggest. `medium` is the normal size the app was designed at. */
export const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

/**
 * How much bigger (or smaller) the writing is than at Medium. The page's base size is 17px at Medium
 * (see `app.css`), so Large is 20/17 = about 1.18 times as big, Extra large 24/17 = about 1.41.
 */
export const TEXT_SCALE: Record<TextSize, number> = { small: 15 / 17, medium: 1, large: 20 / 17, xlarge: 24 / 17 };

const TEXT_SIZE_KEY = "cadence:textSize";
const REDUCE_MOTION_KEY = "cadence:reduceMotion";
const ROOMY_KEY = "cadence:roomy";
const HIGH_CONTRAST_KEY = "cadence:highContrast";

/** True when `value` is one of the text sizes above (anything else saved in the browser is ignored). */
function isTextSize(value: unknown): value is TextSize {
  return TEXT_SIZES.some((size) => size.value === value);
}

/** Reads one saved value, or null when there is none or the browser won't let us look (private windows, blocked storage). */
function readSaved(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Saves one value; if the browser refuses, the choice simply won't survive closing the tab. */
function save(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore: the setting still works for this visit */
  }
}

/** Puts the choices on the <html> tag, where the stylesheet picks them up. */
function applyToPage(choices: { textSize: TextSize; reduceMotion: boolean; roomy: boolean; highContrast: boolean }): void {
  const root = document.documentElement;
  root.setAttribute("data-text-size", choices.textSize);
  setMarker(root, "data-motion", choices.reduceMotion ? "reduced" : null);
  setMarker(root, "data-comfort", choices.roomy ? "roomy" : null);
  setMarker(root, "data-contrast", choices.highContrast ? "high" : null);
}

/** Sets an attribute on the page, or removes it when the value is null (the "off" state has no marker at all). */
function setMarker(root: HTMLElement, name: string, value: string | null): void {
  if (value === null) root.removeAttribute(name);
  else root.setAttribute(name, value);
}

/** The current display choices and ways to change them. Loads the saved choices and saves every change. */
export function useDisplayPrefs() {
  const [textSize, setTextSizeState] = useState<TextSize>(() => {
    const saved = readSaved(TEXT_SIZE_KEY);
    return isTextSize(saved) ? saved : "medium";
  });
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => readSaved(REDUCE_MOTION_KEY) === "1");
  const [roomy, setRoomyState] = useState<boolean>(() => readSaved(ROOMY_KEY) === "1");
  const [highContrast, setHighContrastState] = useState<boolean>(() => readSaved(HIGH_CONTRAST_KEY) === "1");

  useEffect(() => {
    applyToPage({ textSize, reduceMotion, roomy, highContrast });
  }, [textSize, reduceMotion, roomy, highContrast]);

  const setTextSize = useCallback((size: TextSize) => {
    setTextSizeState(size);
    save(TEXT_SIZE_KEY, size);
  }, []);
  const setReduceMotion = useCallback((on: boolean) => {
    setReduceMotionState(on);
    save(REDUCE_MOTION_KEY, on ? "1" : "0");
  }, []);

  const setRoomy = useCallback((on: boolean) => {
    setRoomyState(on);
    save(ROOMY_KEY, on ? "1" : "0");
  }, []);
  const setHighContrast = useCallback((on: boolean) => {
    setHighContrastState(on);
    save(HIGH_CONTRAST_KEY, on ? "1" : "0");
  }, []);

  return { textSize, setTextSize, reduceMotion, setReduceMotion, roomy, setRoomy, highContrast, setHighContrast };
}

/**
 * The current text scale (see `TEXT_SCALE`), read from the page's `data-text-size` marker, so any screen can
 * react when the size changes without being handed the setting. Used to make the window-size breakpoints
 * text-size aware (`useMediaQuery.ts`): bigger writing needs a bigger window before three columns fit.
 */
export function useTextScale(): number {
  const read = () => {
    const marked = typeof document !== "undefined" ? document.documentElement.getAttribute("data-text-size") : null;
    return isTextSize(marked) ? TEXT_SCALE[marked] : 1;
  };
  const [scale, setScale] = useState(read);
  useEffect(() => {
    setScale(read());
    // The marker changes when someone picks a size in Settings; watch for that change.
    const watcher = new MutationObserver(() => setScale(read()));
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ["data-text-size"] });
    return () => watcher.disconnect();
  }, []);
  return scale;
}

/** The shape `useDisplayPrefs` returns, so screens can be given "the display choices" as one thing. */
export type DisplayPrefs = ReturnType<typeof useDisplayPrefs>;
