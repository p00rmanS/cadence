import { NO_CUTOFF, DEFAULT_SETTINGS } from "../scheduling/constants";
import { mergeContiguousBlocks } from "../scheduling/blocks";
import { buildBusy } from "../scheduling/parser";
import { DAYS } from "../scheduling/types";
import { validatePersistedState } from "../scheduling/validation";
import type { NewStudentInput } from "../../hooks/useShiftFitStore";
import type { Day, ScheduleSettings, SemesterConfig, ShiftBlock, Student } from "../scheduling/types";

/**
 * ============================================================================
 *  SHARING WITHOUT A SERVER: STUDENT LINKS AND SHIFT LINKS
 * ============================================================================
 * Syncro keeps no database and stores nothing about students on a server. Yet managers and students need
 * to pass information both ways. So the information travels INSIDE a web link, after the "#" sign. The
 * part of a web address after "#" is never sent to any server, so a link like
 *   https://.../cadence/#/add/eyJrIjoiaW50YWtlIi...
 * is read only by the browser of whoever opens it. Two kinds of link:
 *   - a STUDENT LINK ("intake"): a student fills in their classes and preferences on their own page and
 *     sends the link to their manager, who reviews it and adds the student (no retyping, no photos);
 *   - a SHIFT LINK ("shifts"): a manager gives a student a link that opens a clean "Your shifts" page with
 *     Add-to-calendar and Print.
 * A link is just the details written as JSON and then in a URL-safe text form (base64url). Anyone with the
 * link can read it, so people are told to send it only to the right person.
 *
 * SAFETY: a link comes from outside, so it is treated like a tampered file. Nothing in it is trusted:
 * its size is capped, and what it says goes through the same strict checker as a backup file
 * (`validatePersistedState`), which drops anything unknown and refuses anything silly. Text from a link is
 * only ever shown as plain text, never as web page code.
 */

/** Longest link text accepted (about 20,000 characters). A real link is a few hundred to a couple thousand. */
export const MAX_CODE_LENGTH = 20_000;

/** The most shifts one shift link may carry (a student has a few shifts a day at most). */
const MAX_SHARED_SHIFTS = 100;

/** The format number written into every link, so a future change can still read old links. */
const LINK_VERSION = 1;

// ---------------------------------------------------------------------------------------------
// Turning details into link text and back
// ---------------------------------------------------------------------------------------------

