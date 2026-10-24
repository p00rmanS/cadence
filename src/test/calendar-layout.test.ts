import { describe, expect, it } from "vitest";
import { calendarWordsToClassText } from "../features/import/ocr/calendar-layout";
import type { OcrWord } from "../features/import/ocr/calendar-layout";
import { parseClassText } from "../features/scheduling/parser";

/**
 * Tests for reading a weekly CALENDAR picture by where its words sit (`ocr/calendar-layout.ts`). The word
 * boxes are made up, laid out like a real registration calendar: day names across the top, a column of
 * times down the left, form fields above, a row of "show this day" checkboxes below, and class boxes with the
 * time written inside. (A real picture of this kind lost every Wednesday class when read as plain text.)
 */

/** One word centred at `cx`, `y` pixels from the top; each letter is 10 px wide and the word 30 px tall. */
function word(text: string, cx: number, y: number): OcrWord {
  const half = (text.length * 10) / 2;
  return { text, x0: cx - half, x1: cx + half, y0: y, y1: y + 30 };
}

/** Several words on one line, left to right from `startX`, with 14 px between them. */
function line(texts: string[], startX: number, y: number): OcrWord[] {
  const out: OcrWord[] = [];
  let x = startX;
  for (const text of texts) {
    out.push(word(text, x + (text.length * 10) / 2, y));
    x += text.length * 10 + 14;
  }
  return out;
}

const COLUMN_CENTERS = { mon: 300, tue: 500, wed: 700, thu: 900, fri: 1100, sat: 1300, sun: 1500 } as const;

/** The usual surroundings of a calendar: fields above, day names, the time labels on the left, checkboxes below. */
function calendarFrame(days: (keyof typeof COLUMN_CENTERS)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]): OcrWord[] {
  const names = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  return [
    ...line(["Start", "Time", "8:00AM", "End", "Time", "6:00PM"], 200, 20), // form fields above the calendar
    ...days.map((d) => word(names[d], COLUMN_CENTERS[d], 100)), // the day names
    ...days.map((d, i) => word(`May ${4 + i}`, COLUMN_CENTERS[d], 140)), // the dates under them
    word("8:00AM", 80, 300), word("9:00AM", 80, 700), word("10:00AM", 80, 1100), // the time labels on the left
    ...["Monday", "Tuesday", "Wednesday"].map((n, i) => word(n, 300 + i * 200, 2400)), // "Display options" checkboxes below
  ];
}

/** A class box: course lines, then the time written inside (wrapped over two lines like a real box), then the room. */
function classBox(cx: number, top: number, course: string, start: string, end: string): OcrWord[] {
  return [
    word(course, cx, top),
    word("Lecture", cx, top + 40),
    word(`${start} -`, cx, top + 80),
    word(end, cx, top + 120),
    word("Heber", cx, top + 160),
  ];
}

describe("calendarWordsToClassText", () => {
  it("gives each class box the day of its column and the time written inside it", () => {
    const words = [
      ...calendarFrame(),
      ...classBox(COLUMN_CENTERS.mon, 600, "REL 275", "9:30AM", "10:50AM"),
      ...classBox(COLUMN_CENTERS.wed, 600, "REL 275", "9:30AM", "10:50AM"),
      ...classBox(COLUMN_CENTERS.tue, 400, "HIST 367", "8:00AM", "10:00AM"),
      ...classBox(COLUMN_CENTERS.thu, 400, "HIST 367", "8:00AM", "10:00AM"),
      ...classBox(COLUMN_CENTERS.mon, 1200, "ENTR 318", "12:30PM", "1:50PM"),
      ...classBox(COLUMN_CENTERS.wed, 1200, "ENTR 318", "12:30PM", "1:50PM"),
      ...classBox(COLUMN_CENTERS.fri, 1200, "ENTR 318", "12:30PM", "1:50PM"),
    ];
    const reading = calendarWordsToClassText(words);
    expect(reading?.noTimesWritten).toBe(false);
    expect(reading?.classText.split("\n").sort()).toEqual(
      [
        "Monday 9:30 AM-10:50 AM",
        "Monday 12:30 PM-1:50 PM",
        "Tuesday 8:00 AM-10:00 AM",
        "Wednesday 9:30 AM-10:50 AM",
        "Wednesday 12:30 PM-1:50 PM",
        "Thursday 8:00 AM-10:00 AM",
        "Friday 12:30 PM-1:50 PM",
      ].sort(),
    );
  });

  it("ignores the time labels on the left, the fields above and the checkboxes below", () => {
    const reading = calendarWordsToClassText([...calendarFrame(), ...classBox(COLUMN_CENTERS.fri, 600, "ENTR 318", "12:30PM", "1:50PM")]);
    expect(reading?.classText).toBe("Friday 12:30 PM-1:50 PM");
    expect(reading?.linesFound).toBe(1);
  });

  it("its lines are understood by the ordinary class-time reader", () => {
    const reading = calendarWordsToClassText([...calendarFrame(), ...classBox(COLUMN_CENTERS.thu, 600, "HIST 367", "8:00AM", "10:00AM")]);
    const parsed = parseClassText(reading?.classText ?? "");
    expect(parsed.errors).toEqual([]);
    expect(parsed.busy).toEqual([{ day: "thu", start: 480, end: 600, source: "class" }]);
  });

  it("works with abbreviated day names and only some days shown", () => {
    const words = [word("Mon", 300, 100), word("Wed", 500, 100), word("Fri", 700, 100), ...classBox(500, 400, "BIO 101", "9:00 AM", "9:50 AM")];
    expect(calendarWordsToClassText(words)?.classText).toBe("Wednesday 9:00 AM-9:50 AM");
  });

  it("says no times were written when it is a calendar but the boxes show only course names", () => {
    const words = [...calendarFrame(), word("HIST 470-02", COLUMN_CENTERS.tue, 400), word("SCB 211", COLUMN_CENTERS.tue, 440), word("REL 211-03", COLUMN_CENTERS.mon, 900)];
    const reading = calendarWordsToClassText(words);
    expect(reading).not.toBeNull();
    expect(reading?.noTimesWritten).toBe(true);
    expect(reading?.classText).toBe("");
  });

  it("is not fooled by a list that merely mentions some days", () => {
    const list = [...line(["Tuesday/Thursday", "|", "8:00", "AM", "-", "9:15", "AM"], 100, 100), ...line(["Monday", "Wednesday"], 100, 200)];
    expect(calendarWordsToClassText(list)).toBeNull();
    expect(calendarWordsToClassText([])).toBeNull();
  });

  it("keeps a Sunday box (the class-time reader then flags it, since Sunday isn't scheduled)", () => {
    const reading = calendarWordsToClassText([...calendarFrame(), ...classBox(COLUMN_CENTERS.sun, 600, "REL 100", "10:00AM", "11:00AM")]);
    expect(reading?.classText).toBe("Sunday 10:00 AM-11:00 AM");
    expect(parseClassText(reading?.classText ?? "").errors).toHaveLength(1);
  });
});
