import { describe, expect, it } from "vitest";
import { buildStudentIcs, countWeeklyOccurrences, icsFileName, isSemesterConfigured } from "../features/calendar/ics";
import { mergeContiguousBlocks, scheduleVersion, shiftsToCsv } from "../features/scheduling/blocks";
import { makeStudent, run, slot } from "./testkit";
import type { SemesterConfig } from "../features/scheduling/types";

// 2026-08-24 is a Monday; 2026-12-11 is a Friday.
const semester: SemesterConfig = { startDate: "2026-08-24", endDate: "2026-12-11", timeZone: "Pacific/Honolulu" };
const NOW = new Date("2026-08-01T12:00:00Z");

function lines(ics: string): string[] {
  return ics.split("\r\n");
}

describe("calendar file (.ics)", () => {
  const student = makeStudent({ id: "s1", name: "Noa K." });

  it("writes LOCAL times with the semester timezone, never UTC", () => {
    const ics = buildStudentIcs(student, run("s1", "mon", 8 * 60, 10 * 60), semester, 30, NOW);
    expect(ics).toContain("DTSTART;TZID=Pacific/Honolulu:20260824T080000");
    expect(ics).toContain("DTEND;TZID=Pacific/Honolulu:20260824T100000");
    // the event times must not end in Z (which would mean UTC); only DTSTAMP may
    const eventTimes = lines(ics).filter((l) => l.startsWith("DTSTART") || l.startsWith("DTEND"));
    expect(eventTimes.every((l) => !l.endsWith("Z"))).toBe(true);
  });

  it("merges adjacent half hours into one event", () => {
    const ics = buildStudentIcs(student, run("s1", "mon", 8 * 60, 10 * 60), semester, 30, NOW);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it("keeps separate shifts separate", () => {
    const shifts = [...run("s1", "mon", 8 * 60, 9 * 60), ...run("s1", "mon", 13 * 60, 14 * 60), ...run("s1", "wed", 8 * 60, 9 * 60)];
    expect(buildStudentIcs(student, shifts, semester, 30, NOW).match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });

  it("repeats weekly for exactly the number of weeks in the semester", () => {
    // Mon Aug 24 .. Mon Dec 7 is 16 Mondays; Fri Aug 28 .. Fri Dec 11 is 16 Fridays
    expect(countWeeklyOccurrences(semester, "mon")?.count).toBe(16);
    expect(countWeeklyOccurrences(semester, "fri")?.count).toBe(16);
    const ics = buildStudentIcs(student, [slot("s1", "mon", 540)], semester, 30, NOW);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;COUNT=16");
  });

  it("starts on the first matching weekday even when the start date isn't a Monday", () => {
    const wed = { ...semester, startDate: "2026-08-26" }; // a Wednesday
    const mon = countWeeklyOccurrences(wed, "mon")!;
    expect(mon.first.toISOString().slice(0, 10)).toBe("2026-08-31");
    const ics = buildStudentIcs(student, [slot("s1", "mon", 540), slot("s1", "wed", 540)], wed, 30, NOW);
    expect(ics).toContain("DTSTART;TZID=Pacific/Honolulu:20260831T090000");
    expect(ics).toContain("DTSTART;TZID=Pacific/Honolulu:20260826T090000");
  });

  it("skips a weekday that never occurs inside a very short semester", () => {
    const short = { ...semester, endDate: "2026-08-25" }; // Mon and Tue only
    expect(countWeeklyOccurrences(short, "fri")).toBeNull();
    const ics = buildStudentIcs(student, [slot("s1", "fri", 540)], short, 30, NOW);
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("only includes the requested student and is deterministic", () => {
    const shifts = [slot("s1", "mon", 540), slot("s2", "tue", 540)];
    const a = buildStudentIcs(student, shifts, semester, 30, NOW);
    expect(a.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(buildStudentIcs(student, shifts, semester, 30, NOW)).toBe(a);
  });

  it("uses stable UIDs so re-importing updates instead of duplicating", () => {
    const ics = buildStudentIcs(student, [slot("s1", "mon", 540)], semester, 30, NOW);
    expect(ics).toContain("UID:s1-mon-540@shiftfit");
  });

  it("is well formed: CRLF endings, folded long lines, escaped text", () => {
    const odd = makeStudent({ id: "s1", name: "A, B; C\\D" });
    const ics = buildStudentIcs(odd, [slot("s1", "mon", 540)], semester, 30, NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("A\\, B\\; C\\\\D");
    for (const l of lines(ics)) expect(l.length).toBeLessThanOrEqual(75);
  });

  it("needs all three of dates and timezone, and names files safely", () => {
    expect(isSemesterConfigured(semester)).toBe(true);
    expect(isSemesterConfigured({ ...semester, timeZone: "" })).toBe(false);
    expect(isSemesterConfigured(null)).toBe(false);
    expect(icsFileName(makeStudent({ name: "Noa K. / ../../etc" }))).toBe("shiftfit-noa-k-etc.ics");
    expect(icsFileName(makeStudent({ name: "!!!" }))).toBe("shiftfit-student.ics");
  });
});

describe("shift blocks, versions and CSV", () => {
  it("merges only the same student on the same day", () => {
    const blocks = mergeContiguousBlocks([...run("a", "mon", 540, 600), ...run("b", "mon", 570, 630), ...run("a", "tue", 570, 630)], 30);
    expect(blocks).toEqual([
      { studentId: "a", day: "mon", start: 540, end: 600 },
      { studentId: "a", day: "tue", start: 570, end: 630 },
      { studentId: "b", day: "mon", start: 570, end: 630 },
    ]);
  });

  it("gives the same version to the same shifts however they are ordered or named", () => {
    const a = [slot("a", "mon", 540), slot("b", "tue", 600)];
    const b = [{ ...slot("b", "tue", 600), id: "different" }, { ...slot("a", "mon", 540), id: "ids" }];
    expect(scheduleVersion(a)).toBe(scheduleVersion(b));
  });

  it("gives a different version when anything changes", () => {
    const base = scheduleVersion([slot("a", "mon", 540)]);
    expect(scheduleVersion([slot("a", "mon", 570)])).not.toBe(base);
    expect(scheduleVersion([slot("a", "tue", 540)])).not.toBe(base);
    expect(scheduleVersion([slot("b", "mon", 540)])).not.toBe(base);
    expect(scheduleVersion([])).not.toBe(base);
  });

  it("writes one CSV row per shift with readable times", () => {
    const csv = shiftsToCsv([makeStudent({ name: "Noa K." })], run("s1", "mon", 8 * 60, 10 * 60), 30);
    expect(csv).toBe("Student,Day,Start,End,Hours\r\nNoa K.,MON,08:00,10:00,2\r\n");
  });

  it("quotes commas and neutralises spreadsheet formulas in names", () => {
    const csv = shiftsToCsv([makeStudent({ name: '=HYPERLINK("x"),Bob' })], [slot("s1", "mon", 540)], 30);
    const row = csv.split("\r\n")[1];
    expect(row.startsWith(`"'=HYPERLINK`)).toBe(true);
    expect(row).not.toMatch(/^=/);
  });
});

describe("days off (holidays and breaks)", () => {
  const student = makeStudent({ id: "s1", name: "Noa K." });
  const base: SemesterConfig = { startDate: "2026-08-24", endDate: "2026-12-11", timeZone: "Pacific/Honolulu" };
  const events = (ics: string) => ics.split("\r\n").filter((l) => l.startsWith("EXDATE"));

  it("skips only the weekday that the holiday falls on", () => {
    // Thu Nov 26 2026 is Thanksgiving. A Thursday shift is skipped; a Monday shift is untouched.
    const sem = { ...base, skipDates: ["2026-11-26"] };
    const thu = buildStudentIcs(student, [slot("s1", "thu", 8 * 60)], sem, 30, NOW);
    expect(events(thu)).toEqual(["EXDATE;TZID=Pacific/Honolulu:20261126T080000"]);
    const mon = buildStudentIcs(student, [slot("s1", "mon", 8 * 60)], sem, 30, NOW);
    expect(events(mon)).toEqual([]);
  });

  it("uses the shift's own start time and lists several days off on one line", () => {
    const sem = { ...base, skipDates: ["2026-11-26", "2026-11-19"] };
    const ics = buildStudentIcs(student, [slot("s1", "thu", 13 * 60 + 30)], sem, 30, NOW);
    expect(ics.replace(/\r\n /g, "")).toContain("EXDATE;TZID=Pacific/Honolulu:20261119T133000,20261126T133000");
  });

  it("ignores days outside the repeat range and duplicates", () => {
    const sem = { ...base, skipDates: ["2026-08-20", "2027-01-07", "2026-11-26", "2026-11-26"] };
    const ics = buildStudentIcs(student, [slot("s1", "thu", 8 * 60)], sem, 30, NOW);
    expect(ics.replace(/\r\n /g, "")).toContain("EXDATE;TZID=Pacific/Honolulu:20261126T080000\r\n");
    expect(ics).not.toContain("20260820");
    expect(ics).not.toContain("20270107");
  });

  it("does nothing when there are no days off, and the recurrence count is unchanged", () => {
    const ics = buildStudentIcs(student, [slot("s1", "mon", 540)], { ...base, skipDates: [] }, 30, NOW);
    expect(events(ics)).toEqual([]);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;COUNT=16");
  });
});
