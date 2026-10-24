import { fixReadingMistakes, timeRangesIn } from "./ocr-text";

/**
 * ============================================================================
 *  READING A WEEKLY CALENDAR PICTURE (days across the top, classes as boxes)
 * ============================================================================
 * Registration sites can show a student's week as a calendar: "Monday ... Saturday" across the top and each
 * class as a box in its day's column, with the time written inside the box ("REL 275 - 05 Lecture 9:30AM -
 * 10:50AM Stake Center"). Reading such a picture as plain text mixes the columns together and loses which
 * day each box belongs to. So this file uses where each WORD sits in the picture:
 *   1. find the row of day names (needs at least three different days, side by side),
 *   2. split the picture below it into one column per day,
 *   3. read each column's text top to bottom and pick out the time ranges: each is one class on that day.
 * Everything here is plain arithmetic on word positions (no Tesseract in this file), so it is unit-tested with
 * made-up word boxes. If the picture is a calendar but the boxes don't have times written in them (some sites
 * show only the course name and room and let the box height show the time), it says so instead of guessing.
 */

/** One word the reader found, with the rectangle it occupies in the picture (x grows rightward, y downward). */
export type OcrWord = { text: string; x0: number; y0: number; x1: number; y1: number };

export type CalendarReading = {
  /** One "Monday 9:30 AM-10:50 AM" line per class box found, ready for the class-times box. */
  classText: string;
  linesFound: number;
  /** True when a day header was found but no box had a time written in it (see the file comment). */
  noTimesWritten: boolean;
};

export type CalendarDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** One day's column of the calendar: its day and the left and right edges (x) of the strip below its name. */
export type CalendarColumn = { day: CalendarDay; left: number; right: number };

/** The spellings of day names that count as a column header, lowercase, no punctuation. */
const DAY_NAMES: Record<string, CalendarDay> = {
  monday: "mon", mon: "mon",
  tuesday: "tue", tue: "tue", tues: "tue",
  wednesday: "wed", wed: "wed",
  thursday: "thu", thu: "thu", thur: "thu", thurs: "thu",
  friday: "fri", fri: "fri",
  saturday: "sat", sat: "sat",
  sunday: "sun", sun: "sun",
};

/** Full day names for the lines we write, so the existing class-time reader understands them. */
const FULL_NAME: Record<CalendarDay, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

/** The fewest different day names, in one row, that make a picture a calendar (so a list that merely mentions "Monday" is not). */
const MIN_HEADER_DAYS = 3;

/** The day a word names, or null. Punctuation around it ("Mon," "Monday:") is ignored. */
function dayOf(word: OcrWord): CalendarDay | null {
  return DAY_NAMES[word.text.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

const centerX = (w: OcrWord): number => (w.x0 + w.x1) / 2;
const centerY = (w: OcrWord): number => (w.y0 + w.y1) / 2;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

/**
 * The row of day names across the top: the topmost group of day-name words that share a line and name at
 * least MIN_HEADER_DAYS different days. Lower rows of day names (the "Display options" checkboxes under a
 * calendar) are ignored because the topmost qualifying row wins. Returns one word per day, left to right.
 */
function findHeaderRow(words: OcrWord[]): { header: { day: CalendarDay; word: OcrWord }[]; bottom: number } | null {
  const dayWords = words.filter((w) => dayOf(w) !== null).sort((a, b) => centerY(a) - centerY(b));
  // Words on one line differ in height a little; half a typical word height is the "same line" tolerance.
  const tolerance = Math.max(8, median(words.map((w) => w.y1 - w.y0)) * 0.6);
  const rows: OcrWord[][] = [];
  for (const word of dayWords) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(centerY(word) - centerY(row[0])) <= tolerance) row.push(word);
    else rows.push([word]);
  }
  for (const row of rows) {
    const byDay = new Map<CalendarDay, OcrWord>();
    for (const word of [...row].sort((a, b) => a.x0 - b.x0)) {
      const day = dayOf(word) as CalendarDay;
      if (!byDay.has(day)) byDay.set(day, word);
    }
    if (byDay.size >= MIN_HEADER_DAYS) {
      const header = [...byDay.entries()].map(([day, word]) => ({ day, word })).sort((a, b) => a.word.x0 - b.word.x0);
      return { header, bottom: Math.max(...row.map((w) => w.y1)) };
    }
  }
  return null;
}

/** The full name of a day ("Monday"), as written in the class-time lines. */
export function dayName(day: CalendarDay): string {
  return FULL_NAME[day];
}

/**
 * The day columns of a weekly calendar picture, and the height of the day-name row (everything below it is the
 * calendar body). Each column runs halfway to its neighbours; the outer columns extend half a column past the
 * first and last day name. Returns null when the picture has no row of day names.
 */
export function calendarColumns(words: OcrWord[]): { columns: CalendarColumn[]; headerBottom: number } | null {
  const found = findHeaderRow(words);
  if (!found) return null;
  const { header, bottom } = found;
  const centers = header.map((h) => centerX(h.word));
  const spacing = (centers[centers.length - 1] - centers[0]) / (centers.length - 1);
  const edges = centers.map((c, i) => (i === 0 ? c - spacing / 2 : (centers[i - 1] + c) / 2));
  edges.push(centers[centers.length - 1] + spacing / 2);
  return { columns: header.map(({ day }, i) => ({ day, left: edges[i], right: edges[i + 1] })), headerBottom: bottom };
}

/**
 * Reads a weekly calendar picture from its words, or returns null when the picture has no row of day names
 * (so the caller reads it as ordinary text instead).
 */
export function calendarWordsToClassText(words: OcrWord[]): CalendarReading | null {
  const found = calendarColumns(words);
  if (!found) return null;
  const { columns, headerBottom } = found;

  const lines: string[] = [];
  for (const { day, left, right } of columns) {
    const column = words
      .filter((w) => w.y0 >= headerBottom - 2 && centerX(w) >= left && centerX(w) < right)
      .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    // The column read top to bottom as one running text, so a time range wrapped over two lines inside a box
    // ("9:30AM -" then "10:50AM") is still seen as one range.
    const text = fixReadingMistakes(column.map((w) => w.text).join(" "));
    for (const { start, end } of timeRangesIn(text)) lines.push(`${FULL_NAME[day]} ${start}-${end}`);
  }

  const unique = Array.from(new Set(lines));
  return { classText: unique.join("\n"), linesFound: unique.length, noTimesWritten: unique.length === 0 };
}
