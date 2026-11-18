import { describe, expect, it } from "vitest";
import { assignedHours } from "../features/scheduling/availability";
import { findIssues } from "../features/scheduling/issues";
import { buildRandomStudents, MAX_RANDOM_STUDENTS } from "../features/scheduling/random-roster";
import { autoFill } from "../features/scheduling/scheduler";
import { makeSettings } from "./testkit";

/**
 * Tests for the "Try random students" button's student maker: any count from 1 to 25 gives that many
 * different made-up students, and Auto-fill can schedule every one of them without breaking a rule.
 */
describe("random students for testing", () => {
  it("makes exactly the number asked for, from 1 to 25, and never more", () => {
    for (const count of [1, 7, 20, 25]) expect(buildRandomStudents(count)).toHaveLength(count);
    expect(buildRandomStudents(0)).toHaveLength(1);
    expect(buildRandomStudents(500)).toHaveLength(MAX_RANDOM_STUDENTS);
  });

  it("gives every student a different id and name, and real class times", () => {
    const students = buildRandomStudents(25);
    expect(new Set(students.map((s) => s.id)).size).toBe(25);
    expect(new Set(students.map((s) => s.name)).size).toBe(25);
    for (const s of students) expect(Object.keys(s.busy).length, s.name).toBeGreaterThan(0);
  });

  it("gives a different roster each time", () => {
    expect(buildRandomStudents(10).map((s) => s.name)).not.toEqual(buildRandomStudents(10).map((s) => s.name));
  });

  it("can be scheduled by Auto-fill with no broken rules, at every size", () => {
    const settings = makeSettings();
    for (const count of [1, 5, 12, 25]) {
      const students = buildRandomStudents(count);
      const result = autoFill(students, [], settings);
      expect(findIssues(students, result.assignments, settings), `${count} students`).toEqual([]);
      for (const s of students) expect(assignedHours(s.id, result.assignments, settings), s.name).toBeGreaterThan(0);
    }
  });
});
