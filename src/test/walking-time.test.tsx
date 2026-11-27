/**
 * ============================================================================
 *  TESTS: WALKING TIME BETWEEN A CLASS AND A SHIFT
 * ============================================================================
 * Before this setting existed, a shift could end the exact minute a class started (or start the minute one
 * ended), which asks a student to be in two places at once. In an auto-fill of 25 random students, 28
 * shift/class neighbours had a zero-minute gap. The manager can now choose a walking time in Rules.
 *
 * What these tests protect:
 *  - The standard is "None" (0), so every existing schedule and every number already reported stays the same.
 *  - With a walking time set, a box too close to a class is blocked, and auto-fill never leaves a smaller gap.
 *  - Only classes count (not other blocked times), and a class overlapping the box is still a plain class conflict.
 *  - A shift that is already too close is reported as a problem, and the saved-file checker accepts only sane values.
 *  - The Rules form offers the choice and saves it (or saves nothing when it is left at None).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RulesForm } from "../components/app-shell/RulesForm";
import { blockedBySlot, canAssign } from "../features/scheduling/availability";
import { findIssues, isBlockingIssue } from "../features/scheduling/issues";
import { buildBusy } from "../features/scheduling/parser";
import { buildRandomStudents } from "../features/scheduling/random-roster";
import { autoFill } from "../features/scheduling/scheduler";
import { evaluateSchedule } from "../features/scheduling/evaluate";
import { walkingMinutes } from "../features/scheduling/term";
import { validatePersistedState } from "../features/scheduling/validation";
import { makeSettings, makeStudent, slot } from "./testkit";

/** A student whose only class is Monday 9:00am-9:50am. */
const student = makeStudent({ id: "s1", name: "Noa K.", busy: buildBusy("M 9:00am-9:50am", "").busy });

/** Minutes after midnight for readability: at(9, 30) is 9:30am. */
const at = (hour: number, minute = 0) => hour * 60 + minute;

describe("walkingMinutes", () => {
  it("is 0 (none) when nothing is chosen, and the manager's number otherwise", () => {
    expect(walkingMinutes(makeSettings())).toBe(0);
    expect(walkingMinutes(makeSettings({ walkingMinutes: 15 }))).toBe(15);
  });
});

describe("a box next to a class", () => {
  it("is allowed at the standard walking time of none (nothing changes for existing schedules)", () => {
    const settings = makeSettings();
    expect(blockedBySlot(student, "mon", at(8, 30), settings)).toBeNull(); // ends 9:00, the minute class starts
    expect(blockedBySlot(student, "mon", at(10), settings)).toBeNull(); // starts 10:00, ten minutes after class ends
  });

  it("is blocked when the gap is shorter than the walking time, before and after the class", () => {
    const settings = makeSettings({ walkingMinutes: 15 });
    expect(blockedBySlot(student, "mon", at(8, 30), settings)?.code).toBe("walking_time"); // gap before class: 0
    expect(blockedBySlot(student, "mon", at(10), settings)?.code).toBe("walking_time"); // gap after class: 10 < 15
    expect(blockedBySlot(student, "mon", at(10, 30), settings)).toBeNull(); // gap after class: 40
    expect(blockedBySlot(student, "mon", at(8), settings)).toBeNull(); // 8:00-8:30, gap before class: 30
  });

  it("is allowed when the gap equals the walking time exactly", () => {
    // Class ends 9:50; a box starting 10:00 leaves exactly 10 minutes.
    expect(blockedBySlot(student, "mon", at(10), makeSettings({ walkingMinutes: 10 }))).toBeNull();
    expect(blockedBySlot(student, "mon", at(10), makeSettings({ walkingMinutes: 15 }))?.code).toBe("walking_time");
  });

  it("only matters on the day of the class", () => {
    expect(blockedBySlot(student, "tue", at(8, 30), makeSettings({ walkingMinutes: 30 }))).toBeNull();
  });

  it("is still reported as a plain class conflict when the class overlaps the box itself", () => {
    expect(blockedBySlot(student, "mon", at(9), makeSettings({ walkingMinutes: 30 }))?.code).toBe("class_conflict");
  });

  it("ignores other blocked times: only classes need walking time", () => {
    const job = makeStudent({ id: "s2", busy: buildBusy("", "M 9:00am-9:50am").busy });
    expect(blockedBySlot(job, "mon", at(8, 30), makeSettings({ walkingMinutes: 30 }))).toBeNull();
  });

  it("cannot be overridden by a manager, and says what to do in plain words", () => {
    const violation = canAssign(student, "mon", at(8, 30), [], makeSettings({ walkingMinutes: 10 }));
    expect(violation?.code).toBe("walking_time");
    expect(violation?.message).toMatch(/needs 10 minutes to walk to or from class on Mon at this time/i);
  });
});

