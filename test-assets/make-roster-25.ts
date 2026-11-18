/**
 * Builds a sample Syncro backup file with 25 made-up students (names are invented, none are real people),
 * each with their own class schedule, all working 19 hours a week, then places their shifts (see "The planner" below). Run it with (from the shiftfit folder):
 *   npx esbuild test-assets/make-roster-25.ts --bundle --platform=node --format=esm --outfile=test-assets/.make-roster-25.mjs && node test-assets/.make-roster-25.mjs
 * It writes test-assets/sample-roster-25.json, which you load in the app with Save & share -> Load a backup.
 */
import { writeFileSync } from "node:fs";
import { DEFAULT_SETTINGS, NO_CUTOFF, STUDENT_COLORS } from "../src/features/scheduling/constants";
import { buildBusy } from "../src/features/scheduling/parser";
import { blockedBySlot, shiftRuns } from "../src/features/scheduling/availability";
import { validatePersistedState } from "../src/features/scheduling/validation";
import { DAYS } from "../src/features/scheduling/types";
import { findIssues } from "../src/features/scheduling/issues";
import type { ScheduleSettings, ShiftBlock, Student } from "../src/features/scheduling/types";

/** [name, class times]. Every student's classes are different, so everyone's free hours are different. */
const PEOPLE: [string, string][] = [
  ["Kalani M.", "MWF 8:00am-8:50am\nTTh 1:00pm-2:15pm"],
  ["Leilani P.", "MWF 10:00am-10:50am\nTTh 9:00am-10:15am"],
  ["Makana K.", "MW 9:00am-10:15am\nMW 12:30pm-1:45pm\nF 8:00am-9:50am"],
  ["Noelani W.", "TTh 8:00am-9:15am\nTTh 11:00am-12:15pm"],
  ["Keoni A.", "MWF 12:00pm-12:50pm\nTTh 3:00pm-4:15pm"],
  ["Malia S.", "MWF 9:00am-9:50am\nMWF 1:00pm-1:50pm"],
  ["Sione F.", "MW 8:00am-9:50am\nTTh 2:00pm-3:50pm"],
  ["Tevita L.", "MWF 11:00am-11:50am\nTh 8:00am-10:50am"],
  ["Aroha T.", "MWF 2:00pm-2:50pm\nTTh 10:00am-11:15am"],
  ["Hemi R.", "MW 3:00pm-4:15pm\nTTh 8:00am-8:50am\nF 9:00am-11:50am"],
  ["Mele N.", "MWF 8:00am-9:50am\nTTh 12:00pm-1:15pm"],
  ["Yuki T.", "TTh 9:00am-10:15am\nTTh 1:00pm-2:15pm\nMW 4:00pm-4:50pm"],
  ["Minh N.", "MWF 10:00am-10:50am\nMWF 2:00pm-2:50pm"],
  ["Tiare B.", "MW 1:00pm-2:15pm\nTTh 11:00am-12:15pm"],
  ["Pita V.", "MWF 9:00am-9:50am\nTTh 3:30pm-4:45pm"],
  ["Ana L.", "TTh 8:00am-9:50am\nMW 12:00pm-1:15pm"],
  ["Kimo H.", "MW 8:00am-9:15am\nMW 11:00am-12:15pm\nTh 1:00pm-3:50pm"],
  ["Priya S.", "MWF 1:00pm-1:50pm\nTTh 9:30am-10:45am"],
  ["Joaquin R.", "MWF 11:00am-11:50am\nTTh 2:00pm-3:15pm"],
  ["Sofia C.", "TTh 10:00am-11:15am\nTTh 3:00pm-4:15pm\nW 9:00am-11:50am"],
  ["Waleed A.", "MW 2:00pm-3:15pm\nTTh 8:00am-9:15am\nF 12:00pm-1:50pm"],
  ["Lopini T.", "MWF 8:00am-8:50am\nMWF 12:00pm-12:50pm"],
  ["Jin W.", "TTh 12:30pm-1:45pm\nMWF 10:30am-11:20am"],
  ["Hina K.", "MW 10:00am-11:15am\nTTh 9:00am-9:50am\nF 3:00pm-4:50pm"],
  ["Eli B.", "MWF 1:30pm-2:20pm\nTTh 8:30am-9:45am\nSat 9:00am-11:50am"],
];

