import { buildBusy } from "./parser";
import { NO_CUTOFF, STUDENT_COLORS } from "./constants";
import { DAYS } from "./types";
import type { Day, ShiftBlock, Student } from "./types";

/**
 * ============================================================================
 *  SAMPLE DATA FOR THE WELCOME/DEMO STATE
 * ============================================================================
 * Six made-up students with made-up class schedules, used to show a new
 * manager what a filled-in ShiftFit looks like before they've added anyone
 * real. This is the ONLY file with fake names in it — nothing here is a real
 * BYU–Hawaii student (see the README's Privacy section).
 */

/**
 * Fake sample roster, ported from the original single-file prototype so the
 * demo experience stays familiar. No real student data — see README Privacy.
 */
function makeStudent(
  id: string,
  name: string,
  preference: Student["preference"],
  daysPerWeek: number,
  classText: string,
  opts: Partial<Pick<Student, "latestEnd" | "lunchStart" | "needsOpeningShift" | "blockedText">> = {},
): Student {
  return {
    id,
    name,
    color: STUDENT_COLORS[Number(id.replace(/\D/g, "")) % STUDENT_COLORS.length],
    preference,
    daysPerWeek,
    classText,
    blockedText: opts.blockedText ?? "",
    busy: buildBusy(classText, opts.blockedText ?? "").busy,
    latestEnd: opts.latestEnd ?? NO_CUTOFF,
    lunchStart: opts.lunchStart ?? null,
    needsOpeningShift: opts.needsOpeningShift ?? false,
  };
}

function range(studentId: string, day: Day, start: number, end: number): ShiftBlock[] {
  const out: ShiftBlock[] = [];
  for (let m = start; m < end; m += 30) {
    out.push({ id: `demo-${studentId}-${day}-${m}`, studentId, day, start: m, source: "manual" });
  }
  return out;
}

export function buildDemoData(): { students: Student[]; assignments: ShiftBlock[] } {
  const troy = makeStudent(
    "s1",
    "Troy C.",
    "morning",
    3,
    "Tuesday/Thursday | 8:00 AM - 9:15 AM | SCB 211\nTuesday/Thursday | 10:00 AM - 10:50 AM | STC 190\nTuesday/Thursday | 1:00 PM - 1:50 PM | STC 190\nTuesday/Thursday | 3:00 PM - 3:50 PM | STC 190",
    { latestEnd: 16 * 60, lunchStart: 12 * 60, needsOpeningShift: true },
  );
  // Leilani also has a second job on Wednesday afternoons, to show "other times they can't work".
  const leilani = makeStudent("s2", "Leilani P.", "morning", 5, "MWF 10:00-10:50\nTTh 1:00pm-2:15pm", { blockedText: "W 2:00pm-4:00pm" });
  const kekoa = makeStudent("s3", "Kekoa M.", "afternoon", 4, "MWF 8:00-9:50\nTTh 9:00-10:15");
  const mele = makeStudent("s4", "Mele T.", "any", 5, "MW 1:00pm-2:15pm\nTTh 10:30-11:45");
  const tanvi = makeStudent("s5", "Tanvi R.", "morning", 3, "TTh 8:00-9:15\nTTh 1:00pm-3:40pm");
  const josefa = makeStudent("s6", "Josefa L.", "afternoon", 4, "MWF 11:00-11:50\nTh 8:00-9:15");

  const assignments: ShiftBlock[] = [
    ...range("s1", "mon", 8 * 60, 12 * 60),
    ...range("s1", "mon", 12 * 60 + 30, 15 * 60),
    ...range("s1", "wed", 8 * 60, 12 * 60),
    ...range("s1", "wed", 12 * 60 + 30, 15 * 60),
    ...range("s1", "fri", 7 * 60, 12 * 60),
    ...range("s1", "fri", 12 * 60 + 30, 13 * 60 + 30),
  ];

  return { students: [troy, leilani, kekoa, mele, tanvi, josefa], assignments };
}

export const DAY_ORDER = DAYS;
