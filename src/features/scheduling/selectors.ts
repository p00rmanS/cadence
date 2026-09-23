import { assignedHours, hasOpeningShift, workedDayCount } from "./availability";
import type { ScheduleSettings, ShiftBlock, Student } from "./types";

/**
 * ============================================================================
 *  SMALL DISPLAY HELPERS FOR STUDENT CARDS
 * ============================================================================
 * Little pieces of derived, ready-to-render data for one student at a time
 * (their initials for an avatar chip, their hours as a percent of target,
 * etc). Nothing here changes state — it only reads it.
 */

export { formatMinutes, formatRange } from "./time";

/** "Troy C." -> "TC" for the round avatar chip next to a student's name. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export type StudentSummary = {
  student: Student;
  hours: number;
  pctOfTarget: number;
  atTarget: boolean;
  daysWorked: number;
  needsOpeningShift: boolean;
  openingShiftSatisfied: boolean;
};

export function summarizeStudent(student: Student, assignments: ShiftBlock[], settings: ScheduleSettings): StudentSummary {
  const hours = assignedHours(student.id, assignments, settings);
  return {
    student,
    hours,
    pctOfTarget: Math.min(100, (hours / settings.weeklyTargetHours) * 100),
    atTarget: hours >= settings.weeklyTargetHours,
    daysWorked: workedDayCount(student.id, assignments),
    needsOpeningShift: student.needsOpeningShift,
    openingShiftSatisfied: hasOpeningShift(student.id, assignments, settings),
  };
}
