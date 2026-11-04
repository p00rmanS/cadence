import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Tests for the splash screen (the animated logo shown while Cadence loads). It is plain HTML and
 * CSS inside `index.html` so it appears before any code downloads, and `src/main.tsx` removes it.
 * These checks keep it from quietly breaking the app: it must not need a script (the security policy
 * blocks inline scripts), must respect "reduce motion", and must actually get removed.
 */

const html = readFileSync("index.html", "utf8");
const main = readFileSync("src/main.tsx", "utf8");

describe("splash screen", () => {
  it("is in the page, announced to screen readers, and uses no script of its own", () => {
    const splash = /<div id="splash"[\s\S]*?<\/div>\s*<div class="sub">[\s\S]*?<\/div>\s*<\/div>/.exec(html)?.[0] ?? "";
    expect(splash).toContain('role="status"');
    expect(splash).toContain("Loading Cadence");
    expect(splash).not.toMatch(/<script|onload=|onclick=/i);
  });

  it("stands still for people who asked their device for less motion", () => {
    expect(html).toMatch(/prefers-reduced-motion: reduce[\s\S]*#splash[\s\S]*animation: none/);
  });

  it("is faded out and then removed by main.tsx, so it can never cover the app or trap a keyboard", () => {
    expect(main).toContain('getElementById("splash")');
    expect(main).toContain('classList.add("splash-done")');
    expect(main).toContain("splash.remove()");
  });

  it("covers the app only while visible: hidden once done", () => {
    expect(html).toMatch(/#splash\.splash-done\s*\{[^}]*visibility:\s*hidden/);
  });
});
