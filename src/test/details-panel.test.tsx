import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";

/**
 * The side column with the schedule's health starts hidden, so a manager sees just the students and the
 * schedule. These tests check the "Show details" button that brings it back, and that the choice is remembered.
 */

const KEY = "shiftfit:details-open";

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("shiftfit:welcomed", "1");
});
afterEach(cleanup);

/** The column that holds the Schedule health panel. */
function detailsColumn(): HTMLElement {
  const column = document.getElementById("schedule-details");
  if (!column) throw new Error("the details column is missing");
  return column;
}

describe("the details column next to the schedule", () => {
  it("starts hidden on a wide screen, with a button that says how to show it", () => {
    render(<App />);
    const button = screen.getByRole("button", { name: /show details/i });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(detailsColumn().className).toMatch(/wide:hidden/);
    expect(detailsColumn().className).not.toMatch(/wide:block/);
  });

  it("opens and closes with the button, and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /show details/i }));
    expect(screen.getByRole("button", { name: /hide details/i }).getAttribute("aria-expanded")).toBe("true");
    expect(detailsColumn().className).toMatch(/wide:block/);
    expect(window.localStorage.getItem(KEY)).toBe("1");

    await user.click(screen.getByRole("button", { name: /hide details/i }));
    expect(detailsColumn().className).toMatch(/wide:hidden/);
    expect(window.localStorage.getItem(KEY)).toBe("0");
  });

  it("starts open for someone who left it open last time", () => {
    window.localStorage.setItem(KEY, "1");
    render(<App />);
    expect(screen.getByRole("button", { name: /hide details/i })).toBeTruthy();
    expect(detailsColumn().className).toMatch(/wide:block/);
  });
});