const students: Student[] = PEOPLE.map(([name, classText], i) => ({
  id: `r${i + 1}`,
  name,
  color: STUDENT_COLORS[i % STUDENT_COLORS.length],
  preference: "any",
  daysPerWeek: 5,
  classText,
  blockedText: "",
  busy: buildBusy(classText, "").busy,
  latestEnd: NO_CUTOFF,
  breaks: [],
  needsOpeningShift: false,
}));

// ---------------------------------------------------------------------------------------------
// The planner. Syncro's own "Fill schedule for me" joins neighbouring shifts into 4.5 or 5 hour
// runs, so this file places the shifts itself, following three rules:
//   1. Every student works exactly 19 hours: four 4-hour shifts and one 3-hour shift (19 is not a
//      multiple of 4, so one shift has to be shorter), on 5 different days.
//   2. A 4-hour shift is either one block of 4 hours, or two blocks of 2 hours on the same day with
//      a gap between them (a class in the middle), so classes never get in the way.
//   3. Shifts go where fewest people are already working, so the office always has a team on.
// ---------------------------------------------------------------------------------------------
const SLOT = 30;
const OPEN_DAYS = DAYS; // Monday to Saturday
const slotsOfDay: number[] = [];
for (let m = DEFAULT_SETTINGS.openTime; m < DEFAULT_SETTINGS.closeTime; m += SLOT) slotsOfDay.push(m);
const settings: ScheduleSettings = { ...DEFAULT_SETTINGS, minStaffPerSlot: Number(process.argv[2] ?? 4) };

/** How many people are working each half-hour box so far ("mon|420" -> 3). */
const crowd = new Map<string, number>();
const cell = (day: string, start: number) => `${day}|${start}`;
/** True when this student could work this box (no class, not devotional, not past a cutoff...). */
const free = (s: Student, day: (typeof DAYS)[number], start: number) => blockedBySlot(s, day, start, settings) === null;
/** The student's chosen boxes, as student id -> list of "day|start". */
const chosen = new Map<string, { day: (typeof DAYS)[number]; start: number }[]>();

/** One possible day-shift: a list of box starts (all on one day) plus how good it is (lower is better). */
type Option = { day: (typeof DAYS)[number]; starts: number[]; score: number; split: boolean };

/** All the ways `student` could work `hours` hours on `day`: one block, or (for 4 hours) two 2-hour blocks with a gap. */
function options(student: Student, day: (typeof DAYS)[number], hours: number): Option[] {
  const out: Option[] = [];
  const n = (hours * 60) / SLOT;
  const cost = (starts: number[]) => starts.reduce((sum, st) => sum + (crowd.get(cell(day, st)) ?? 0), 0);
  for (let i = 0; i + n <= slotsOfDay.length; i++) {
    const starts = slotsOfDay.slice(i, i + n);
    if (starts.every((st) => free(student, day, st))) out.push({ day, starts, score: cost(starts), split: false });
  }
  if (hours === 4) {
    const half = n / 2;
    for (let i = 0; i + half <= slotsOfDay.length; i++) {
      for (let j = i + half + 2; j + half <= slotsOfDay.length; j++) {
        const starts = [...slotsOfDay.slice(i, i + half), ...slotsOfDay.slice(j, j + half)];
        // The gap between the blocks is at least 1 hour (j starts 2 boxes after the first block ends), so they never touch.
        if (!starts.every((st) => free(student, day, st))) continue;
        const gapStart = slotsOfDay[i + half];
        const gapEnd = slotsOfDay[j];
        const classInGap = student.busy.some((b) => b.day === day && b.start < gapEnd && b.end > gapStart);
        out.push({ day, starts, score: cost(starts) + (classInGap ? SPLIT_WITH_CLASS : SPLIT_NO_CLASS), split: true });
      }
    }
  }
  return out;
}
/**
 * Scoring for a split shift (lower wins; one block of 4 hours scores its crowd count). A split with a real
 * class in the gap is the realistic case ("work 2 hours, go to class, come back"), so it only has a tiny
 * penalty and wins when it fits the class times better. The value 1 gives about 7 students of 25 a split
 * day; lower numbers give far more (0 gives about 12, -1 about 22). A split with nothing in the gap is
 * punished heavily so it is never chosen without a reason. Only one split day per student is allowed.
 */
