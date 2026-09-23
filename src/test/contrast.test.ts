import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STUDENT_COLORS } from "../features/scheduling/constants";

type RGB = [number, number, number];

const css = readFileSync("src/styles/app.css", "utf8");

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

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes: Record<string, Record<string, RGB>> = {
  light: readTokens(":root {"),
  dark: readTokens(':root[data-theme="dark"]'),
};

// Foreground/background pairs the UI actually renders as text (WCAG AA: 4.5:1).
const TEXT_PAIRS: [string, string][] = [
  ["ink", "bg"],
  ["ink", "panel"],
  ["muted", "panel"],
  ["muted", "bg"],
  ["accent-ink", "accent"],
  ["accent-ink", "gap"],
  ["accent", "panel"],
  ["ok", "panel"],
  ["gap", "panel"],
  ["warn", "panel"],
  ["gap", "gap-bg"],
  ["ink", "ok-bg"],
  ["ink", "gap-bg"],
  ["ink", "warn-bg"],
  ["muted", "ok-bg"],
  ["muted", "gap-bg"],
];

// Non-text indicators: focus rings, selection rings, status borders (WCAG 1.4.11: 3:1).
const UI_PAIRS: [string, string][] = [
  ["accent", "panel"],
  ["accent", "ok-bg"],
  ["accent", "gap-bg"],
  ["gap", "gap-bg"],
  ["gap", "panel"],
  ["ok", "ok-bg"],
  ["warn", "warn-bg"],
  ["gap", "gap-bg"],
];

/** Blends a translucent color (like bg-accent/10) over its background, as the browser does. */
function mix(fg: RGB, bg: RGB, alpha: number): RGB {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as RGB;
}

describe.each(Object.entries(themes))("%s theme contrast", (_name, tokens) => {
  it.each(TEXT_PAIRS)("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(UI_PAIRS)("indicator %s against %s is at least 3:1", (fg, bg) => {
    expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(3);
  });
});

describe.each(Object.entries(themes))("%s theme, text on translucent backgrounds", (_name, t) => {
  it("muted text stays readable on the guidance banner tint", () => {
    for (const base of [t.bg, t.panel]) expect(ratio(t.muted, mix(t.accent, base, 0.1))).toBeGreaterThanOrEqual(4.5);
  });
  it("body text stays readable on the selected-student highlight", () => {
    for (const base of [t.bg, t.panel]) expect(ratio(t.ink, mix(t.accent, base, 0.15))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("student chip colors", () => {
  it.each(STUDENT_COLORS)("white chip text on %s is at least 4.5:1", (hex) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
    expect(ratio(rgb, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
  });
});
