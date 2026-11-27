import { parseClassText } from "../scheduling/parser";
import { ocrTextToClassText, timeRangesIn } from "./ocr/ocr-text";

/**
 * ============================================================================
 *  CLEANING UP CLASS TIMES COPIED FROM A SCHOOL SCHEDULE PAGE
 * ============================================================================
 * The quickest way for a manager to enter a student's classes is to copy them from the school's own page and
 * paste. But a copied row carries more than the times: the course name, the section, the room, the teacher
 * ("ENGL 101 - College Writing   ENGL 101-03   Lecture   MWF | 9:00 AM - 9:50 AM | GCB 112   Pat Example").
 * The class-times box only understands lines like "MWF 9:00 AM-9:50 AM", so it used to refuse such text with
 * "Could not find a day + time range", even though a screenshot of the very same page was read fine.
 *
 * This reuses the screenshot reader's text tidier (`ocrTextToClassText`) on pasted TEXT, so both routes follow
 * exactly the same rules.
 *
 * THE RULE THAT KEEPS IT SAFE: nothing is ever dropped silently.
 *  - A line is only rewritten when it contains a real time range (like "9:00 AM - 9:50 AM") AND it did not already
 *    read fine. Lines that already read fine are left exactly as they were.
 *  - A line with no time range at all (a typo like "garbled nonsense", or a column heading) is left in place, so
 *    the class-times box still marks it with a red ✕ for the person to fix or delete.
 *  - In a spreadsheet row (cells separated by tabs) cells that hold no class time are left out, but each one is
 *    LISTED in a warning, and any cell that looks like a time that could not be read is kept so it is flagged.
 * The person always sees every resulting line in the "Here is what Syncro understood" list.
 */

export type CleanedClassText = {
  /** One class per line, in the form the class-times box understands. */
  classText: string;
  /** How many class lines the result holds that read correctly. */
  linesFound: number;
};

/** True when this one line is empty or already reads as valid class times, so it needs no cleaning. */
function readsFine(line: string): boolean {
  return !line.trim() || parseClassText(line).errors.length === 0;
}

/**
 * Returns a cleaned copy of pasted text, or null when it should be left exactly as pasted (it already reads
 * fine, no line could be cleaned, or the result would not have fewer problems).
 */
export function cleanPastedClassText(pasted: string): CleanedClassText | null {
  const problemsBefore = parseClassText(pasted).errors.length;
  if (problemsBefore === 0) return null;
  let changed = false;
  const cleanedLines = pasted.split(/\r?\n/).map((line) => {
    if (readsFine(line) || timeRangesIn(line).length === 0) return line;
    const cleaned = ocrTextToClassText(line);
    if (cleaned.linesFound === 0) return line;
    changed = true;
    return cleaned.classText;
  });
  if (!changed) return null;
  const classText = cleanedLines.join("\n");
  const after = parseClassText(classText);
  if (after.errors.length >= problemsBefore) return null;
  return { classText, linesFound: after.lines.filter((l) => l.ok).length };
}

/** The result of tidying one spreadsheet row's class cells. */
export type CleanedCells = {
  /** The class cells to use, joined with "; " (the form the bulk-add reader understands). */
  classText: string;
  /** Cells that held no class time and were left out, so the screen can list them instead of hiding them. */
  leftOut: string[];
};

/** A clock time like "9:30" anywhere in the text: such a cell is meant to be a class time, so it is never left out. */
const HAS_CLOCK_TIME = /\d{1,2}\s*:\s*\d{2}/;

/**
 * Tidies the cells of one pasted spreadsheet row (everything after the name). Cells that already read fine stay
 * as they are; a cell with a time range inside other words ("MWF | 9:00 AM - 9:50 AM | GCB 112") is cut down to
 * the class time; a cell with no class time in it ("ENGL 101 - College Writing", "Pat Example", "Online") is
 * left out and reported; a cell that looks like a time but cannot be read is kept, so it gets flagged.
 */
export function cleanTableCells(cells: string[]): CleanedCells {
  const kept: string[] = [];
  const leftOut: string[] = [];
  for (const cell of cells.map((c) => c.trim()).filter(Boolean)) {
    if (readsFine(cell)) {
      kept.push(cell);
    } else if (timeRangesIn(cell).length > 0) {
      const cleaned = ocrTextToClassText(cell);
      kept.push(cleaned.linesFound > 0 ? cleaned.classText.split("\n").join("; ") : cell);
    } else if (HAS_CLOCK_TIME.test(cell)) {
      kept.push(cell);
    } else {
      leftOut.push(cell);
    }
  }
  return { classText: kept.join("; "), leftOut };
}
