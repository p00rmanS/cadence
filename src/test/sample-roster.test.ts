import { describe, expect, it, vi } from "vitest";
import { shiftRuns } from "../features/scheduling/availability";
import { DEFAULT_SETTINGS } from "../features/scheduling/constants";
import { findIssues } from "../features/scheduling/issues";
import { DAYS } from "../features/scheduling/types";
import { validatePersistedState } from "../features/scheduling/validation";

/**
 * Tests for the app's real sample roster (the 25 made-up students new managers see first). Other tests use an
 * older fixture roster instead (see `fixtures/legacy-demo-data.ts`), so this file asks for the REAL one with
 * `vi.importActual`.
 */
async function realSample() {
  const real = await vi.importActual<typeof import("../features/scheduling/demo-data")>("../features/scheduling/demo-data");
  return real.buildDemoData();
}

describe("the real sample roster", () => {
  it("has 25 made-up students with different names and different class schedules", async () => {
    const { students } = await realSample();
    expect(students).toHaveLength(25);
    expect(new Set(students.map((s) => s.name)).size).toBe(25);
    expect(new Set(students.map((s) => s.classText)).size).toBe(25);
    expect(students.every((s) => s.busy.length > 0)).toBe(true);
  });

  it("gives everyone exactly 19 hours with no rule problems", async () => {
    const { students, assignments } = await realSample();
    for (const s of students) {
      expect(assignments.filter((a) => a.studentId === s.id).length / 2, s.name).toBe(19);
    }
    expect(findIssues(students, assignments, DEFAULT_SETTINGS)).toEqual([]);
  });

  it("uses only 4-hour shifts, one 3-hour shift each, and some 2-hour pieces around classes", async () => {
    const { students, assignments } = await realSample();
    let splitStudents = 0;
    for (const s of students) {
      const lengths = DAYS.flatMap((d) => shiftRuns(s.id, d, assignments, DEFAULT_SETTINGS).map((r) => (r.end - r.start) / 60));
      expect(lengths.every((h) => h === 2 || h === 3 || h === 4), s.name).toBe(true);
      expect(lengths.filter((h) => h === 3), s.name).toHaveLength(1);
      if (lengths.includes(2)) splitStudents++;
    }
    expect(splitStudents).toBeGreaterThanOrEqual(3);
    expect(splitStudents).toBeLessThan(25);
  });

  it("always has between 4 and 6 people working, except during Tuesday devotional", async () => {
    const { assignments } = await realSample();
    const crowd = new Map<string, number>();
    for (const a of assignments) crowd.set(`${a.day}|${a.start}`, (crowd.get(`${a.day}|${a.start}`) ?? 0) + 1);
    for (const day of DAYS) {
      for (let m = DEFAULT_SETTINGS.openTime; m < DEFAULT_SETTINGS.closeTime; m += 30) {
        if (day === "tue" && m >= 11 * 60 && m < 12 * 60) continue;
        const n = crowd.get(`${day}|${m}`) ?? 0;
        expect(n, `${day} ${m}`).toBeGreaterThanOrEqual(4);
        expect(n, `${day} ${m}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it("is a valid saved schedule that survives a reload", async () => {
    const { students, assignments } = await realSample();
    const saved = { version: 1, settings: DEFAULT_SETTINGS, students, assignments, selectedStudentId: null, semester: null };
    expect(validatePersistedState(JSON.parse(JSON.stringify(saved))).ok).toBe(true);
  });
});