describe("a shift that is already too close", () => {
  it("shows up as a blocking problem once a walking time is chosen, and not before", () => {
    const shift = [slot("s1", "mon", at(8, 30)), slot("s1", "mon", at(8, 30) + 30)].slice(0, 1); // ends 9:00, class starts 9:00
    expect(findIssues([student], shift, makeSettings()).some((i) => i.code === "walking_time")).toBe(false);
    const issues = findIssues([student], shift, makeSettings({ walkingMinutes: 10 })).filter((i) => i.code === "walking_time");
    expect(issues).toHaveLength(1);
    expect(isBlockingIssue(issues[0])).toBe(true);
    expect(issues[0].message).toMatch(/too little time to walk/i);
  });
});

describe("auto-fill with a walking time", () => {
  const roster = buildRandomStudents(25, (() => {
    let seed = 5;
    return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  })());

  /** The smallest number of minutes between any auto-filled box and a class box next to it on the same day. */
  function smallestGap(assignments: { studentId: string; day: string; start: number }[], slotMinutes: number): number {
    let smallest = Infinity;
    for (const student of roster) {
      for (const a of assignments.filter((x) => x.studentId === student.id)) {
        for (const b of student.busy.filter((x) => x.source === "class" && x.day === a.day)) {
          if (b.start >= a.start + slotMinutes) smallest = Math.min(smallest, b.start - (a.start + slotMinutes));
          else if (b.end <= a.start) smallest = Math.min(smallest, a.start - b.end);
        }
      }
    }
    return smallest;
  }

  it("without a walking time still leaves back-to-back gaps (the loophole this setting closes)", () => {
    const settings = makeSettings();
    expect(smallestGap(autoFill(roster, [], settings).assignments, settings.slotMinutes)).toBe(0);
  });

  it("never leaves a gap smaller than the walking time, and breaks no other rule", () => {
    for (const walkingMinutes of [10, 15, 30]) {
      const settings = makeSettings({ walkingMinutes });
      const { assignments } = autoFill(roster, [], settings);
      expect(assignments.length).toBeGreaterThan(0);
      expect(smallestGap(assignments, settings.slotMinutes), `walking time ${walkingMinutes}`).toBeGreaterThanOrEqual(walkingMinutes);
      expect(evaluateSchedule(roster, assignments, settings).ok, `walking time ${walkingMinutes}`).toBe(true);
    }
  });

  it("gives the same schedule as before when the walking time is left at none", () => {
    const standard = autoFill(roster, [], makeSettings());
    const explicitNone = autoFill(roster, [], makeSettings({ walkingMinutes: 0 }));
    expect(explicitNone.assignments).toEqual(standard.assignments);
  });
});

describe("saved settings validation for the walking time", () => {
  const base = { version: 1, students: [], assignments: [], semester: null, selectedStudentId: null };

  it("keeps a good value, leaves it out when absent, and refuses silly ones", () => {
    const good = validatePersistedState({ ...base, settings: { ...makeSettings(), walkingMinutes: 10 } });
    expect(good.ok && good.value.settings.walkingMinutes).toBe(10);
    const absent = validatePersistedState({ ...base, settings: makeSettings() });
    expect(absent.ok && "walkingMinutes" in absent.value.settings).toBe(false);
    for (const bad of [-5, 7, 35, 45, 12.5, "10", null, Number.NaN]) {
      expect(validatePersistedState({ ...base, settings: { ...makeSettings(), walkingMinutes: bad } }).ok, String(bad)).toBe(false);
    }
  });
});

describe("the Rules form", () => {
  const settings = makeSettings();

  it("offers the walking time, starting at None, and saves the choice", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<RulesForm settings={settings} onSave={onSave} onClose={() => undefined} />);
    const select = screen.getByLabelText(/walking time between class and a shift/i) as HTMLSelectElement;
    expect(select.value).toBe("0");
    expect([...select.options].map((o) => o.text)).toEqual(["None", "5 minutes", "10 minutes", "15 minutes", "20 minutes", "30 minutes"]);
    await user.selectOptions(select, "10");
    await user.click(screen.getByRole("button", { name: "Save rules" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ walkingMinutes: 10 }));
  });

  it("saves nothing for the walking time when it is left at None, so untouched settings stay untouched", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<RulesForm settings={settings} onSave={onSave} onClose={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Save rules" }));
    expect(onSave.mock.calls[0][0].walkingMinutes).toBeUndefined();
  });

  it("shows a walking time that was chosen earlier", () => {
    render(<RulesForm settings={makeSettings({ walkingMinutes: 15 })} onSave={() => undefined} onClose={() => undefined} />);
    expect((screen.getByLabelText(/walking time between class and a shift/i) as HTMLSelectElement).value).toBe("15");
  });
});
