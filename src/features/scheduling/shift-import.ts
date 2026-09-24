import { parseMeetingLine } from "./parser";
import type { Day, Minutes, Student } from "./types";

/**
 * ============================================================================
 *  "PASTE EXISTING SHIFTS" PARSER
 * ============================================================================
 * Supervisors often already have a schedule written as plain text ("Noa K.: MWF 9:00am-1:00pm")
 * in an email, message or spreadsheet. This turns that text into a preview list of shifts,
 * matched to students already in ShiftFit by name. It only READS text — it never changes the
 * schedule. Placing the shifts (and refusing any that break a rule) is done later by the store,
 * so the same rules apply as when a manager clicks the grid.
 *
 * Line format: `Name: days time-range; days time-range` (or tab-separated spreadsheet cells,
 * name first). The day/time part reuses the class-time parser, so "MWF 9:00-1:00pm" and
 * "Tuesday/Thursday 8:00 AM - 12:00 PM" both work. Nothing is guessed: unknown names and
 * unreadable times are reported per line.
 */

export type ImportedShift = { day: Day; start: Minutes; end: Minutes };

export type ShiftImportRow = {
  /** 1-based line number in what was pasted, so a problem can be pointed at. */
  line: number;
  name: string;
  /** Set when the name matched exactly one student already in ShiftFit. */
  studentId: string | null;
  shifts: ImportedShift[];
  errors: string[];
  warnings: string[];
  ok: boolean;
};

export type ShiftImportParse = {
  rows: ShiftImportRow[];
  valid: ShiftImportRow[];
  /** Total number of shifts (a "MWF" line counts as 3) across the valid rows. */
  shiftCount: number;
};

const MAX_LINES = 500;

/** Same separator rule as the roster paste: the first colon that is NOT inside a time like 9:00. */
function splitLine(raw: string): { name: string; times: string } | null {
  if (raw.includes("\t")) {
    const [first, ...rest] = raw.split("\t");
    return { name: first.trim(), times: rest.map((c) => c.trim()).filter(Boolean).join("; ") };
  }
  const colon = raw.search(/(?<!\d):|:(?!\d)/);
  if (colon === -1) return null;
  return { name: raw.slice(0, colon).trim(), times: raw.slice(colon + 1).trim() };
}

export function parseShiftText(text: string, students: Student[], slotMinutes: number): ShiftImportParse {
  const rows: ShiftImportRow[] = [];
  const lines = text.split(/\r?\n/);

  lines.slice(0, MAX_LINES).forEach((raw, i) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const line = i + 1;
    const errors: string[] = [];
    const warnings: string[] = [];
    const shifts: ImportedShift[] = [];

    const split = splitLine(raw);
    if (!split) {
      rows.push({
        line,
        name: trimmed.slice(0, 40),
        studentId: null,
        shifts,
        errors: ["Put the name first, then a colon, then the shift times. Example: Noa K.: MWF 9:00am-1:00pm"],
        warnings,
        ok: false,
      });
      return;
    }

    const wanted = split.name.toLowerCase();
    const matches = students.filter((s) => s.name.trim().toLowerCase() === wanted);
    if (!split.name) errors.push("There is no name at the start of this line.");
    else if (matches.length === 0) errors.push(`No student named "${split.name}" is in ShiftFit yet. Add them first.`);
    else if (matches.length > 1) errors.push(`More than one student is named "${split.name}", so ShiftFit can't tell which one you mean.`);

    const pieces = split.times.split(/;/).map((p) => p.trim()).filter(Boolean);
    if (!pieces.length) errors.push("No shift times were found on this line.");
    for (const piece of pieces) {
      const parsed = parseMeetingLine(piece);
      if (!parsed.ok || !parsed.days || parsed.start == null || parsed.end == null) {
        errors.push(`"${piece}" — ${parsed.warning ?? "could not be read"}`);
        continue;
      }
      if (parsed.start % slotMinutes !== 0 || parsed.end % slotMinutes !== 0) {
        errors.push(`"${piece}" — shifts must start and end on the half hour.`);
        continue;
      }
      if (parsed.warning) warnings.push(`"${piece}" — ${parsed.warning}`);
      for (const day of parsed.days) {
        if (!shifts.some((s) => s.day === day && s.start === parsed.start && s.end === parsed.end)) {
          shifts.push({ day, start: parsed.start, end: parsed.end });
        }
      }
    }

    rows.push({
      line,
      name: split.name,
      studentId: matches.length === 1 ? matches[0].id : null,
      shifts,
      errors,
      warnings,
      ok: errors.length === 0,
    });
  });

  const valid = rows.filter((r) => r.ok);
  return { rows, valid, shiftCount: valid.reduce((n, r) => n + r.shifts.length, 0) };
}
