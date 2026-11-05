import type { Day, Minutes, ScheduleSettings, StaffingNeed } from "./types";

/**
 * ============================================================================
 *  HOW MANY PEOPLE DOES EACH TIME NEED?
 * ============================================================================
 * The office has one standard answer ("People needed at once", for example 1), but a manager can say
 * that certain times need more, such as two people over the lunch rush. Those exceptions are the
 * `staffingNeeds` list in the settings. Everything that asks "is this box staffed?" (the grid, the
 * coverage numbers and the automatic planner) asks `requiredStaff` here, so they can never disagree.
 */

/** Most exceptions kept; far more than a real week needs, and it keeps a pasted file from being huge. */
export const MAX_STAFFING_NEEDS = 200;

/** How many people the box starting at `start` on `day` needs: the exception covering it, or the standard number. */
export function requiredStaff(settings: ScheduleSettings, day: Day, start: Minutes): number {
  const exception = settings.staffingNeeds?.find((need) => need.day === day && start >= need.from && start < need.to);
  return exception ? exception.people : settings.minStaffPerSlot;
}

/**
 * The exceptions list after saying "from `from` up to `to` on `day`, `people` are needed". Older exceptions
 * that overlap are trimmed or split so the new answer wins on those times and the rest are kept. Saying
 * the standard number simply clears the exception, since the standard needs no entry.
 */
export function withStaffingNeed(settings: ScheduleSettings, day: Day, from: Minutes, to: Minutes, people: number): StaffingNeed[] {
  const kept: StaffingNeed[] = [];
  for (const need of settings.staffingNeeds ?? []) {
    if (need.day !== day || need.to <= from || need.from >= to) {
      kept.push(need); // a different day, or no overlap: untouched
      continue;
    }
    if (need.from < from) kept.push({ ...need, to: from }); // the part before the new stretch
    if (need.to > to) kept.push({ ...need, from: to }); // the part after it
  }
  if (people !== settings.minStaffPerSlot) kept.push({ day, from, to, people });
  return kept;
}
