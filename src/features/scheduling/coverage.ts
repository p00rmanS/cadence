import { daySlots, staffAt } from "./availability";
import { DAYS } from "./types";
import type { CoverageSlot, Day, GapRange, ScheduleSettings, ShiftBlock } from "./types";

/**
 * ============================================================================
 *  STAFFING COVERAGE: "IS EVERY TIME SLOT STAFFED?"
 * ============================================================================
 * Where `availability.ts` asks about one student, this file looks at the
 * WHOLE schedule at once and reports which grid boxes have enough people
 * assigned. It powers the pink/empty boxes on the grid, the "Schedule
 * health" panel's gap list, and the coverage percentages in the summary.
 * Nothing here is stored — it's recalculated from `assignments` every time
 * the schedule changes, so it can never drift out of sync.
 */

export function buildCoverageSlots(assignments: ShiftBlock[], settings: ScheduleSettings): CoverageSlot[] {
  const slots = daySlots(settings);
  const out: CoverageSlot[] = [];
  for (const day of DAYS) {
    for (const start of slots) {
      const assignedStudentIds = staffAt(day, start, assignments);
      out.push({
        day,
        start,
        end: start + settings.slotMinutes,
        assignedStudentIds,
        minRequired: settings.minStaffPerSlot,
        fullyStaffed: assignedStudentIds.length >= settings.minStaffPerSlot,
      });
    }
  }
  return out;
}

/**
 * Groups consecutive under-staffed slots on the same day into readable ranges.
 * The slots this reads from `buildCoverageSlots` are already ordered day-major,
 * time-minor, so a simple adjacency check is correct here — the prototype this
 * replaces iterated time-major/day-minor while merging with a day+time adjacency
 * check, so same-day gaps were almost never adjacent in the array and never merged.
 */
export function buildGapRanges(coverage: CoverageSlot[]): GapRange[] {
  const gaps = coverage.filter((s) => !s.fullyStaffed);
  const ranges: GapRange[] = [];
  for (const slot of gaps) {
    const shortfall = slot.minRequired - slot.assignedStudentIds.length;
    const last = ranges[ranges.length - 1];
    if (last && last.day === slot.day && last.end === slot.start && last.shortfall === shortfall) {
      last.end = slot.end;
    } else {
      ranges.push({ day: slot.day, start: slot.start, end: slot.end, shortfall });
    }
  }
  return ranges;
}

export type CoverageSummary = {
  /** % of slots that meet the minimum staffing requirement. */
  fullyStaffedPercent: number;
  /** % of total staffing DEMAND (slots x minStaff) that is actually filled. */
  demandFulfilledPercent: number;
  totalSlots: number;
  fullyStaffedSlots: number;
  /** Theoretical minimum labor-hours to staff every slot at minStaff — ignores availability. */
  theoreticalStaffingHours: number;
  /** Theoretical headcount if every student worked exactly the weekly target with zero conflicts. */
  theoreticalMinimumStudents: number;
};

export function summarizeCoverage(coverage: CoverageSlot[], settings: ScheduleSettings): CoverageSummary {
  const totalSlots = coverage.length;
  const fullyStaffedSlots = coverage.filter((s) => s.fullyStaffed).length;
  const demandSlots = totalSlots * settings.minStaffPerSlot;
  const filledSlots = coverage.reduce((sum, s) => sum + Math.min(s.assignedStudentIds.length, s.minRequired), 0);
  const theoreticalStaffingHours = (totalSlots * settings.slotMinutes * settings.minStaffPerSlot) / 60;
  return {
    fullyStaffedPercent: totalSlots ? Math.round((fullyStaffedSlots / totalSlots) * 100) : 100,
    demandFulfilledPercent: demandSlots ? Math.round((filledSlots / demandSlots) * 100) : 100,
    totalSlots,
    fullyStaffedSlots,
    theoreticalStaffingHours,
    theoreticalMinimumStudents: Math.ceil(theoreticalStaffingHours / settings.weeklyTargetHours),
  };
}

export function dayLabelOrder(day: Day): number {
  return DAYS.indexOf(day);
}
