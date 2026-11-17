import { buildBusy } from "./parser";
import { NO_CUTOFF, STUDENT_COLORS } from "./constants";
import { DAYS } from "./types";
import type { Day, ShiftBlock, Student } from "./types";

/**
 * ============================================================================
 *  SAMPLE DATA FOR THE WELCOME/DEMO STATE
 * ============================================================================
 * Twenty-five made-up students, each with their own class schedule, used to show a new manager what a
 * filled-in Syncro looks like (and how a busy hour with many people looks) before they've added anyone
 * real. This is the ONLY file with fake names in it: nothing here is a real BYU-Hawaii student (see
 * the README's Privacy section).
 *
 * The sample is built to look like a real office week:
 *  - everyone works exactly 19 hours, over 5 different days;
 *  - shifts are 4 hours (each student also has one 3-hour shift, since 19 is not a multiple of 4);
 *  - a few students work 2 hours, go to class, and come back for 2 more on the same day;
 *  - 4 to 6 people are working at any time.
 * `test-assets/make-roster-25.ts` is the script that created the shifts below; re-run it to change them.
 */

/** Every sample student: [id, name, class times]. Nobody shares the same class schedule. */
const PEOPLE: [string, string, string][] = [
  ["s1", "Kalani M.", "MWF 8:00am-8:50am\nTTh 1:00pm-2:15pm"],
  ["s2", "Leilani P.", "MWF 10:00am-10:50am\nTTh 9:00am-10:15am"],
  ["s3", "Makana K.", "MW 9:00am-10:15am\nMW 12:30pm-1:45pm\nF 8:00am-9:50am"],
  ["s4", "Noelani W.", "TTh 8:00am-9:15am\nTTh 11:00am-12:15pm"],
  ["s5", "Keoni A.", "MWF 12:00pm-12:50pm\nTTh 3:00pm-4:15pm"],
  ["s6", "Malia S.", "MWF 9:00am-9:50am\nMWF 1:00pm-1:50pm"],
  ["s7", "Sione F.", "MW 8:00am-9:50am\nTTh 2:00pm-3:50pm"],
  ["s8", "Tevita L.", "MWF 11:00am-11:50am\nTh 8:00am-10:50am"],
  ["s9", "Aroha T.", "MWF 2:00pm-2:50pm\nTTh 10:00am-11:15am"],
  ["s10", "Hemi R.", "MW 3:00pm-4:15pm\nTTh 8:00am-8:50am\nF 9:00am-11:50am"],
  ["s11", "Mele N.", "MWF 8:00am-9:50am\nTTh 12:00pm-1:15pm"],
  ["s12", "Yuki T.", "TTh 9:00am-10:15am\nTTh 1:00pm-2:15pm\nMW 4:00pm-4:50pm"],
  ["s13", "Minh N.", "MWF 10:00am-10:50am\nMWF 2:00pm-2:50pm"],
  ["s14", "Tiare B.", "MW 1:00pm-2:15pm\nTTh 11:00am-12:15pm"],
  ["s15", "Pita V.", "MWF 9:00am-9:50am\nTTh 3:30pm-4:45pm"],
  ["s16", "Ana L.", "TTh 8:00am-9:50am\nMW 12:00pm-1:15pm"],
  ["s17", "Kimo H.", "MW 8:00am-9:15am\nMW 11:00am-12:15pm\nTh 1:00pm-3:50pm"],
  ["s18", "Priya S.", "MWF 1:00pm-1:50pm\nTTh 9:30am-10:45am"],
  ["s19", "Joaquin R.", "MWF 11:00am-11:50am\nTTh 2:00pm-3:15pm"],
  ["s20", "Sofia C.", "TTh 10:00am-11:15am\nTTh 3:00pm-4:15pm\nW 9:00am-11:50am"],
  ["s21", "Waleed A.", "MW 2:00pm-3:15pm\nTTh 8:00am-9:15am\nF 12:00pm-1:50pm"],
  ["s22", "Lopini T.", "MWF 8:00am-8:50am\nMWF 12:00pm-12:50pm"],
  ["s23", "Jin W.", "TTh 12:30pm-1:45pm\nMWF 10:30am-11:20am"],
  ["s24", "Hina K.", "MW 10:00am-11:15am\nTTh 9:00am-9:50am\nF 3:00pm-4:50pm"],
  ["s25", "Eli B.", "MWF 1:30pm-2:20pm\nTTh 8:30am-9:45am\nSat 9:00am-11:50am"],
];

