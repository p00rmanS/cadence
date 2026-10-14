import { readFileSync } from "node:fs";
import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "../components/app-shell/SettingsDialog";
import { TEXT_SIZES, useDisplayPrefs } from "../hooks/useDisplayPrefs";
import { makeSettings } from "./testkit";

/**
 * Tests for the Settings window (`components/app-shell/SettingsDialog.tsx`) and the display choices
 * behind it (`hooks/useDisplayPrefs.ts`): text size from Small to Extra large, and "Reduce motion".
 * Many managers are older and rely on bigger text, so these check that the choice is applied to the
 * page, remembered, and survives a broken or tampered saved value.
 */

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-text-size");
  document.documentElement.removeAttribute("data-motion");
});

describe("useDisplayPrefs", () => {
  it("starts at Medium with motion on, and marks the page", () => {
    const { result } = renderHook(() => useDisplayPrefs());
    expect(result.current.textSize).toBe("medium");
    expect(result.current.reduceMotion).toBe(false);
    expect(document.documentElement.getAttribute("data-text-size")).toBe("medium");
    expect(document.documentElement.hasAttribute("data-motion")).toBe(false);
  });

  it("offers exactly Small, Medium, Large and Extra large, smallest first", () => {
    expect(TEXT_SIZES.map((s) => s.label)).toEqual(["Small", "Medium", "Large", "Extra large"]);
  });

  it("applies and remembers a new text size", () => {
    const first = renderHook(() => useDisplayPrefs());
    act(() => first.result.current.setTextSize("xlarge"));
    expect(document.documentElement.getAttribute("data-text-size")).toBe("xlarge");
    expect(window.localStorage.getItem("cadence:textSize")).toBe("xlarge");
    // A new visit (a fresh hook) reads the saved choice back.
    first.unmount();
    expect(renderHook(() => useDisplayPrefs()).result.current.textSize).toBe("xlarge");
  });

  it("ignores a saved size it does not know", () => {
    window.localStorage.setItem("cadence:textSize", "gigantic");
    expect(renderHook(() => useDisplayPrefs()).result.current.textSize).toBe("medium");
  });

  it("applies and remembers Reduce motion", () => {
    const { result } = renderHook(() => useDisplayPrefs());
    act(() => result.current.setReduceMotion(true));
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
    expect(window.localStorage.getItem("cadence:reduceMotion")).toBe("1");
    act(() => result.current.setReduceMotion(false));
    expect(document.documentElement.hasAttribute("data-motion")).toBe(false);
  });

  it("still works when the browser refuses to store anything", () => {
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useDisplayPrefs());
    act(() => result.current.setTextSize("large"));
    expect(document.documentElement.getAttribute("data-text-size")).toBe("large");
    blocked.mockRestore();
  });
});

describe("the stylesheet honors the choices", () => {
  const css = readFileSync("src/styles/app.css", "utf8");
  it("sets a bigger base size for Large and Extra large and a smaller one for Small", () => {
    const px = (size: string) => Number(new RegExp(`data-text-size="${size}"\\]\\s*\\{\\s*font-size:\\s*(\\d+)px`).exec(css)?.[1]);
    expect(px("small")).toBeLessThan(17);
    expect(px("large")).toBeGreaterThan(17);
    expect(px("xlarge")).toBeGreaterThan(px("large"));
  });
  it("switches animation off when Reduce motion is chosen", () => {
    expect(css).toMatch(/html\[data-motion="reduced"\] \*[\s\S]*animation-duration: 0\.01ms !important/);
  });
});

describe("SettingsDialog", () => {
  /** Opens the dialog with real display choices behind it. */
  function open(initialTab?: "display" | "rules") {
    const onSaveRules = vi.fn();
    const onThemeChange = vi.fn();
    const onClose = vi.fn();
    function Harness() {
      const display = useDisplayPrefs();
      return (
        <SettingsDialog settings={makeSettings()} onSaveRules={onSaveRules} theme="system" onThemeChange={onThemeChange} display={display} initialTab={initialTab} onClose={onClose} />
      );
    }
    render(<Harness />);
    return { user: userEvent.setup(), onSaveRules, onThemeChange, onClose };
  }

  it("shows the Display tab first, with the four text sizes", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(within(dialog).getByRole("tab", { name: "Display", selected: true })).toBeTruthy();
    const sizes = within(dialog).getByRole("group", { name: "Text size" });
    expect(within(sizes).getAllByRole("button").map((b) => b.textContent)).toEqual(["AaSmall", "AaMedium", "AaLarge", "AaExtra large"]);
    expect(within(sizes).getByRole("button", { name: /medium/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking a text size changes the page right away", async () => {
    const { user } = open();
    await user.click(screen.getByRole("button", { name: /extra large/i }));
    expect(document.documentElement.getAttribute("data-text-size")).toBe("xlarge");
    expect(screen.getByRole("button", { name: /extra large/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("the Reduce motion box and the color choice work", async () => {
    const { user, onThemeChange } = open();
    await user.click(screen.getByRole("checkbox", { name: /reduce motion/i }));
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });

  it("moves between the tabs with the mouse and the arrow keys", async () => {
    const { user } = open();
    await user.click(screen.getByRole("tab", { name: "Schedule rules" }));
    expect(screen.getByLabelText(/most hours a student can work/i)).toBeTruthy();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Display", selected: true })).toBeTruthy();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Schedule rules", selected: true })).toBeTruthy();
  });

  it("can open straight onto the rules, and saving them closes the window", async () => {
    const { user, onSaveRules, onClose } = open("rules");
    await user.click(screen.getByRole("button", { name: "Save rules" }));
    expect(onSaveRules).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });
});
