import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TEXT_SCALE, useTextScale } from "../hooks/useDisplayPrefs";
import { useLayoutQuery } from "../hooks/useMediaQuery";
import { viewport } from "./setup";

/**
 * Tests that the window-size breakpoints follow the chosen text size (`useLayoutQuery`). Bigger text
 * needs more room, so the same window must count as "narrow" sooner: a 1280px window is a roomy
 * desktop at Medium text but only a phone-style single column at Extra large. `setup.ts` pretends the
 * window is `viewport.width` wide.
 */

beforeEach(() => {
  document.documentElement.removeAttribute("data-text-size");
});

describe("text scale", () => {
  it("gets bigger with each size, with Medium as the baseline of 1", () => {
    expect(TEXT_SCALE.medium).toBe(1);
    expect(TEXT_SCALE.small).toBeLessThan(1);
    expect(TEXT_SCALE.large).toBeGreaterThan(1);
    expect(TEXT_SCALE.xlarge).toBeGreaterThan(TEXT_SCALE.large);
  });

  it("is read from the page marker and follows changes to it", async () => {
    const { result } = renderHook(() => useTextScale());
    expect(result.current).toBe(1);
    await act(async () => {
      document.documentElement.setAttribute("data-text-size", "xlarge");
      await Promise.resolve();
    });
    expect(result.current).toBe(TEXT_SCALE.xlarge);
  });
});

describe("useLayoutQuery", () => {
  it("counts a 1280px window as wide at Medium text but not at Extra large", async () => {
    viewport.width = 1280;
    const { result } = renderHook(() => useLayoutQuery(1024));
    expect(result.current).toBe(true);
    await act(async () => {
      document.documentElement.setAttribute("data-text-size", "xlarge");
      await Promise.resolve();
    });
    // 1024 x 1.41 = about 1445px are needed now, and the window is only 1280px.
    expect(result.current).toBe(false);
  });

  it("counts a window as wide again once it is big enough for the bigger text", async () => {
    viewport.width = 1600;
    document.documentElement.setAttribute("data-text-size", "xlarge");
    const { result } = renderHook(() => useLayoutQuery(1024));
    expect(result.current).toBe(true);
  });

  it("needs a smaller window at Small text", () => {
    viewport.width = 980;
    document.documentElement.setAttribute("data-text-size", "small");
    const { result } = renderHook(() => useLayoutQuery(1024));
    expect(result.current).toBe(true);
  });
});