/** Every sample shift as [student id, day, start hour, end hour]. Hours use decimals for half hours (13.5 = 1:30pm). */
const SHIFTS: [string, Day, number, number][] = [
  ["s1", "mon", 9, 13],
  ["s1", "tue", 7, 11],
  ["s1", "wed", 9, 13],
  ["s1", "thu", 7, 11],
  ["s1", "fri", 9, 12],
  ["s2", "mon", 11, 15],
  ["s2", "tue", 12, 15],
  ["s2", "wed", 11, 15],
  ["s2", "thu", 11, 15],
  ["s2", "fri", 11, 15],
  ["s3", "mon", 16, 20],
  ["s3", "tue", 15, 19],
  ["s3", "wed", 16, 20],
  ["s3", "thu", 13.5, 17.5],
  ["s3", "fri", 11, 14],
  ["s4", "mon", 20, 24],
  ["s4", "tue", 20, 24],
  ["s4", "wed", 18, 22],
  ["s4", "fri", 16, 20],
  ["s4", "sat", 7, 10],
  ["s5", "tue", 20, 24],
  ["s5", "wed", 18, 22],
  ["s5", "thu", 19, 22],
  ["s5", "fri", 16, 20],
  ["s5", "sat", 10, 14],
  ["s6", "mon", 14, 18],
  ["s6", "tue", 7, 11],
  ["s6", "wed", 20, 24],
  ["s6", "fri", 21, 24],
  ["s6", "sat", 14, 18],
  ["s7", "mon", 16, 20],
  ["s7", "tue", 16, 20],
  ["s7", "wed", 10, 13],
  ["s7", "thu", 7, 11],
  ["s7", "sat", 18, 22],
  ["s8", "tue", 12, 15],
  ["s8", "wed", 13, 17],
  ["s8", "thu", 11, 15],
  ["s8", "fri", 12, 16],
  ["s8", "sat", 20, 24],
  ["s9", "mon", 8.5, 11.5],
  ["s9", "wed", 7, 9],
  ["s9", "wed", 22, 24],
  ["s9", "thu", 15, 19],
  ["s9", "fri", 7, 11],
  ["s9", "sat", 7, 11],
  ["s10", "mon", 20, 24],
  ["s10", "wed", 7, 11],
  ["s10", "thu", 15, 19],
  ["s10", "fri", 19, 22],
  ["s10", "sat", 11, 15],
  ["s11", "tue", 7, 11],
  ["s11", "wed", 13, 17],
  ["s11", "thu", 7.5, 9.5],
  ["s11", "thu", 22, 24],
  ["s11", "fri", 11, 14],
  ["s11", "sat", 15, 19],
  ["s12", "mon", 7, 11],
  ["s12", "tue", 14.5, 18.5],
  ["s12", "wed", 7, 10],
  ["s12", "fri", 7, 11],
  ["s12", "sat", 16, 20],
  ["s13", "mon", 17, 20],
  ["s13", "tue", 18.5, 22.5],
  ["s13", "wed", 15, 19],
  ["s13", "fri", 15, 19],
  ["s13", "sat", 20, 24],
  ["s14", "mon", 18, 22],
  ["s14", "wed", 17, 21],
  ["s14", "thu", 12.5, 15.5],
  ["s14", "fri", 14, 18],
  ["s14", "sat", 7, 11],
  ["s15", "mon", 11, 15],
  ["s15", "tue", 12, 14],
  ["s15", "tue", 22, 24],
  ["s15", "wed", 21, 24],
  ["s15", "thu", 17, 21],
  ["s15", "sat", 11, 15],
  ["s16", "mon", 20, 24],
  ["s16", "wed", 19, 23],
  ["s16", "thu", 10, 14],
  ["s16", "fri", 18, 21],
  ["s16", "sat", 12, 16],
  ["s17", "mon", 12.5, 16.5],
  ["s17", "tue", 7, 10],
  ["s17", "thu", 7, 9],
  ["s17", "thu", 22, 24],
  ["s17", "fri", 7, 11],
  ["s17", "sat", 16, 20],
  ["s18", "mon", 7, 9],
  ["s18", "mon", 22, 24],
  ["s18", "tue", 12, 15],
  ["s18", "thu", 17.5, 21.5],
  ["s18", "fri", 20, 24],
  ["s18", "sat", 20, 24],
  ["s19", "mon", 15, 19],
  ["s19", "tue", 20, 24],
  ["s19", "wed", 7, 10],
  ["s19", "thu", 7, 11],
  ["s19", "fri", 12, 16],
  ["s20", "tue", 16.5, 20.5],
  ["s20", "wed", 12, 16],
  ["s20", "thu", 18, 22],
  ["s20", "fri", 14, 17],
  ["s20", "sat", 7, 11],
  ["s21", "mon", 7, 11],
  ["s21", "wed", 10, 12],
  ["s21", "wed", 16, 18],
  ["s21", "thu", 9.5, 13.5],
  ["s21", "fri", 17, 20],
  ["s21", "sat", 8, 12],
  ["s22", "mon", 19, 23],
  ["s22", "tue", 7, 11],
  ["s22", "wed", 9, 12],
  ["s22", "thu", 20, 24],
  ["s22", "fri", 20, 24],
  ["s23", "mon", 11.5, 14.5],
  ["s23", "tue", 14, 18],
  ["s23", "wed", 7, 9],
  ["s23", "wed", 22, 24],
  ["s23", "thu", 14, 18],
  ["s23", "sat", 12, 16],
  ["s24", "mon", 12, 16],
  ["s24", "tue", 18, 22],
  ["s24", "wed", 12, 15],
  ["s24", "fri", 20, 24],
  ["s24", "sat", 16, 20],
  ["s25", "mon", 7, 11],
  ["s25", "tue", 13, 16],
  ["s25", "thu", 20, 24],
  ["s25", "fri", 7, 11],
  ["s25", "sat", 20, 24],
];

