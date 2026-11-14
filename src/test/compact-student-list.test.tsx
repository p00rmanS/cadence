import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { DEFAULT_SETTINGS } from "../features/scheduling/constants";
import { buildDemoData } from "../features/scheduling/demo-data";
import { STORAGE_KEY } from "../features/persistence/storage";

/**
 * A long student list must not overwhelm the manager. From nine students on, the small list switches to
 * tight cards (one short line each) and shows the Edit / Leaving / Remove icons only on the picked student.
 * A short list keeps the roomy cards it always had.
 */

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("shiftfit:welcomed", "1");
});
afterEach(cleanup);

/** Shows the app with the first `count` sample students and `selected` picked. */
function renderWith(count: number, selected: string | null) {
  const demo = buildDemoData();
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, settings: DEFAULT_SETTINGS, students: demo.students.slice(0, count), assignments: [], otherTermAssignments: [], selectedStudentId: selected, semester: null }),
  );
  render(<App />);
}

/** The cards of the small student list. */
function cards() {
  return within(screen.getByRole("list", { name: "Student list" })).getAllByRole("listitem");
}

describe("the small student list", () => {
  it("uses tight cards for a long roster and keeps the icons out of the way until a student is picked", () => {
    renderWith(20, "s1");
    const all = cards();
    expect(all).toHaveLength(20);
    expect(all.every((card) => card.getAttribute("data-compact") === "true")).toBe(true);
    // The picked student's icons are shown; everybody else's are tucked away.
    const picked = all.find((card) => within(card).queryByRole("button", { pressed: true }))!;
    const iconsOf = (card: HTMLElement) => within(card).getByRole("button", { name: /^Edit / }).parentElement!;
    expect(iconsOf(picked).className).not.toMatch(/\bhidden\b/);
    const other = all.find((card) => card !== picked)!;
    expect(iconsOf(other).className).toMatch(/\bhidden\b/);
  });

  it("keeps the roomy cards for a short roster", () => {
    renderWith(5, null);
    expect(cards().every((card) => card.getAttribute("data-compact") === null)).toBe(true);
    // The words are the full ones: "Needs 19 hours more", not the short "Needs 19 more".
    expect(screen.getAllByText(/Needs 19 hours more/).length).toBe(5);
  });
});
