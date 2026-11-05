import { assignedHours, blockedBySlot, daySlots, isAssigned } from "./availability";
import { openDays } from "./days";
import { studentLimit } from "./term";
import { formatRange, hoursLabel } from "./time";
import { DAY_LABEL } from "./types";
import type { Day, Minutes, ScheduleSettings, ShiftBlock, Student } from "./types";

/**
 * ============================================================================
 *  THE ROSTER VIEW: "WHO IS BUSY, WHO IS FREE, WHO STILL NEEDS HOURS?"
 * ============================================================================
 * The big student list shows, for every student, where their week is already taken, where they could
 * still work, and how many hours they still need. With 40 to 50 students a manager needs to filter and
 * sort that list, so those rules live here as plain functions (no React), the same way the scheduling
 * rules do. Everything is worked out fresh from the schedule, so the list is always live.
 */

/** What one half hour of one student's week is: already scheduled, free to schedule, or not possible (class, day off, devotional ...). */
export type SlotState = "scheduled" | "free" | "busy";

/** One day of a student's week, box by box, from opening time to closing time. */
export type DayMap = { day: Day; slots: { start: Minutes; state: SlotState }[] };

/** A student's whole week: every open day, every half hour, marked scheduled, free or busy. */
export function weekMap(student: Student, assignments: ShiftBlock[], settings: ScheduleSettings): DayMap[] {
  const starts = daySlots(settings);
  return openDays(settings).map((day) => ({
    day,
    slots: starts.map((start) => ({
      start,
      state: isAssigned(student.id, day, start, assignments) ? "scheduled" : blockedBySlot(student, day, start, settings) ? "busy" : "free",
    })),
  }));
}

/** The stretches of one day that are in a given state, as start and end (end = when the last box finishes). */
export function stretchesOf(map: DayMap, state: SlotState, slotMinutes: Minutes): { from: Minutes; to: Minutes }[] {
  const out: { from: Minutes; to: Minutes }[] = [];
  for (const slot of map.slots) {
    if (slot.state !== state) continue;
    const last = out[out.length - 1];
    if (last && last.to === slot.start) last.to = slot.start + slotMinutes;
    else out.push({ from: slot.start, to: slot.start + slotMinutes });
  }
  return out;
}

/** The stretches of the week in one state as plain words, one per day, e.g. "Mon 8:00am–12:00pm, 1:00pm–3:00pm · Wed 8:00am–12:00pm". Empty text if there are none. */
export function describeStretches(week: DayMap[], state: SlotState, slotMinutes: Minutes): string {
  return week
    .map((map) => {
      const stretches = stretchesOf(map, state, slotMinutes);
      return stretches.length ? `${DAY_LABEL[map.day]} ${stretches.map((s) => formatRange(s.from, s.to)).join(", ")}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

/** Where a student stands, in the words a manager thinks in. */
export type RosterStatus = "unscheduled" | "needs" | "full" | "over";

/** A student's hours so far, what they are allowed, and where that leaves them. */
export type RosterEntry = {
  student: Student;
  hours: number;
  limit: number;
  status: RosterStatus;
  /** Hours still to give them to reach their weekly hours (0 when they are there or over). */
  hoursLeft: number;
  /** A short phrase for the card, e.g. "Needs 6 more hours". */
  label: string;
};

/** Works out one student's status from their scheduled hours and their weekly limit. */
export function rosterEntry(student: Student, assignments: ShiftBlock[], settings: ScheduleSettings): RosterEntry {
  const hours = assignedHours(student.id, assignments, settings);
  const limit = studentLimit(student, settings);
  const hoursLeft = Math.max(0, limit - hours);
  if (hours > limit) return { student, hours, limit, status: "over", hoursLeft, label: `Over by ${hoursLabel(hours - limit)}` };
  if (hours === 0) return { student, hours, limit, status: "unscheduled", hoursLeft, label: "Not scheduled yet" };
  if (hoursLeft === 0) return { student, hours, limit, status: "full", hoursLeft, label: "At their hours" };
  return { student, hours, limit, status: "needs", hoursLeft, label: `Needs ${hoursLabel(hoursLeft)} more` };
}

/** Which students the roster shows. "needs" includes students not scheduled at all, since they need hours too. */
export type RosterFilter = "all" | "needs" | "unscheduled" | "full" | "graduating";

/** How the roster is ordered: by name, or the students who need the most hours first. */
export type RosterSort = "name" | "needs";

/** The roster after the search box, the filter chip and the sort choice have been applied. */
export function buildRoster(
  students: Student[],
  assignments: ShiftBlock[],
  settings: ScheduleSettings,
  options: { query: string; filter: RosterFilter; sort: RosterSort },
): RosterEntry[] {
  const query = options.query.trim().toLowerCase();
  const entries = students.filter((s) => !query || s.name.toLowerCase().includes(query)).map((s) => rosterEntry(s, assignments, settings));
  const shown = entries.filter((entry) => {
    switch (options.filter) {
      case "needs":
        return entry.status === "needs" || entry.status === "unscheduled";
      case "unscheduled":
        return entry.status === "unscheduled";
      case "full":
        return entry.status === "full" || entry.status === "over";
      case "graduating":
        return entry.student.graduating === true;
      default:
        return true;
    }
  });
  const byName = (a: RosterEntry, b: RosterEntry) => a.student.name.localeCompare(b.student.name);
  return shown.sort(options.sort === "needs" ? (a, b) => b.hoursLeft - a.hoursLeft || byName(a, b) : byName);
}

/** How many students fall under each filter chip (for the numbers on the chips). Ignores the search box on purpose, so the numbers do not jump while typing. */
export function rosterCounts(students: Student[], assignments: ShiftBlock[], settings: ScheduleSettings): Record<RosterFilter, number> {
  const entries = students.map((s) => rosterEntry(s, assignments, settings));
  return {
    all: entries.length,
    needs: entries.filter((e) => e.status === "needs" || e.status === "unscheduled").length,
    unscheduled: entries.filter((e) => e.status === "unscheduled").length,
    full: entries.filter((e) => e.status === "full" || e.status === "over").length,
    graduating: entries.filter((e) => e.student.graduating === true).length,
  };
}
