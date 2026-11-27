/**
 * ============================================================================
 *  TESTS: THE PHONE "MORE" MENU
 * ============================================================================
 * On a phone the header used about a third of the screen, so Save & share, Settings, Help, the light/dark
 * choice and the text size now live behind one "More" button. These tests protect that the menu opens, every
 * row does its job (and closes the menu so two windows never stack), and the color and text-size choices
 * are passed on. (Whether the button is shown or hidden depends on the screen width, which is CSS; that was
 * checked by eye in a phone-sized browser, not here.)
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoreMenu } from "../components/app-shell/MoreMenu";

/** Draws the menu button with spy functions for everything it can trigger. */
function show(overrides: Partial<Parameters<typeof MoreMenu>[0]> = {}) {
  const spies = {
    onOpenShare: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenHelp: vi.fn(),
    onThemeChange: vi.fn(),
    onTextSizeChange: vi.fn(),
  };
  render(<MoreMenu theme="light" textSize="medium" {...spies} {...overrides} />);
  return { ...spies, user: userEvent.setup() };
}

/** Opens the menu and returns the window. */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "More" }));
  return screen.getByRole("dialog", { name: "More" });
}

describe("the More menu", () => {
  it("is closed until the button is pressed, then shows every control with words on it", async () => {
    const { user } = show();
    expect(screen.queryByRole("dialog")).toBeNull();
    const menu = await open(user);
    for (const name of [/Save & share/, /Settings/, /Help/, /^Light/, /^Dark/, /^Auto/, /Small/, /Medium/, /Large/, /Extra large/]) {
      expect(within(menu).getByRole("button", { name }), String(name)).toBeTruthy();
    }
  });

  it("each of the three rows opens its window and closes the menu first", async () => {
    for (const [row, spy] of [
      [/Save & share/, "onOpenShare"],
      [/Settings/, "onOpenSettings"],
      [/Help/, "onOpenHelp"],
    ] as const) {
      const spies = show();
      const menu = await open(spies.user);
      await spies.user.click(within(menu).getByRole("button", { name: row }));
      expect(spies[spy]).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog")).toBeNull();
      document.body.innerHTML = "";
    }
  });

  it("marks the current color and text size, and passes on a new choice", async () => {
    const { user, onThemeChange, onTextSizeChange } = show({ theme: "light", textSize: "medium" });
    const menu = await open(user);
    expect(within(menu).getByRole("button", { name: /^Light/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(menu).getByRole("button", { name: /^Dark/ }).getAttribute("aria-pressed")).toBe("false");
    expect(within(menu).getByRole("button", { name: /Medium/ }).getAttribute("aria-pressed")).toBe("true");
    await user.click(within(menu).getByRole("button", { name: /^Dark/ }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
    await user.click(within(menu).getByRole("button", { name: /^Auto/ }));
    expect(onThemeChange).toHaveBeenCalledWith("system");
    await user.click(within(menu).getByRole("button", { name: /Extra large/ }));
    expect(onTextSizeChange).toHaveBeenCalledWith("xlarge");
  });

  it("stays open after a color or text-size choice, so the person can see the result", async () => {
    const { user } = show();
    const menu = await open(user);
    await user.click(within(menu).getByRole("button", { name: /^Dark/ }));
    expect(screen.getByRole("dialog", { name: "More" })).toBeTruthy();
  });

  it("closes with Escape and with the Close button", async () => {
    const { user } = show();
    await open(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    const menu = await open(user);
    await user.click(within(menu).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is drawn directly in the page body, so the header cannot hide it behind the bottom tab bar", async () => {
    const { user } = show();
    const menu = await open(user);
    expect(menu.closest("header")).toBeNull();
    expect(menu.parentElement?.parentElement).toBe(document.body);
  });
});
