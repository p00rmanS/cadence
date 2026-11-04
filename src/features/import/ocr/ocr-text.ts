import { mentionsSunday, parseDays } from "../../scheduling/parser";

/**
 * ============================================================================
 *  TURNING TEXT READ FROM A SCREENSHOT INTO CLASS-TIME LINES
 * ============================================================================
 * A screenshot of a class schedule (for example Workday's "My Enrolled Courses" page) reads back as
 * messy text: course names, teachers, rooms, and somewhere in each row the days and times, often with
 * small reading mistakes ("9:O0" with a letter O, "9.50" with a dot).
 *
 * This file does NOT decide what a class time means. It only tidies the text and picks out the
 * "days + start-end" part of each row, writing it the way the app's normal class-time parser
 * (`src/features/scheduling/parser.ts`) already understands, e.g. "MWF 9:00 AM-9:50 AM". The person
 * then sees those lines in the class-times box, where the same parser checks each one and they can
 * fix anything before saving. So typed text and screenshots always follow exactly the same rules.
 */

export type ClassTextFromOcr = {
  /** One class per line, ready for the class-times box. Empty if no class times were found. */
  classText: string;
  /** How many lines with a time range were found. */
  linesFound: number;
};

/** The pieces of one clock time: "9", "9:50", "9:50 AM", "9 am", or "noon". */
const TIME = String.raw`(?:noon|\d{1,2}:\d{2}(?:\s*[ap]\.?\s*m\.?)?|\d{1,2}\s*[ap]\.?\s*m\.?)`;

/**
 * Finds a time range anywhere in a line, in words: a clock time, then a dash, "to" or "until", then
 * another clock time. A time needs a colon or am/pm (or be "noon"), so a course number like
 * "101-102" is never mistaken for a time. A range can't start right after a digit or a colon, so the
 * tail of a half-read time ("%:00AM") is never taken for a whole one. Groups: 1 = start, 2 = end.
 */
const TIME_RANGE = new RegExp(String.raw`(?<![\d:])(${TIME})\s*(?:-|to|until)\s*(${TIME})(?![\d:])`, "gi");

/**
 * Text that is clearly meant to be a class time even if it couldn't be fully read, in words: a clock
 * time with a colon ("10:15") followed somewhere by am/pm or a dash. Used to keep such a line for the
 * person to fix, instead of dropping the class.
 */
const LOOKS_LIKE_A_TIME = /\d{1,2}:\d{2}.*?(?:[ap]\.?\s*m\b|-)|-.*?\d{1,2}:\d{2}/i;

/**
 * A clock time with common reading mistakes, in words: 1-2 digit-like characters, a colon-like mark
 * (":", ";", "." or ","), then exactly 2 digit-like characters. "Digit-like" includes the letters O
 * and o (read instead of 0) and I, l and | (read instead of 1). Group 1 = hour, 2 = minutes.
 */
const MISREAD_TIME = /(?<![A-Za-z\d])([\dOoIl|]{1,2})\s?[:;.,]\s?([\dOoIl|]{2})(?![\d])/g;

/** Splits the text around a time range into words that might be days ("MWF", "Tue", "Tu/Th"). */
const WORD_SEPARATORS = /[\s|,]+/;

/** Replaces letters that were read instead of digits inside a time ("9:O0" -> "9:00", "l0:30" -> "10:30"). */
function digitsOnly(text: string): string {
  return text.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
}

/**
 * Fixes the reading mistakes that most often break a time: letters read as digits, odd colons, odd
 * dashes, and "A M" / "a.m" written apart. Only text shaped like a clock time is touched, so words
 * like "Online" or "Lab" are never changed.
 */
