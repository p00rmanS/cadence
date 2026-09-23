import type { BusyBlock, ConstraintViolation, Day, Minutes, ScheduleSettings, ShiftBlock, Student } from "./types";
import { DAY_LABEL } from "./types";
import { DAYS } from "./types";
import { MIN_OPENING_SHIFT_MINUTES, OPENING_SHIFT_START } from "./constants";
import { formatMinutes, hoursLabel } from "./time";

/**
 * ============================================================================
 *  RULE-CHECKING: "CAN THIS STUDENT WORK THIS SLOT?"
 * ============================================================================
 * This file answers yes/no questions about one student and one 30-minute grid
 * box at a time: are they busy then, would it push them over their weekly
 * hours, have they already worked their max days, etc. It is the single
 * source of truth for the scheduling rules — the grid (when you click a box),
 * "Fill schedule for me" (`scheduler.ts`), and the health checker
 * (`issues.ts`) all call into these same functions, so a rule only ever has
 * to be written once. Start with `canAssign` — it's the main entry point.
 */

/** Slot starts between open and close, inclusive of open, exclusive of close. */
export function daySlots(settings: ScheduleSettings): Minutes[] {
  const out: Minutes[] = [];
  for (let m = settings.openTime; m < settings.closeTime; m += settings.slotMinutes) out.push(m);
  return out;
}

/** The class or blocked time that overlaps this slot, if any. */
export function busyBlockAt(student: Student, day: Day, slotStart: Minutes, slotMinutes: number): BusyBlock | undefined {
  return student.busy.find((b) => b.day === day && b.start < slotStart + slotMinutes && b.end > slotStart);
}

export function isBusy(student: Student, day: Day, slotStart: Minutes, slotMinutes: number): boolean {
  return busyBlockAt(student, day, slotStart, slotMinutes) !== undefined;
}

/**
 * Assignment helpers always look at ALL of a student's assignments, never only the
 * ones inside the currently visible open-hours window. The prototype this replaces
 * counted hours only over visible slots, so the 19-hour cap silently disagreed with
 * reality when the manager switched between the 7am and 8am views.
 */
export function studentAssignments(studentId: string, assignments: ShiftBlock[]): ShiftBlock[] {
  return assignments.filter((a) => a.studentId === studentId);
}

export function assignedHours(studentId: string, assignments: ShiftBlock[], settings: ScheduleSettings): number {
  return (studentAssignments(studentId, assignments).length * settings.slotMinutes) / 60;
}

export function assignedHoursOnDay(
  studentId: string,
  day: Day,
  assignments: ShiftBlock[],
  settings: ScheduleSettings,
): number {
  return (
    (studentAssignments(studentId, assignments).filter((a) => a.day === day).length * settings.slotMinutes) / 60
  );
}

export function workedDayCount(studentId: string, assignments: ShiftBlock[]): number {
  return new Set(studentAssignments(studentId, assignments).map((a) => a.day)).size;
}

export function canUseDay(student: Student, day: Day, assignments: ShiftBlock[], settings: ScheduleSettings): boolean {
  return (
    assignedHoursOnDay(student.id, day, assignments, settings) > 0 ||
    workedDayCount(student.id, assignments) < student.daysPerWeek
  );
}

export function isAssigned(studentId: string, day: Day, slotStart: Minutes, assignments: ShiftBlock[]): boolean {
  return assignments.some((a) => a.studentId === studentId && a.day === day && a.start === slotStart);
}

export function staffAt(day: Day, slotStart: Minutes, assignments: ShiftBlock[]): string[] {
  const ids = assignments.filter((a) => a.day === day && a.start === slotStart).map((a) => a.studentId);
  return Array.from(new Set(ids));
}

/**
 * True when the student has a real contiguous opening shift: at least
 * `MIN_OPENING_SHIFT_MINUTES` of back-to-back slots starting exactly at
 * `OPENING_SHIFT_START` on some day. One lone 30-minute slot does not count.
 */
export function hasOpeningShift(studentId: string, assignments: ShiftBlock[], settings: ScheduleSettings): boolean {
  const requiredSlots = Math.ceil(MIN_OPENING_SHIFT_MINUTES / settings.slotMinutes);
  for (const day of DAYS) {
    let run = 0;
    let cursor = OPENING_SHIFT_START;
    while (isAssigned(studentId, day, cursor, assignments)) {
      run += 1;
      cursor += settings.slotMinutes;
    }
    if (run >= requiredSlots) return true;
  }
  return false;
}

/**
 * The constraint that makes this slot itself invalid for `student`, or null.
 * Only slot-level hard rules live here; weekly-target and day-count limits depend
 * on the rest of the student's schedule and are checked in `canAssign`.
 */
export function blockedBySlot(
  student: Student,
  day: Day,
  slotStart: Minutes,
  settings: ScheduleSettings,
): ConstraintViolation | null {
  const busy = busyBlockAt(student, day, slotStart, settings.slotMinutes);
  if (busy) {
    return busy.source === "class"
      ? { code: "class_conflict", message: `has class on ${DAY_LABEL[day]} at this time` }
      : { code: "unavailable", message: `is unavailable on ${DAY_LABEL[day]} at this time` };
  }
  if (slotStart + settings.slotMinutes > student.latestEnd) {
    return { code: "after_cutoff", message: `can't work past ${formatMinutes(student.latestEnd)}` };
  }
  if (student.lunchStart != null && slotStart === student.lunchStart) {
    return { code: "lunch_conflict", message: `is on lunch at ${formatMinutes(student.lunchStart)}` };
  }
  return null;
}

/**
 * Every soft limit this assignment would break (weekly hours, days per week). Unlike a class
 * or lunch conflict, a manager may knowingly allow these, so an override dialog must list
 * ALL of them, not just the first one `canAssign` happens to report.
 */
export function softViolations(
  student: Student,
  day: Day,
  slotStart: Minutes,
  assignments: ShiftBlock[],
  settings: ScheduleSettings,
): ConstraintViolation[] {
  if (blockedBySlot(student, day, slotStart, settings) || isAssigned(student.id, day, slotStart, assignments)) return [];
  const out: ConstraintViolation[] = [];
  if (assignedHours(student.id, assignments, settings) >= settings.weeklyTargetHours) {
    out.push({ code: "over_weekly_target", message: `is already at ${hoursLabel(settings.weeklyTargetHours)}` });
  }
  if (!canUseDay(student, day, assignments, settings)) {
    out.push({ code: "over_max_days", message: `only works ${student.daysPerWeek} ${student.daysPerWeek === 1 ? "day" : "days"} a week` });
  }
  return out;
}

export function canAssign(
  student: Student,
  day: Day,
  slotStart: Minutes,
  assignments: ShiftBlock[],
  settings: ScheduleSettings,
): ConstraintViolation | null {
  const slotViolation = blockedBySlot(student, day, slotStart, settings);
  if (slotViolation) return slotViolation;
  if (isAssigned(student.id, day, slotStart, assignments)) {
    return { code: "already_assigned", message: "is already working this slot" };
  }
  if (assignedHours(student.id, assignments, settings) >= settings.weeklyTargetHours) {
    return { code: "over_weekly_target", message: `is already at ${hoursLabel(settings.weeklyTargetHours)}` };
  }
  if (!canUseDay(student, day, assignments, settings)) {
    return { code: "over_max_days", message: `only works ${student.daysPerWeek} ${student.daysPerWeek === 1 ? "day" : "days"} a week` };
  }
  return null;
}
