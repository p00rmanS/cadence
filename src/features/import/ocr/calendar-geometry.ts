import type { CalendarColumn, OcrWord } from "./calendar-layout";

/**
 * ============================================================================
 *  READING A CALENDAR WHOSE BOXES HAVE NO TIMES WRITTEN IN THEM
 * ============================================================================
 * Some registration calendars (Workday's "View as Course Calendar") show each class as a box with only the
 * course and room, and let the BOX itself show the time: a box that starts at the "8 AM" line and ends a little
 * past "9 AM" is a class from 8:00 to about 9:15. `calendar-layout.ts` can't read those, because no time is
 * written. This file measures instead:
 *   1. read the time labels down the left edge ("7 AM", "8 AM"...) and fit a straight line through their
 *      heights, giving "minutes since midnight" for any height in the picture,
 *   2. in each day's column, find the boxes: a tall run of pixels that aren't the white page,
 *   3. turn each box's top and bottom into start and end times, then snap them to the usual class times.
 * Measuring is approximate (a few minutes, and a drawn box is not always exactly to scale), so everything
 * read this way is shown to the manager as "measured, please check", never as certain. All of it is plain
 * arithmetic on numbers (no browser, no Tesseract), so it is tested with made-up pixels and word boxes.
 */

/** One time label on the left edge: what time it names and how far down the picture it is. */
export type TimeLabel = { minutes: number; y: number };

/** A straight-line fit through the time labels: how many minutes after midnight a given height is. */
export type TimeAxis = { minutesAt: (y: number) => number; pixelsPerHour: number };

/** One class box found in a column: the heights of its top and bottom edge. */
export type Box = { top: number; bottom: number };

/**
 * The label text sits a little BELOW its own grid line (a "7 AM" label's centre is a few pixels under the 7:00
 * line). This is how far, as a fraction of an hour, measured on a real Workday picture (7 px of 116 per hour).
 * Without it every box would read about 3-4 minutes late.
 */
export const LABEL_BELOW_LINE_HOURS = 0.06;

/** A box must be at least this fraction of an hour tall to count (thinner runs are grid lines or text, not classes). */
const MIN_BOX_HOURS = 0.3;

/** Most the fit may be off at any label, as a fraction of an hour, before that label is treated as a misread and dropped. */
const MAX_LABEL_ERROR_HOURS = 0.12;

/** Class lengths that are common (in minutes). A measured length close to one of these is snapped to it. */
export const COMMON_CLASS_MINUTES = [50, 75, 80, 100, 110, 120, 150, 165, 170, 180];

/** How close (minutes) a measured length must be to a common class length to be snapped to it. */
const SNAP_LENGTH_WITHIN = 10;

/** How close (minutes) a measured start must be to a quarter hour to be snapped to it. */
const SNAP_START_WITHIN = 6;

/**
 * Time labels from the words on the left of the calendar: "7 AM" as two words, "12PM" as one, "7:00 AM" and so
 * on. Only words left of `leftEdge` count (the first day column starts there), so a class's own text is never
 * taken for a label.
 */
export function timeLabelsFromWords(words: OcrWord[], leftEdge: number): TimeLabel[] {
  const left = words.filter((w) => w.x1 <= leftEdge).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const labels: TimeLabel[] = [];
  for (let i = 0; i < left.length; i++) {
    const word = left[i];
    const text = word.text.toLowerCase().replace(/[^a-z0-9:]/g, "");
    let hourText: string | null = null;
    let meridiem: string | null = null;
    let lastWord = word;
    const joined = /^(\d{1,2})(?::00)?(am|pm)$/.exec(text);
    if (joined) {
      hourText = joined[1];
      meridiem = joined[2];
    } else if (/^\d{1,2}(?::00)?$/.test(text)) {
      const next = left[i + 1];
      const nextText = next?.text.toLowerCase().replace(/[^a-z]/g, "");
      // "7" followed by "AM" on the same line
      if (next && (nextText === "am" || nextText === "pm") && Math.abs((next.y0 + next.y1) / 2 - (word.y0 + word.y1) / 2) < (word.y1 - word.y0)) {
        hourText = text.replace(":00", "");
        meridiem = nextText;
        lastWord = next;
      }
    }
    if (hourText === null || meridiem === null) continue;
    const hour = Number(hourText);
    if (hour < 1 || hour > 12) continue;
    const minutes = ((hour % 12) + (meridiem === "pm" ? 12 : 0)) * 60;
    labels.push({ minutes, y: (Math.min(word.y0, lastWord.y0) + Math.max(word.y1, lastWord.y1)) / 2 });
  }
  return labels;
}

/** Least-squares line through (y, minutes) points; returns the slope and the value at y = 0, or null for fewer than 2 points. */
function fitLine(points: { y: number; minutes: number }[]): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const meanM = points.reduce((s, p) => s + p.minutes, 0) / n;
  const spread = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  if (spread === 0) return null;
  const slope = points.reduce((s, p) => s + (p.y - meanY) * (p.minutes - meanM), 0) / spread;
  return { slope, intercept: meanM - slope * meanY };
}

/**
 * A straight-line time axis from the labels, or null when they don't agree. At least three labels are needed (the
 * reader often misses some) and later hours must be lower down the picture. A misread label (say a "3" read as
 * an "8") bends the line, so while any label is off the line by more than MAX_LABEL_ERROR_HOURS the single
 * worst one is dropped and the line refitted (dropping them all at once would throw away the good ones too).
 */
