import { daySlots } from "./availability";
import { openDays } from "./days";
import { requiredStaff } from "./staffing";
import { isDevotional } from "./term";
import type { Day, Minutes, ScheduleSettings, ShiftBlock, Student } from "./types";

/**
 * ============================================================================
 *  THE PRINTED SCHEDULE: ONE CLEAN PAGE EVERYONE CAN READ
 * ============================================================================
 * The on-screen grid is built for clicking, so it shows initials, colors and buttons. A printed
 * schedule on a wall has to be read from across a room, so it spells out every name, one row per
 * hour, one column per day. This file turns the saved shifts into exactly that table. It only reads
 * the schedule; nothing here changes it. `PrintSchedule.tsx` draws the result.
 */

/** One person in one printed hour. `half` is true when they work only part of that hour (for example 7:30 to 8:00). */
export type PrintedPerson = { id: string; name: string; half: boolean };

/** One box of the printed table: an hour on one day. */
export type PrintedCell = {
  people: PrintedPerson[];
  /** How many more people this hour needs at its busiest half hour (0 when it has enough). */
  needMore: number;
  /** The Tuesday devotional: nobody works and nobody is needed. */
  closed: boolean;
};

/** One printed row: the hour it starts, and its box for each open day. */
export type PrintedRow = { start: Minutes; cells: Record<Day, PrintedCell> };

/** The whole printed table: the open days across the top and one row per hour. */
export type PrintedGrid = { days: Day[]; rows: PrintedRow[] };

/** One printed row is this long: an hour. */
const PRINT_ROW_MINUTES = 60;

/**
 * Builds the table to print. Each row is an hour from opening to closing time. A person is listed in
 * an hour when they work any part of it, marked `half` when they do not work all of it.
 */
export function buildPrintedGrid(students: Student[], assignments: ShiftBlock[], settings: ScheduleSettings): PrintedGrid {
  const days = openDays(settings);
  const byId = new Map(students.map((student) => [student.id, student]));
  const slots = daySlots(settings);
  const first = slots[0] ?? settings.openTime;
  const last = slots.length ? slots[slots.length - 1] + settings.slotMinutes : settings.closeTime;
  // How many saved half hours each person has, by "day|start", so the loop below is quick even with many students.
  const working = new Map<string, Set<string>>();
  for (const block of assignments) {
    const key = `${block.day}|${block.start}`;
    const set = working.get(key) ?? new Set<string>();
    set.add(block.studentId);
    working.set(key, set);
  }

  const rows: PrintedRow[] = [];
  for (let start = first; start < last; start += PRINT_ROW_MINUTES) {
    const cells = {} as Record<Day, PrintedCell>;
    for (const day of days) {
      const hourSlots = slots.filter((slot) => slot >= start && slot < start + PRINT_ROW_MINUTES);
      const counts = new Map<string, number>();
      let needMore = 0;
      let closedSlots = 0;
      for (const slot of hourSlots) {
        const here = working.get(`${day}|${slot}`) ?? new Set<string>();
        for (const id of here) if (byId.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
        if (isDevotional(day, slot, settings)) {
          closedSlots++;
          continue;
        }
        needMore = Math.max(needMore, requiredStaff(settings, day, slot) - here.size);
      }
      const people = [...counts.entries()]
        .map(([id, count]) => ({ id, name: byId.get(id)!.name, half: count < hourSlots.length }))
        .sort((a, b) => a.name.localeCompare(b.name));
      cells[day] = { people, needMore: Math.max(0, needMore), closed: hourSlots.length > 0 && closedSlots === hourSlots.length };
    }
    rows.push({ start, cells });
  }
  return { days, rows };
}
