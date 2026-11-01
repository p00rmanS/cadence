import { hoursLabel, formatMinutes } from "../../features/scheduling/time";
import type { Student } from "../../features/scheduling/types";

/**
 * One plain sentence about a student's own work limits ("Wants 12 hours a week, can't start before 9:00am,
 * must leave by 5:00pm"), or null when they have none. Used where a student's details are shown before they
 * are added (the manager's student-link window and the student's own "check your details" screen).
 */
export function studentLimitText(student: Pick<Student, "weeklyHours" | "earliestStart" | "latestEnd">): string | null {
  const parts: string[] = [];
  if (student.weeklyHours !== undefined) parts.push(`wants ${hoursLabel(student.weeklyHours)} a week`);
  if (student.earliestStart) parts.push(`can't start before ${formatMinutes(student.earliestStart)}`);
  if (student.latestEnd < 24 * 60) parts.push(`must leave by ${formatMinutes(student.latestEnd)}`);
  if (parts.length === 0) return null;
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
