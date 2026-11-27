/**
 * ============================================================================
 *  TESTS: SYNCRO OPENS IN THE LIGHT (WHITE) LOOK BY DEFAULT
 * ============================================================================
 * The office manager prefers the white look, so Syncro opens light for everyone, even on a device set to dark
 * and even in a browser that visited an older version (which saved "system" on the first visit without anyone
 * choosing it). A person's own choice of Dark or Auto is still remembered.
 *
 * There are two copies of the "which look?" rule: `readSavedTheme` in the app, and `public/theme-init.js`, a
 * tiny script that runs before the first screen is drawn so there is no dark flash (the website's security
 * policy only allows script FILES, not code written inside the page). The last test runs both on the same
 * saved states and checks they always give the same answer.
 */
import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME, readSavedTheme, useTheme } from "../hooks/useTheme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("the standard look", () => {
  it("is light", () => {
    expect(DEFAULT_THEME).toBe("light");
  });

  it("is what a brand-new visitor gets, and the page is marked light", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("is what a returning visitor gets when an older version had quietly saved 'system'", () => {
    window.localStorage.setItem("shiftfit:theme", "system");
    expect(readSavedTheme()).toBe("light");
  });

  it("falls back to light when saved text is junk", () => {
    window.localStorage.setItem("shiftfit:theme", "purple");
    expect(readSavedTheme()).toBe("light");
  });
});

describe("a person's own choice", () => {
  it("keeps a saved Dark", () => {
    window.localStorage.setItem("shiftfit:theme", "dark");
    expect(readSavedTheme()).toBe("dark");
  });

  it("keeps Auto once the person has picked it, and follows the device (no marker on the page)", () => {
    const first = renderHook(() => useTheme());
    act(() => first.result.current.setTheme("system"));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    first.unmount();
    expect(readSavedTheme()).toBe("system");
    expect(renderHook(() => useTheme()).result.current.theme).toBe("system");
  });

  it("remembers Dark across a reload", () => {
    const first = renderHook(() => useTheme());
    act(() => first.result.current.setTheme("dark"));
    first.unmount();
    expect(renderHook(() => useTheme()).result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("the start-up script (public/theme-init.js) agrees with the app", () => {
  const script = readFileSync("public/theme-init.js", "utf8");

  /** Runs the start-up script against a given saved state and returns what it put on the page ("system" = nothing). */
  function scriptAnswer(saved: Record<string, string>): string {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    for (const [key, value] of Object.entries(saved)) window.localStorage.setItem(key, value);
    new Function(script)();
    return document.documentElement.getAttribute("data-theme") ?? "system";
  }

  const cases: Record<string, string>[] = [
    {},
    { "shiftfit:theme": "light" },
    { "shiftfit:theme": "dark" },
    { "shiftfit:theme": "system" },
    { "shiftfit:theme": "system", "shiftfit:themeChosen": "1" },
    { "shiftfit:theme": "purple" },
    { "shiftfit:theme": "dark", "shiftfit:themeChosen": "1" },
  ];

  it.each(cases)("gives the same answer as the app for %j", (saved) => {
    const fromScript = scriptAnswer(saved);
    // Same saved state again, this time asked of the app.
    window.localStorage.clear();
    for (const [key, value] of Object.entries(saved)) window.localStorage.setItem(key, value);
    expect(fromScript).toBe(readSavedTheme());
  });
});
