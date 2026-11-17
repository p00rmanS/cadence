import { describe, expect, it } from "vitest";
import { autoFill } from "../features/scheduling/scheduler";
import { DEFAULT_SETTINGS, MAX_ASSIGNMENTS, MAX_STUDENTS, NO_CUTOFF } from "../features/scheduling/constants";
import { validatePersistedState } from "../features/scheduling/validation";
import { initialState, reducer } from "../hooks/useShiftFitStore";
import type { ShiftBlock, Student } from "../features/scheduling/types";

/**
 * Tests for the "biggest possible schedule" limit. Before the fix, 132+ students (63+ on a break) could be
 * auto-filled into more shifts than a saved schedule may hold, so the loader rejected it on refresh and
 * the manager lost everything. These tests make sure a full roster saves AND reloads, and that a change
 * going past the limit is declined instead of being saved.
 */

/** `count` made-up students with no classes, so auto-fill can give each one their full weekly hours. */
function roster(count: number): Student[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    name: `Student ${i}`,
    color: "#1F6FB2",
    preference: "any" as const,
    daysPerWeek: 5,
    classText: "",
    blockedText: "",
    busy: [],
    latestEnd: NO_CUTOFF,
    breaks: [],
    needsOpeningShift: false,
  }));
}

/** Wraps a roster and shifts the way a saved schedule looks, then runs the same checker used on reload. */
function reloads(students: Student[], assignments: ShiftBlock[], term: "semester" | "break") {
  const saved = { version: 1, settings: { ...DEFAULT_SETTINGS, term }, students, assignments, selectedStudentId: null, semester: null };
  return validatePersistedState(JSON.parse(JSON.stringify(saved)));
}

describe("the biggest schedule", () => {
  it("fits the full roster at the full break-term hours", () => {
    expect(MAX_ASSIGNMENTS).toBeGreaterThanOrEqual(MAX_STUDENTS * 80);
  });

  it("a 132-student semester schedule (the old failure) saves and reloads", () => {
    const students = roster(132);
    const result = autoFill(students, [], DEFAULT_SETTINGS);
    expect(result.assignments.length).toBeGreaterThan(5000);
    expect(reloads(students, result.assignments, "semester").ok).toBe(true);
  }, 60_000);

  it("a 63-student break schedule (the old failure) saves and reloads", () => {
    const students = roster(63);
    const settings = { ...DEFAULT_SETTINGS, term: "break" as const };
    const result = autoFill(students, [], settings);
    expect(result.assignments.length).toBeGreaterThan(5000);
    expect(reloads(students, result.assignments, "break").ok).toBe(true);
  }, 60_000);

  it("a change that would pass the limit is declined, not saved", () => {
    const base = initialState();
    const fake: ShiftBlock[] = Array.from({ length: MAX_ASSIGNMENTS }, (_, i) => ({ id: `x${i}`, studentId: "s0", day: "mon", start: 0, source: "manual" }));
    const full = { ...base, doc: { ...base.doc, assignments: fake } };
    const after = reducer(full, { type: "AUTOFILL", replace: false });
    expect(after.doc.assignments.length).toBeLessThanOrEqual(MAX_ASSIGNMENTS);
  });
});