/** Writes text in a form that is safe inside a web address (letters, digits, "-" and "_"). Works for any language. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Reads text written by `toBase64Url`; null for anything that is not valid. */
function fromBase64Url(code: string): string | null {
  try {
    const standard = code.replace(/-/g, "+").replace(/_/g, "/");
    const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Turns a link's text into the object inside it, or null when it is too long, not valid text, or not an object of the right kind. */
function openCode(code: string, kind: "intake" | "shifts"): Record<string, unknown> | null {
  if (code.length === 0 || code.length > MAX_CODE_LENGTH) return null;
  const text = fromBase64Url(code);
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    return record.kind === kind && record.v === LINK_VERSION ? record : null;
  } catch {
    return null;
  }
}

/**
 * Finds the link text in whatever was pasted: a whole link ("https://.../#/add/XYZ"), just the part after
 * the "#", or the bare text. Spaces and line breaks (an email may wrap a long link) are ignored.
 */
export function codeFromText(pasted: string): string {
  const squeezed = pasted.replace(/\s+/g, "");
  const afterHash = /#\/(?:add|shifts)\/([A-Za-z0-9_-]+)/.exec(squeezed);
  if (afterHash) return afterHash[1];
  // A bare code may have been wrapped onto several lines by an email, but it never has a SPACE inside it. So
  // ordinary words ("just some words") are not mistaken for a code just because their spaces would be squeezed out.
  const trimmed = pasted.trim();
  const bare = /^[A-Za-z0-9_\-\r\n]+$/.test(trimmed) ? /^[A-Za-z0-9_-]+$/.exec(squeezed) : null;
  return bare ? bare[0] : "";
}

// ---------------------------------------------------------------------------------------------
// Student links: a student sends their classes and preferences to their manager
// ---------------------------------------------------------------------------------------------

/** Makes the link text for a student's own details (their name, class times and work preferences; never a photo). */
export function buildIntakeCode(input: NewStudentInput): string {
  return toBase64Url(
    JSON.stringify({
      kind: "intake",
      v: LINK_VERSION,
      name: input.name,
      classText: input.classText,
      blockedText: input.blockedText,
      preference: input.preference,
      daysPerWeek: input.daysPerWeek,
      latestEnd: input.latestEnd,
      breaks: input.breaks,
      needsOpeningShift: input.needsOpeningShift,
      ...(input.workDays && input.workDays.length > 0 ? { workDays: input.workDays } : {}),
      ...(input.weeklyHours !== undefined ? { weeklyHours: input.weeklyHours } : {}),
      ...(input.earliestStart ? { earliestStart: input.earliestStart } : {}),
    }),
  );
}

export type IntakeResult = { ok: true; student: Student; input: NewStudentInput } | { ok: false; error: string };

/** The plain-language answer for a link that cannot be used. It says nothing about why, since that could be someone probing. */
const BAD_LINK = "That link doesn't look right. Ask the student to send it again, and paste the whole link.";

/**
 * Opens a student link and checks it. On success returns the student's details ready for the add-student
 * form (as a `Student` to prefill it, and as `NewStudentInput`). The details go through the strict checker
 * for saved data, so silly numbers, unknown days, control characters and oversized text are refused or cleaned.
 */
export function parseIntakeCode(code: string): IntakeResult {
  const p = openCode(code, "intake");
  if (!p) return { ok: false, error: BAD_LINK };
  const classText = typeof p.classText === "string" ? p.classText : "";
  const blockedText = typeof p.blockedText === "string" ? p.blockedText : "";
  const candidate = {
    id: "from-link",
    name: p.name,
    color: "#1F6FB2",
    preference: p.preference,
    daysPerWeek: p.daysPerWeek ?? 5,
    classText,
    blockedText,
    busy: buildBusy(classText, blockedText).busy,
    latestEnd: p.latestEnd ?? NO_CUTOFF,
    breaks: p.breaks ?? [],
    needsOpeningShift: p.needsOpeningShift === true,
    workDays: p.workDays,
    weeklyHours: p.weeklyHours,
    earliestStart: p.earliestStart,
  };
  const checked = validatePersistedState({ version: 1, settings: DEFAULT_SETTINGS, students: [candidate], assignments: [], semester: null, selectedStudentId: null });
  if (!checked.ok || checked.value.students.length !== 1) return { ok: false, error: BAD_LINK };
  const student = checked.value.students[0];
  return {
    ok: true,
    student,
    input: {
      name: student.name,
      preference: student.preference,
      daysPerWeek: student.daysPerWeek,
      classText: student.classText,
      blockedText: student.blockedText,
      latestEnd: student.latestEnd,
      breaks: student.breaks,
      needsOpeningShift: student.needsOpeningShift,
      workDays: student.workDays,
      weeklyHours: student.weeklyHours,
      earliestStart: student.earliestStart,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Shift links: a manager gives a student their own shifts
// ---------------------------------------------------------------------------------------------

/** One shift in a shift link: a day and when it starts and ends (minutes after midnight). */
export type SharedShift = { day: Day; start: number; end: number };

/** What a shift link carries: the student's first name, their weekly shifts, and (if saved) the semester dates for the calendar file. */
export type SharedShifts = {
  name: string;
  term: "semester" | "break";
  shifts: SharedShift[];
  semester: SemesterConfig | null;
};

/** Makes the link text for one student's shifts. Only that student's shifts and name go in; nobody else's information. */
export function buildShiftsCode(
  student: Pick<Student, "id" | "name">,
  assignments: ShiftBlock[],
  settings: ScheduleSettings,
  semester: SemesterConfig | null,
): string {
  const shifts = mergeContiguousBlocks(
    assignments.filter((a) => a.studentId === student.id),
    settings.slotMinutes,
  ).map((block) => ({ day: block.day, start: block.start, end: block.end }));
  return toBase64Url(
    JSON.stringify({ kind: "shifts", v: LINK_VERSION, name: student.name, term: settings.term === "break" ? "break" : "semester", shifts, semester }),
  );
}

export type ShiftsResult = { ok: true; shared: SharedShifts } | { ok: false; error: string };

/** The plain-language answer for a shift link that cannot be used. */
const BAD_SHIFT_LINK = "This link doesn't look right. Ask your manager to send it again, and open the whole link.";

/** Opens a shift link and checks it (known days, sensible times, a handful of shifts, valid semester dates). */
export function parseShiftsCode(code: string): ShiftsResult {
  const p = openCode(code, "shifts");
  if (!p || typeof p.name !== "string" || !Array.isArray(p.shifts) || p.shifts.length > MAX_SHARED_SHIFTS) return { ok: false, error: BAD_SHIFT_LINK };
  const shifts: SharedShift[] = [];
  for (const item of p.shifts) {
    const s = item as Record<string, unknown> | null;
    if (!s || typeof s !== "object") return { ok: false, error: BAD_SHIFT_LINK };
    const { day, start, end } = s;
    const validDay = typeof day === "string" && (DAYS as string[]).includes(day);
    const validTimes = Number.isInteger(start) && Number.isInteger(end) && (start as number) >= 0 && (end as number) <= 24 * 60 && (start as number) < (end as number);
    if (!validDay || !validTimes) return { ok: false, error: BAD_SHIFT_LINK };
    shifts.push({ day: day as Day, start: start as number, end: end as number });
  }
  // The name and the semester dates go through the same checker as a saved schedule (cleans hidden characters, checks the timezone).
  const checked = validatePersistedState({
    version: 1,
    settings: DEFAULT_SETTINGS,
    students: [{ id: "x", name: p.name, color: "#1F6FB2", preference: "any", daysPerWeek: 5, classText: "", blockedText: "", busy: [], latestEnd: NO_CUTOFF, breaks: [], needsOpeningShift: false }],
    assignments: [],
    semester: p.semester ?? null,
    selectedStudentId: null,
  });
  if (!checked.ok) return { ok: false, error: BAD_SHIFT_LINK };
  return { ok: true, shared: { name: checked.value.students[0].name, term: p.term === "break" ? "break" : "semester", shifts, semester: checked.value.semester ?? null } };
}

/** Total hours in a list of shifts. */
export function hoursOfShifts(shifts: SharedShift[]): number {
  return shifts.reduce((sum, shift) => sum + (shift.end - shift.start) / 60, 0);
}

// ---------------------------------------------------------------------------------------------
// The links themselves
// ---------------------------------------------------------------------------------------------

/** Where the site lives, without the "#" part, e.g. "https://p00rmans.github.io/cadence/". */
function siteAddress(location: Pick<Location, "origin"> = window.location): string {
  return `${location.origin}${import.meta.env.BASE_URL}`;
}

/** The link a manager gives to students so they can send their details ("Send your details" page). */
export function studentPageLink(location?: Pick<Location, "origin">): string {
  return `${siteAddress(location)}#/send`;
}

/** The link a student sends their manager, carrying the student's details. */
export function studentLink(code: string, location?: Pick<Location, "origin">): string {
  return `${siteAddress(location)}#/add/${code}`;
}

/** The link a manager gives a student, carrying that student's shifts. */
export function shiftsLink(code: string, location?: Pick<Location, "origin">): string {
  return `${siteAddress(location)}#/shifts/${code}`;
}
