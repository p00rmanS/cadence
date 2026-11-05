import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { DEFAULT_SETTINGS } from "../features/scheduling/constants";
import { buildCoverageSlots, summarizeCoverage } from "../features/scheduling/coverage";
import { requiredStaff, withStaffingNeed } from "../features/scheduling/staffing";
import { validatePersistedState } from "../features/scheduling/validation";
import type { ScheduleSettings } from "../features/scheduling/types";

/**
 * Some times can need more people than the standard (for example two over lunch). These tests cover the
 * rule itself (how many people a time needs, how exceptions are merged and saved) and the pop-up that
 * lets a manager put two students on the same times and say "these times need 2 people".
 */

const settings: ScheduleSettings = { ...DEFAULT_SETTINGS, minStaffPerSlot: 1 };

describe("how many people a time needs", () => {
  it("is the standard number unless a special number covers that time", () => {
    const withLunch: ScheduleSettings = { ...settings, staffingNeeds: [{ day: "mon", from: 11 * 60, to: 13 * 60, people: 2 }] };
    expect(requiredStaff(withLunch, "mon", 11 * 60)).toBe(2);
    expect(requiredStaff(withLunch, "mon", 12 * 60 + 30)).toBe(2);
    expect(requiredStaff(withLunch, "mon", 13 * 60)).toBe(1); // the end is not included
    expect(requiredStaff(withLunch, "tue", 11 * 60)).toBe(1); // a different day
  });

  it("splits an older special time when a new one lands in the middle of it, and clears it when set back to the standard", () => {
    const base: ScheduleSettings = { ...settings, staffingNeeds: [{ day: "mon", from: 8 * 60, to: 14 * 60, people: 2 }] };
    const split = withStaffingNeed(base, "mon", 10 * 60, 12 * 60, 3);
    expect(split).toEqual(
      expect.arrayContaining([
        { day: "mon", from: 8 * 60, to: 10 * 60, people: 2 },
        { day: "mon", from: 12 * 60, to: 14 * 60, people: 2 },
        { day: "mon", from: 10 * 60, to: 12 * 60, people: 3 },
      ]),
    );
    expect(split).toHaveLength(3);
    // saying "1" (the standard) in the middle just removes that part
    expect(withStaffingNeed(base, "mon", 10 * 60, 12 * 60, 1)).toHaveLength(2);
  });

  it("changes what counts as covered and how much staffing is needed in total", () => {
    const withLunch: ScheduleSettings = { ...settings, staffingNeeds: [{ day: "mon", from: 11 * 60, to: 12 * 60, people: 2 }] };
    const slots = buildCoverageSlots([], withLunch);
    expect(slots.find((s) => s.day === "mon" && s.start === 11 * 60)?.minRequired).toBe(2);
    expect(slots.find((s) => s.day === "mon" && s.start === 10 * 60)?.minRequired).toBe(1);
    const plain = summarizeCoverage(buildCoverageSlots([], settings), settings);
    const more = summarizeCoverage(slots, withLunch);
    expect(more.theoreticalStaffingHours).toBe(plain.theoreticalStaffingHours + 1); // one extra person for one hour
  });
});

describe("saving staffing times", () => {
  const base = { version: 1, students: [], assignments: [], semester: null, selectedStudentId: null };

  it("keeps good ones and refuses nonsense", () => {
    const good = validatePersistedState({ ...base, settings: { ...settings, staffingNeeds: [{ day: "mon", from: 660, to: 720, people: 2 }] } });
    expect(good.ok && good.value.settings.staffingNeeds).toEqual([{ day: "mon", from: 660, to: 720, people: 2 }]);
    for (const bad of [{ day: "mon", from: 720, to: 660, people: 2 }, { day: "xyz", from: 660, to: 720, people: 2 }, { day: "mon", from: 660, to: 720, people: 99 }]) {
      expect(validatePersistedState({ ...base, settings: { ...settings, staffingNeeds: [bad] } }).ok).toBe(false);
    }
  });

  it("is not required (older saved schedules have none)", () => {
    expect(validatePersistedState({ ...base, settings }).ok).toBe(true);
  });
});

/** A stand-in for the browser's dataTransfer, as in the drag tests. */
function makeDataTransfer() {
  const data: Record<string, string> = {};
  return {
    get types() {
      return Object.keys(data);
    },
    setData: (type: string, value: string) => {
      data[type] = value;
    },
    getData: (type: string) => data[type] ?? "",
    effectAllowed: "",
    dropEffect: "",
  };
}

describe("putting two students on the same times", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("shiftfit:welcomed", "1");
  });
  afterEach(cleanup);

  it("adds a second student in one step and records that those times need 2 people", () => {
    render(<App />);
    const dataTransfer = makeDataTransfer();
    const card = screen.getByText("Leilani P.", { selector: "span" }).closest("li")!;
    const seven = () => screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ });
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(seven(), { dataTransfer });
    fireEvent.drop(seven(), { dataTransfer });

    fireEvent.click(screen.getByRole("checkbox", { name: /Kekoa M\./ }));
    fireEvent.change(screen.getByRole("combobox", { name: /People needed at these times/ }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add shifts" }));

    const label = seven().getAttribute("aria-label") ?? "";
    expect(label).toMatch(/Working: Leilani P\., Kekoa M\./);
    expect(label).toMatch(/Enough people/);
    expect(label).toMatch(/This time needs 2 people/);
    // the whole two hours are marked as needing 2, but Kekoa has class from 8:00am, so 8:30am has only Troy and Leilani
    const later = screen.getByRole("button", { name: /^Monday 8:30am to 9:00am/ }).getAttribute("aria-label") ?? "";
    expect(later).toMatch(/This time needs 2 people/);
    expect(later).not.toMatch(/Kekoa M. is working here/);
    // the message names the student properly (no doubled full stop after "P.")
    expect(screen.getByText(/Those times now need 2 people/).textContent).not.toMatch(/\.\./);
  });
});