export function fixReadingMistakes(line: string): string {
  return (
    line
      // Every kind of dash (en dash, em dash, minus sign, "~", "--") becomes a plain "-".
      .replace(/\s*(?:[–—−~]|--)\s*/g, " - ")
      // "9:O0", "9.50", "l0;30" -> "9:00", "9:50", "10:30". Only when the result is a real hour and minute.
      .replace(MISREAD_TIME, (whole, hour: string, minute: string) => {
        if (!/\d/.test(hour + minute)) return whole; // no real digit at all: it's a word, leave it
        const h = Number(digitsOnly(hour));
        const m = Number(digitsOnly(minute));
        return h <= 23 && m <= 59 ? `${h}:${digitsOnly(minute)}` : whole;
      })
      // "9:00 A M", "9:00 P.M" -> "9:00 AM", "9:00 PM".
      .replace(/(\d)\s*([AaPp])\s*\.?\s*([Mm])\b\.?/g, (_whole, digit: string, ap: string) => `${digit} ${ap.toUpperCase()}M`)
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** True if this one word names days ("MWF", "TTh", "Tuesday/Thursday", "Sat") or Sunday. */
function isDayWord(word: string): boolean {
  return parseDays(word) !== null || mentionsSunday(word);
}

/**
 * The day words right next to a time range: first the words just before it (reading backwards until
 * a word isn't a day), otherwise the words just after it. Returns them as written, or "" if none.
 */
function daysAround(before: string, after: string): string {
  const wordsBefore = before.split(WORD_SEPARATORS).filter(Boolean);
  const daysBefore: string[] = [];
  for (let i = wordsBefore.length - 1; i >= 0 && isDayWord(wordsBefore[i]); i--) daysBefore.unshift(wordsBefore[i]);
  if (daysBefore.length) return daysBefore.join(" ");

  const daysAfter: string[] = [];
  for (const word of after.split(WORD_SEPARATORS).filter(Boolean)) {
    if (!isDayWord(word)) break;
    daysAfter.push(word);
  }
  return daysAfter.join(" ");
}

/**
 * A line that holds a class time the reader couldn't fully make out, shortened to start at its first
 * day word if it has one ("HIST 201 TTh %:00AM - 10:15AM" -> "TTh %:00AM - 10:15AM"), so that once the
 * person fixes the misread character, the line reads normally.
 */
function fromFirstDay(line: string): string {
  const words = line.split(" ");
  const first = words.findIndex(isDayWord);
  return first > 0 ? words.slice(first).join(" ") : line;
}

/** True if the whole line is only day words (a table can put the days on their own line above the time). */
function isOnlyDays(line: string): boolean {
  const words = line.split(WORD_SEPARATORS).filter(Boolean);
  return words.length > 0 && words.every(isDayWord);
}

/** One time of day, as a standalone piece (anchored), used to see how a line starts or ends. */
const LONE_TIME_AT_END = new RegExp(String.raw`(?<![\d:])${TIME}\s*(?:-|to|until)?\s*$`, "i");
const STARTS_WITH_TIME = new RegExp(String.raw`^\s*(?:(?:-|to|until)\s*)?${TIME}(?![\d:])`, "i");
const LEADING_DASH = /^\s*(?:-|to|until)\s*/i;
const TRAILING_DASH = /(?:-|to|until)\s*$/i;

/** True when the line already holds a complete "start - end" time range. */
function hasCompleteRange(line: string): boolean {
  return new RegExp(TIME_RANGE.source, "i").test(line);
}

/**
 * Narrow screens (a phone screenshot of a list) wrap one meeting over two lines, like
 * "Tuesday/Thursday | 8:00 AM -" then "9:15 AM SCB 211", or even drop the dash:
 * "Monday/Wednesday | 1:00 PM" then "1:50 PM | STC 184". Read line by line, each half fails. So a line that
 * has day words and ends on an unfinished start time (or on a dash) is joined to the next line when that
 * line starts with a time. A line with NO day word and no dash is never joined (a calendar's left-hand
 * "8:00 AM", "9:00 AM" labels are not the start and end of one class).
 */
export function joinWrappedLines(lines: string[]): string[] {
  const joined: string[] = [];
  for (const line of lines) {
    const previous = joined[joined.length - 1];
    const unfinished =
      previous !== undefined &&
      !hasCompleteRange(previous) &&
      LONE_TIME_AT_END.test(previous) &&
      (TRAILING_DASH.test(previous) || previous.split(WORD_SEPARATORS).some(isDayWord));
    if (unfinished && STARTS_WITH_TIME.test(line)) {
      const glue = TRAILING_DASH.test(previous) ? " " : " - ";
      joined[joined.length - 1] = `${previous}${glue}${line.replace(LEADING_DASH, "")}`;
    } else {
      joined.push(line);
    }
  }
  return joined;
}

/** Every complete time range written in some text, in order, as the start and end exactly as read ("9:30 AM", "10:50 AM"). */
export function timeRangesIn(text: string): { start: string; end: string }[] {
  return [...text.matchAll(TIME_RANGE)].map((m) => ({ start: m[1].trim(), end: m[2].trim() }));
}

/**
 * Picks the class times out of text read from a screenshot (see the file comment). Lines with nothing
 * like a time (titles, teachers, column headings) are left out. A class is never silently dropped:
 * a line that looks like a time but couldn't be fully read, or a time range whose days can't be found,
 * is kept as it was read, so the class-times box marks it with a red ✕ and the person fixes it.
 */
export function ocrTextToClassText(rawText: string): ClassTextFromOcr {
  const lines = joinWrappedLines(rawText.split(/\r?\n/).map(fixReadingMistakes).filter(Boolean));
  const found: string[] = [];
  let daysOnPreviousLine = "";

  for (const line of lines) {
    const matches = [...line.matchAll(TIME_RANGE)];
    if (!matches.length) {
      // A lone time with no day and no dash ("8:00 AM", "Start Time | 8:00 AM") is a calendar's axis label or a
      // form field, not a class that failed to read, so it is dropped instead of being reported as a problem line.
      const hasDay = line.split(WORD_SEPARATORS).some(isDayWord);
      const hasDash = /-|\bto\b|\buntil\b/i.test(line);
      if (LOOKS_LIKE_A_TIME.test(line) && (hasDay || hasDash)) found.push(fromFirstDay(line));
      daysOnPreviousLine = isOnlyDays(line) ? line : "";
      continue;
    }
    // One row can hold several meeting patterns ("MW 9:00-9:50 F 10:00-10:50"). Each range looks for
    // its days only in the text between the previous range and the next one, so they don't mix.
    matches.forEach((match, i) => {
      const [whole, start, end] = match;
      const rangeStart = match.index ?? 0;
      const previousEnd = i === 0 ? 0 : (matches[i - 1].index ?? 0) + matches[i - 1][0].length;
      const nextStart = i === matches.length - 1 ? line.length : (matches[i + 1].index ?? line.length);
      const before = line.slice(previousEnd, rangeStart);
      const after = line.slice(rangeStart + whole.length, nextStart);
      const days = daysAround(before, i === matches.length - 1 ? after : "") || (i === 0 ? daysOnPreviousLine : "");
      // No days found: keep the whole line as read, so the person sees which class it was and adds them.
      found.push(days ? `${days} ${start.trim()}-${end.trim()}` : line);
    });
    daysOnPreviousLine = "";
  }

  const unique = Array.from(new Set(found));
  return { classText: unique.join("\n"), linesFound: unique.length };
}
