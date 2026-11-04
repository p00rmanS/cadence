import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDisplayPrefs } from "../hooks/useDisplayPrefs";

/**
 * Tests for the two "easier to see and click" choices in Settings -> Display: bigger buttons
 * ("roomy") and high-contrast colors. They check the saved choices and page markers, and measure the
 * high-contrast palettes with the same WCAG formula as `contrast.test.ts`, but at the strict 7:1
 * ("AAA") level for text, because this mode exists for people who struggle to read normal contrast.
 */

type RGB = [number, number, number];
const css = readFileSync("src/styles/app.css", "utf8");

/** Reads the color variables (like --ink: 0 0 0) from the CSS block that starts at `blockStart`. */
function readTokens(blockStart: string): Record<string, RGB> {
  const open = css.indexOf("{", css.indexOf(blockStart));
  const close = css.indexOf("}", open);
  const out: Record<string, RGB> = {};
  for (const line of css.slice(open + 1, close).split(";")) {
    const m = /--([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)/.exec(line);
    if (m) out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

/** How bright a color looks, from 0 to 1 (WCAG formula). */
function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio between two colors: 1 (identical) to 21 (black on white). */
function ratio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const palettes = {
  "light high-contrast": readTokens(':root[data-contrast="high"] {'),
  "dark high-contrast": readTokens(':root[data-theme="dark"][data-contrast="high"]'),
};

const TEXT_PAIRS: [string, string][] = [
  ["ink", "bg"], ["ink", "panel"], ["muted", "panel"], ["muted", "bg"], ["accent-ink", "accent"], ["accent-ink", "gap"],
  ["accent", "panel"], ["ok", "panel"], ["gap", "panel"], ["warn", "panel"], ["gap", "gap-bg"], ["ink", "ok-bg"],
  ["ink", "gap-bg"], ["ink", "warn-bg"], ["muted", "ok-bg"], ["muted", "gap-bg"],
];
const INDICATOR_PAIRS: [string, string][] = [
  ["accent", "panel"], ["accent", "ok-bg"], ["accent", "gap-bg"], ["gap", "gap-bg"], ["gap", "panel"], ["ok", "ok-bg"], ["warn", "warn-bg"], ["line", "panel"],
];

describe.each(Object.entries(palettes))("%s palette", (_name, tokens) => {
  it("defines every color the app uses", () => {
    for (const key of ["bg", "panel", "ink", "muted", "line", "ok", "ok-bg", "gap", "gap-bg", "busy", "accent", "accent-ink", "warn", "warn-bg"]) {
      expect(tokens[key], key).toBeDefined();
    }
  });
  it.each(TEXT_PAIRS)("text %s on %s is at least 7:1", (fg, bg) => {
    expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(7);
  });
  it.each(INDICATOR_PAIRS)("indicator %s against %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("high contrast with the computer's own dark setting", () => {
  it("repeats the explicit dark palette exactly, so the Dark button and the device setting look the same", () => {
    const explicit = palettes["dark high-contrast"];
    const copy = readTokens(':root:not([data-theme="light"])[data-contrast="high"]');
    expect(copy).toEqual(explicit);
  });
});

describe("display choices: roomy buttons and high contrast", () => {
  beforeEach(() => {
    window.localStorage.clear();
    for (const name of ["data-text-size", "data-motion", "data-comfort", "data-contrast"]) document.documentElement.removeAttribute(name);
  });

  it("start off, with no marker on the page", () => {
    const { result } = renderHook(() => useDisplayPrefs());
    expect(result.current.roomy).toBe(false);
    expect(result.current.highContrast).toBe(false);
    expect(document.documentElement.hasAttribute("data-comfort")).toBe(false);
    expect(document.documentElement.hasAttribute("data-contrast")).toBe(false);
  });

  it("mark the page, are remembered, and can be turned off again", () => {
    const first = renderHook(() => useDisplayPrefs());
    act(() => {
      first.result.current.setRoomy(true);
      first.result.current.setHighContrast(true);
    });
    expect(document.documentElement.getAttribute("data-comfort")).toBe("roomy");
    expect(document.documentElement.getAttribute("data-contrast")).toBe("high");
    expect(window.localStorage.getItem("cadence:roomy")).toBe("1");
    expect(window.localStorage.getItem("cadence:highContrast")).toBe("1");
    first.unmount();

    const second = renderHook(() => useDisplayPrefs());
    expect(second.result.current.roomy).toBe(true);
    expect(second.result.current.highContrast).toBe(true);
    act(() => second.result.current.setRoomy(false));
    expect(document.documentElement.hasAttribute("data-comfort")).toBe(false);
    expect(document.documentElement.getAttribute("data-contrast")).toBe("high");
  });
});

describe("roomy buttons in the stylesheet", () => {
  it("sets a comfortable minimum height on buttons and lets the small help buttons grow their click area invisibly", () => {
    expect(css).toMatch(/html\[data-comfort="roomy"\] :is\(button, select, summary[\s\S]*?min-height: 2\.75rem/);
    expect(css).toMatch(/aria-expanded\]\[aria-label\]:has\(> svg:only-child\)::after[\s\S]*?inset: -0\.75rem/);
  });
});
