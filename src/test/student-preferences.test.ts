import { describe, expect, it } from "vitest";
import { blockedBySlot, canAssign } from "../features/scheduling/availability";
import { assignedHours } from "../features/scheduling/availability";
import { evaluateSchedule } from "../features/scheduling/evaluate";
import { findIssues } from "../features/scheduling/issues";
import { autoFill } from "../features/scheduling/scheduler";
import { summarizeStudent } from "../features/scheduling/selectors";
import { studentLimit } from "../features/scheduling/term";
import { validatePersistedState } from "../features/scheduling/validation";
import { makeSettings, makeStudent, run } from "./testkit";

/**
 * Tests for the three optional work preferences on a student: the days they want to work, their own weekly
 * hours, and the earliest they can start (`workDays`, `weeklyHours`, `earliestStart`). Days and start time
 * act like any other time the student can't work; the hours replace the office limit for that student
 * (never above it). Times are minutes after midnight (540 = 9:00am).
 */

const settings = makeSettings(); // 19 hours a week, semester, Mon-Fri, 7:00am to midnight

describe("days they want to work", () => {
  const student = makeStudent({ id: "s1", name: "Noa K.", workDays: ["tue", "thu"] });

  it("blocks every other day, saying why, and allows the chosen ones", () => {
    expect(blockedBySlot(student, "mon", 9 * 60, settings)).toMatchObject({ code: "unavailable", message: expect.stringContaining("only wants to work Tue, Thu") });
    expect(blockedBySlot(student, "fri", 9 * 60, settings)).not.toBeNull();
    expect(blockedBySlot(student, "tue", 9 * 60, settings)).toBeNull();
    expect(blockedBySlot(student, "thu", 15 * 60, settings)).toBeNull();
  });

  it("means any day when the list is missing or empty", () => {
    for (const workDays of [undefined, []]) {
      expect(blockedBySlot(makeStudent({ workDays }), "mon", 9 * 60, settings)).toBeNull();
    }
  });

  it("is refused for a manual assignment, and flagged when a shift is already on a day left out", () => {
    expect(canAssign(student, "mon", 9 * 60, [], settings)).not.toBeNull();
    const issues = findIssues([student], run("s1", "mon", 9 * 60, 11 * 60), settings);
    expect(issues.some((i) => i.code === "unavailable" && i.studentId === "s1")).toBe(true);
  });

  it("is respected by auto-fill: no shift on a day left out", () => {
    const { assignments } = autoFill([student], [], settings);
    expect(assignments.length).toBeGreaterThan(0);
    expect(new Set(assignments.map((a) => a.day))).toEqual(new Set(["tue", "thu"]));
  });
});

describe("earliest start", () => {
  const student = makeStudent({ id: "s1", earliestStart: 10 * 60 });

  it("blocks boxes before that time and allows it and later", () => {
    expect(blockedBySlot(student, "mon", 9 * 60 + 30, settings)).toMatchObject({ code: "unavailable", message: expect.stringContaining("can't start before 10:00am") });
    expect(blockedBySlot(student, "mon", 10 * 60, settings)).toBeNull();
    expect(blockedBySlot(student, "mon", 14 * 60, settings)).toBeNull();
  });

  it("is respected by auto-fill", () => {
    const { assignments } = autoFill([student], [], settings);
    expect(assignments.length).toBeGreaterThan(0);
    expect(Math.min(...assignments.map((a) => a.start))).toBeGreaterThanOrEqual(10 * 60);
  });
});

describe("a student's own weekly hours", () => {
  it("replace the office limit, but never go above it", () => {
    expect(studentLimit(makeStudent(), settings)).toBe(19);
    expect(studentLimit(makeStudent({ weeklyHours: 10 }), settings)).toBe(10);
    expect(studentLimit(makeStudent({ weeklyHours: 30 }), settings)).toBe(19);
    // during a break the office limit is 40, so 25 is allowed
    expect(studentLimit(makeStudent({ weeklyHours: 25 }), makeSettings({ term: "break" }))).toBe(25);
  });

  it("are the most auto-fill schedules for that student, and what it aims for", () => {
    const student = makeStudent({ id: "s1", name: "Noa K.", weeklyHours: 8 });
    const { assignments } = autoFill([student], [], settings);
    expect(assignedHours("s1", assignments, settings)).toBe(8);
  });

  it("make going over them a problem, while the other students keep the office limit", () => {
    const limited = makeStudent({ id: "s1", name: "Noa K.", weeklyHours: 4 });
    const normal = makeStudent({ id: "s2", name: "Lea P." });
    const assignments = [...run("s1", "mon", 9 * 60, 14 * 60), ...run("s2", "mon", 9 * 60, 14 * 60)]; // 5 hours each
    const problems = findIssues([limited, normal], assignments, settings).filter((i) => i.code === "over_weekly_target");
    expect(problems.map((i) => i.studentId)).toEqual(["s1"]);
    expect(problems[0].message).toContain("weekly limit of 4");
  });

  it("decide who is 'at their hours' in the summaries and the report", () => {
    const student = makeStudent({ id: "s1", name: "Noa K.", weeklyHours: 4 });
    const assignments = run("s1", "tue", 9 * 60, 13 * 60); // 4 hours
    expect(summarizeStudent(student, assignments, settings)).toMatchObject({ hours: 4, atTarget: true, pctOfTarget: 100 });
    expect(evaluateSchedule([student], assignments, settings).students[0].atTarget).toBe(true);
  });
});

describe("saved data and backups", () => {
  const base = { version: 1, assignments: [], semester: null, selectedStudentId: null, settings };
  const asSaved = (overrides: object) => ({ ...base, students: [{ ...makeStudent({ id: "s1", name: "Noa K." }), ...overrides }] });

  it("keep all three preferences, and leave them out when the student has none", () => {
    const kept = validatePersistedState(asSaved({ workDays: ["tue", "thu"], weeklyHours: 12.5, earliestStart: 600 }));
    expect(kept.ok && kept.value.students[0]).toMatchObject({ workDays: ["tue", "thu"], weeklyHours: 12.5, earliestStart: 600 });
    const none = validatePersistedState(asSaved({}));
    expect(none.ok && ["workDays", "weeklyHours", "earliestStart"].some((k) => k in none.value.students[0])).toBe(false);
  });

  it.each([
    { workDays: ["funday"] },
    { workDays: ["tue", "tue"] },
    { workDays: "tue" },
    { weeklyHours: 0 },
    { weeklyHours: 41 },
    { weeklyHours: 12.3 },
    { earliestStart: -5 },
    { earliestStart: 1500 },
  ])("refuse a silly value: %j", (overrides) => {
    expect(validatePersistedState(asSaved(overrides)).ok).toBe(false);
  });
});
