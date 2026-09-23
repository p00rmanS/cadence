import { DEFAULT_SETTINGS, NO_CUTOFF } from "../features/scheduling/constants";
import type { ScheduleSettings, ShiftBlock, Student } from "../features/scheduling/types";
import type { Day } from "../features/scheduling/types";

/** Shared builders so each test states only the facts it cares about. */
export function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: "s1",
    name: "Test Student",
    color: "#1F6FB2",
    preference: "any",
    daysPerWeek: 5,
    classText: "",
    blockedText: "",
    busy: [],
    latestEnd: NO_CUTOFF,
    lunchStart: null,
    needsOpeningShift: false,
    ...overrides,
  };
}

export function makeSettings(overrides: Partial<ScheduleSettings> = {}): ScheduleSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

export function slot(studentId: string, day: Day, start: number, source: ShiftBlock["source"] = "manual"): ShiftBlock {
  return { id: `${source}-${studentId}-${day}-${start}`, studentId, day, start, source };
}

/** Consecutive 30-minute slots from `start` (inclusive) to `end` (exclusive). */
export function run(studentId: string, day: Day, start: number, end: number, source: ShiftBlock["source"] = "manual"): ShiftBlock[] {
  const out: ShiftBlock[] = [];
  for (let m = start; m < end; m += 30) out.push(slot(studentId, day, m, source));
  return out;
}
