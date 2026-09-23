import { DAYS } from "./types";
import type { Day, Minutes, ShiftBlock, Student } from "./types";

/**
 * ============================================================================
 *  MERGING GRID BOXES INTO READABLE SHIFTS
 * ============================================================================
 * Internally every assignment is stored as one 30-minute `ShiftBlock` (see
 * `types.ts`), so a student working 9am-11am is really four separate records.
 * That's convenient for the grid, but nobody wants to read "9:00, 9:30, 10:00,
 * 10:30" as four rows — they want "9:00am-11:00am". This file merges those
 * back-to-back pieces into one human-readable shift, for the spreadsheet
 * export, the "By student"/"By day" views, and the calendar files.
 */

export type MergedBlock = { studentId: string; day: Day; start: Minutes; end: Minutes };

/** Merges adjacent same-student, same-day slots (one ShiftBlock each) into contiguous shifts. */
export function mergeContiguousBlocks(blocks: ShiftBlock[], slotMinutes: number): MergedBlock[] {
  const sorted = [...blocks].sort(
    (a, b) =>
      a.studentId.localeCompare(b.studentId) || DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start - b.start,
  );
  const merged: MergedBlock[] = [];
  for (const block of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.studentId === block.studentId && last.day === block.day && last.end === block.start) {
      last.end += slotMinutes;
    } else {
      merged.push({ studentId: block.studentId, day: block.day, start: block.start, end: block.start + slotMinutes });
    }
  }
  return merged;
}

/**
 * A short fingerprint of exactly who works when. Two schedules with the same shifts get
 * the same version regardless of ids or ordering, so "did this change since it was
 * approved/published?" is a simple comparison, and re-publishing is idempotent.
 */
export function scheduleVersion(assignments: ShiftBlock[]): string {
  const keys = assignments.map((a) => `${a.studentId}|${a.day}|${a.start}`).sort();
  let hash = 0x811c9dc5;
  for (const ch of keys.join(";")) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `v${keys.length}-${hash.toString(16).padStart(8, "0")}`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  // Leading = + - @ can be run as a formula by spreadsheet apps; prefix a quote to neutralize.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function clock(minutes: Minutes): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** One row per contiguous shift, ready for a spreadsheet. */
export function shiftsToCsv(students: Student[], assignments: ShiftBlock[], slotMinutes: number): string {
  const names = new Map(students.map((s) => [s.id, s.name]));
  const rows = [["Student", "Day", "Start", "End", "Hours"]];
  for (const b of mergeContiguousBlocks(assignments, slotMinutes)) {
    rows.push([
      names.get(b.studentId) ?? "Unknown",
      b.day.toUpperCase(),
      clock(b.start),
      clock(b.end),
      String((b.end - b.start) / 60),
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