const SPLIT_WITH_CLASS = 1;
const SPLIT_NO_CLASS = 12;

/** Places one student's five shifts where the fewest people are working, and records them. */
function placeStudent(student: Student): void {
  const days = new Set<string>();
  const picked: Option[] = [];
  let splitUsed = false;
  // Four 4-hour shifts first, then the 3-hour one.
  for (const hours of [4, 4, 4, 4, 3]) {
    let best: Option | null = null;
    for (const day of OPEN_DAYS) {
      if (days.has(day)) continue;
      for (const o of options(student, day, hours)) {
        if (o.split && splitUsed) continue;
        if (best === null || o.score < best.score) best = o;
      }
    }
    if (!best) throw new Error(`Could not place a ${hours}-hour shift for ${student.name}`);
    days.add(best.day);
    splitUsed = splitUsed || best.split;
    picked.push(best);
    for (const st of best.starts) crowd.set(cell(best.day, st), (crowd.get(cell(best.day, st)) ?? 0) + 1);
  }
  chosen.set(student.id, picked.flatMap((o) => o.starts.map((start) => ({ day: o.day, start }))));
}

/** Takes a student's shifts back out of the crowd counts so they can be placed again. */
function removeStudent(student: Student): void {
  for (const c of chosen.get(student.id) ?? []) crowd.set(cell(c.day, c.start), (crowd.get(cell(c.day, c.start)) ?? 1) - 1);
  chosen.delete(student.id);
}

// First everyone is placed once; then each student is lifted out and placed again a few times, which
// evens out the busy and quiet hours (the first students placed saw an empty week).
for (const student of students) placeStudent(student);
for (let round = 0; round < 6; round++) {
  for (const student of students) {
    removeStudent(student);
    placeStudent(student);
  }
}

const assignments: ShiftBlock[] = students.flatMap((s) =>
  (chosen.get(s.id) ?? []).map((c) => ({ id: `r-${s.id}-${c.day}-${c.start}`, studentId: s.id, day: c.day, start: c.start, source: "manual" as const })),
);
const result = { assignments, unmet: [] as unknown[] };

// ---- Report: does it match what was asked? ----
const runLengths = new Map<number, number>();
const perStudent: string[] = [];
for (const s of students) {
  const hours = result.assignments.filter((a) => a.studentId === s.id).length / 2;
  const runs = DAYS.flatMap((d) => shiftRuns(s.id, d, result.assignments, settings).map((r) => (r.end - r.start) / 60));
  for (const h of runs) runLengths.set(h, (runLengths.get(h) ?? 0) + 1);
  perStudent.push(`${s.name.padEnd(12)} ${hours}h  shifts: ${runs.join("+")}`);
}
const concurrent = new Map<string, number>();
for (const a of result.assignments) concurrent.set(`${a.day}|${a.start}`, (concurrent.get(`${a.day}|${a.start}`) ?? 0) + 1);
const hist = new Map<number, number>();
for (const n of concurrent.values()) hist.set(n, (hist.get(n) ?? 0) + 1);
console.log(perStudent.join("\n"));
console.log("shift lengths (hours -> count):", [...runLengths].sort((a, b) => a[0] - b[0]).map(([h, c]) => `${h}h x${c}`).join(", "));
console.log("people working at once (people -> half-hour boxes):", [...hist].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}: ${c}`).join(", "));
console.log("rule problems found by Syncro:", findIssues(students, assignments, settings).length);

const backup = { version: 1, settings, students, assignments: result.assignments, otherTermAssignments: [], selectedStudentId: students[0].id, semester: null };
const checked = validatePersistedState(JSON.parse(JSON.stringify(backup)));
console.log("valid backup:", checked.ok);
if (checked.ok) writeFileSync("test-assets/sample-roster-25.json", JSON.stringify(backup, null, 2));