export function fitTimeAxis(labels: TimeLabel[]): TimeAxis | null {
  let points = labels.map((l) => ({ y: l.y, minutes: l.minutes }));
  const tolerance = MAX_LABEL_ERROR_HOURS * 60;
  while (points.length >= 3) {
    const line = fitLine(points);
    if (!line || line.slope <= 0) return null;
    const errors = points.map((p) => Math.abs(line.intercept + line.slope * p.y - p.minutes));
    const worst = Math.max(...errors);
    if (worst <= tolerance) {
      return { minutesAt: (y) => line.intercept + line.slope * y + LABEL_BELOW_LINE_HOURS * 60, pixelsPerHour: 60 / line.slope };
    }
    points = points.filter((_, i) => i !== errors.indexOf(worst));
  }
  return null;
}

/**
 * Boxes in one column: runs of pixels that are not the page background, at least MIN_BOX_HOURS tall. Several
 * sample columns across the right side of the box are checked and two out of three must agree, so a line of text
 * or a stray mark in one place doesn't break a box in two. `brightness(x, y)` is 0 (black) to 255 (white).
 */
export function findBoxes(
  brightness: (x: number, y: number) => number,
  column: { left: number; right: number },
  yFrom: number,
  yTo: number,
  background: number,
  pixelsPerHour: number,
): Box[] {
  const width = column.right - column.left;
  const samples = [0.82, 0.88, 0.93].map((fraction) => Math.round(column.left + fraction * width));
  const minRun = Math.max(8, MIN_BOX_HOURS * pixelsPerHour);
  const boxes: Box[] = [];
  let start: number | null = null;
  for (let y = Math.round(yFrom); y <= Math.round(yTo); y++) {
    const filled = samples.filter((x) => Math.abs(brightness(x, y) - background) > 6).length >= 2;
    if (filled && start === null) start = y;
    if (!filled && start !== null) {
      if (y - start >= minRun) boxes.push({ top: start, bottom: y - 1 });
      start = null;
    }
  }
  if (start !== null && Math.round(yTo) - start >= minRun) boxes.push({ top: start, bottom: Math.round(yTo) });
  return boxes;
}

/** The page's own colour: the middle brightness over a grid of points in the picture (boxes cover only a small part of it). */
export function pageBackground(brightness: (x: number, y: number) => number, width: number, yFrom: number, yTo: number): number {
  const values: number[] = [];
  for (let y = Math.round(yFrom); y <= Math.round(yTo); y += 9) {
    for (let x = 4; x < width; x += 37) values.push(brightness(x, y));
  }
  values.sort((a, b) => a - b);
  return values.length ? values[Math.floor(values.length / 2)] : 255;
}

/**
 * Turns a measured start and end (minutes after midnight) into believable class times: the start goes to the
 * nearest quarter hour when it is within SNAP_START_WITHIN minutes of one, otherwise to the nearest 5 minutes;
 * the length goes to the nearest common class length when it is within SNAP_LENGTH_WITHIN minutes, otherwise to
 * the nearest 5. (A drawn box is rarely exactly to scale, but classes are, so this recovers the real times.)
 */
export function snapToClassTimes(measuredStart: number, measuredEnd: number): { start: number; end: number } {
  const nearestQuarter = Math.round(measuredStart / 15) * 15;
  const start = Math.abs(nearestQuarter - measuredStart) <= SNAP_START_WITHIN ? nearestQuarter : Math.round(measuredStart / 5) * 5;
  const length = measuredEnd - measuredStart;
  let snapped = Math.round(length / 5) * 5;
  let best = SNAP_LENGTH_WITHIN + 1;
  for (const common of COMMON_CLASS_MINUTES) {
    const gap = Math.abs(common - length);
    if (gap < best) {
      best = gap;
      snapped = common;
    }
  }
  return { start, end: start + snapped };
}

/** "9:15 AM" for 555 minutes after midnight, the form the class-time reader understands. */
export function clockText(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${((hour + 11) % 12) + 1}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export type GeometryReading = { classText: string; linesFound: number };

/**
 * The whole job for one picture: the day columns (from `calendarColumns`), the words (for the time labels) and
 * a way to read pixel brightness. Returns null when the time labels can't be read (so the caller can say so).
 */
export function readBoxGeometry(
  columns: CalendarColumn[],
  words: OcrWord[],
  brightness: (x: number, y: number) => number,
  imageWidth: number,
  dayName: (day: CalendarColumn["day"]) => string,
): GeometryReading | null {
  if (columns.length === 0) return null;
  const axis = fitTimeAxis(timeLabelsFromWords(words, columns[0].left));
  if (!axis) return null;
  const labelYs = timeLabelsFromWords(words, columns[0].left).map((l) => l.y);
  const yFrom = Math.min(...labelYs) - axis.pixelsPerHour * 0.5;
  const yTo = Math.max(...labelYs) + axis.pixelsPerHour * 0.5;
  const background = pageBackground(brightness, imageWidth, yFrom, yTo);

  const lines: string[] = [];
  for (const column of columns) {
    for (const box of findBoxes(brightness, column, yFrom, yTo, background, axis.pixelsPerHour)) {
      const { start, end } = snapToClassTimes(axis.minutesAt(box.top), axis.minutesAt(box.bottom + 1));
      lines.push(`${dayName(column.day)} ${clockText(start)}-${clockText(end)}`);
    }
  }
  const unique = Array.from(new Set(lines));
  return { classText: unique.join("\n"), linesFound: unique.length };
}