/** One sample student: everyone works any day, any time, has no breaks and no cutoff, and wants 5 days a week. */
function makeStudent(id: string, name: string, classText: string): Student {
  return {
    id,
    name,
    color: STUDENT_COLORS[Number(id.replace(/\D/g, "")) % STUDENT_COLORS.length],
    preference: "any",
    daysPerWeek: 5,
    classText,
    blockedText: "",
    busy: buildBusy(classText, "").busy,
    latestEnd: NO_CUTOFF,
    breaks: [],
    needsOpeningShift: false,
  };
}

/** One sample shift from `startHour` to `endHour`, cut into the half-hour pieces the app stores. */
function range(studentId: string, day: Day, startHour: number, endHour: number): ShiftBlock[] {
  const out: ShiftBlock[] = [];
  for (let m = startHour * 60; m < endHour * 60; m += 30) {
    out.push({ id: `demo-${studentId}-${day}-${m}`, studentId, day, start: m, source: "manual" });
  }
  return out;
}

/** The made-up sample roster and shifts shown the first time the app opens (no real students). */
export function buildDemoData(): { students: Student[]; assignments: ShiftBlock[] } {
  return {
    students: PEOPLE.map(([id, name, classText]) => makeStudent(id, name, classText)),
    assignments: SHIFTS.flatMap(([id, day, from, to]) => range(id, day, from, to)),
  };
}

export const DAY_ORDER = DAYS;
