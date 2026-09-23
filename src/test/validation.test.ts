import { describe, expect, it } from "vitest";
import { validatePersistedState } from "../features/scheduling/validation";
import { DEFAULT_SETTINGS } from "../features/scheduling/constants";
import { makeStudent, slot } from "./testkit";
import type { PersistedStateV1 } from "../features/scheduling/types";

function state(overrides: Partial<PersistedStateV1> = {}): PersistedStateV1 {
  return {
    version: 1,
    settings: DEFAULT_SETTINGS,
    students: [makeStudent()],
    assignments: [slot("s1", "mon", 540)],
    selectedStudentId: "s1",
    semester: null,
    ...overrides,
  };
}

function fails(input: unknown): string {
  const result = validatePersistedState(input);
  expect(result.ok).toBe(false);
  return result.ok ? "" : result.errors.join(" | ");
}

describe("validatePersistedState", () => {
  it("accepts a good backup and returns a clean copy", () => {
    const result = validatePersistedState(state());
    expect(result.ok).toBe(true);
  });

  it("strips fields it doesn't know about", () => {
    const dirty = { ...state(), evil: "<script>", students: [{ ...makeStudent(), extra: 1 }] };
    const result = validatePersistedState(dirty);
    expect(result.ok && "evil" in result.value).toBe(false);
    expect(result.ok && "extra" in result.value.students[0]).toBe(false);
  });

  it("rejects things that aren't backups", () => {
    for (const bad of [null, "text", 5, [], { version: 2 }, { version: 1 }]) fails(bad);
  });

  it("rejects nonsense settings", () => {
    fails(state({ settings: { ...DEFAULT_SETTINGS, weeklyTargetHours: -1 } }));
    fails(state({ settings: { ...DEFAULT_SETTINGS, weeklyTargetHours: 500 } }));
    fails(state({ settings: { ...DEFAULT_SETTINGS, openTime: 900, closeTime: 800 } }));
    fails(state({ settings: { ...DEFAULT_SETTINGS, minStaffPerSlot: 0 } }));
    fails(state({ settings: { ...DEFAULT_SETTINGS, slotMinutes: 17 } }));
  });

  it("rejects malformed students with a readable message", () => {
    expect(fails(state({ students: [{ ...makeStudent(), name: "" }] }))).toMatch(/Student #1.*name/);
    fails(state({ students: [{ ...makeStudent(), daysPerWeek: 9 }] }));
    fails(state({ students: [{ ...makeStudent(), busy: [{ day: "sun", start: 1, end: 2, source: "class" }] as never }] }));
    fails(state({ students: [{ ...makeStudent(), busy: [{ day: "mon", start: 600, end: 500, source: "class" }] }] }));
  });

  it("rejects duplicate student ids", () => {
    expect(fails(state({ students: [makeStudent(), makeStudent()] }))).toMatch(/duplicate/);
  });

  it("repairs a bad color instead of rejecting the whole file", () => {
    const result = validatePersistedState(state({ students: [makeStudent({ color: "url(javascript:alert(1))" })] }));
    expect(result.ok && result.value.students[0].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("drops shifts for students that aren't in the file and says so", () => {
    const result = validatePersistedState(state({ assignments: [slot("s1", "mon", 540), slot("ghost", "mon", 540)] }));
    expect(result.ok && result.value.assignments).toHaveLength(1);
    expect(result.ok && result.notes.join(" ")).toMatch(/Skipped 1 shift/);
  });

  it("drops duplicate shifts", () => {
    const result = validatePersistedState(state({ assignments: [slot("s1", "mon", 540), { ...slot("s1", "mon", 540), id: "other" }] }));
    expect(result.ok && result.value.assignments).toHaveLength(1);
  });

  it("rejects shifts that aren't on a half hour or a real day", () => {
    fails(state({ assignments: [{ ...slot("s1", "mon", 545) }] }));
    fails(state({ assignments: [{ ...slot("s1", "mon", 540), day: "sun" as never }] }));
  });

  it("caps the size of a backup", () => {
    const many = Array.from({ length: 5001 }, (_, i) => slot("s1", "mon", (i % 40) * 30));
    fails(state({ assignments: many }));
  });

  it("picks a valid selected student when the saved one is gone", () => {
    const result = validatePersistedState(state({ selectedStudentId: "missing" }));
    expect(result.ok && result.value.selectedStudentId).toBe("s1");
  });

  it("validates the calendar semester", () => {
    const ok = { startDate: "2026-08-24", endDate: "2026-12-11", timeZone: "Pacific/Honolulu" };
    expect(validatePersistedState(state({ semester: ok })).ok).toBe(true);
    fails(state({ semester: { ...ok, endDate: "2026-08-01" } }));
    fails(state({ semester: { ...ok, startDate: "2026-02-31" } }));
    fails(state({ semester: { ...ok, timeZone: "Mars/Olympus" } }));
  });
});

describe("days off in a backup", () => {
  const sem = { startDate: "2026-08-24", endDate: "2026-12-11", timeZone: "Pacific/Honolulu" };

  it("are kept, sorted and de-duplicated", () => {
    const r = validatePersistedState(state({ semester: { ...sem, skipDates: ["2026-11-26", "2026-09-07", "2026-11-26"] } }));
    expect(r.ok && r.value.semester?.skipDates).toEqual(["2026-09-07", "2026-11-26"]);
  });

  it("default to none for older backups", () => {
    const r = validatePersistedState(state({ semester: sem }));
    expect(r.ok && r.value.semester?.skipDates).toEqual([]);
  });

  it("reject fake dates and oversized lists", () => {
    fails(state({ semester: { ...sem, skipDates: ["2026-02-31"] } }));
    fails(state({ semester: { ...sem, skipDates: ["tomorrow"] } }));
    fails(state({ semester: { ...sem, skipDates: Array.from({ length: 101 }, (_, i) => `2026-09-${String((i % 28) + 1).padStart(2, "0")}`) } }));
  });
});
