import { parseClassText } from "../../scheduling/parser";
import { CALENDAR_THRESHOLD, LOW_CONFIDENCE, MAX_SCREENSHOT_BYTES, SCREENSHOT_TYPES } from "./constants";
import { readWithEnhancedReader } from "./enhanced-reader";
import { readBoxGeometry } from "./calendar-geometry";
import { calendarColumns, calendarWordsToClassText, dayName } from "./calendar-layout";
import { ocrTextToClassText } from "./ocr-text";
import { binarizedCopy, prepareScreenshot, shrinkForUpload } from "./preprocess";
import type { OcrWord } from "./calendar-layout";
import { readWithTesseract } from "./tesseract-reader";
import type { ReadingProgress } from "./tesseract-reader";

/**
 * ============================================================================
 *  READING CLASS TIMES FROM A SCREENSHOT (THE WHOLE JOURNEY)
 * ============================================================================
 * This is the one file the screen (`ImportPanel.tsx`) talks to. Two ways to read a screenshot:
 *
 *  1. `readScreenshot`: always tried first. Cleans up the picture (`preprocess.ts`) and reads it with
 *     Tesseract right here in the browser (`tesseract-reader.ts`). Free, no key, and the picture never
 *     leaves this computer.
 *  2. `readScreenshotEnhanced`: only when the manager clicks "Try enhanced reading". Shrinks the
 *     cleaned-up picture under 1 MB and sends it to the Syncro server, which asks OCR.space
 *     (`enhanced-reader.ts`). Suggested when Tesseract wasn't sure of its reading.
 *
 * Either way the text found goes through `ocr-text.ts`, which picks out the "days + times" of each
 * class in the format the normal class-time parser understands. The result is put into the
 * class-times box for the person to check and fix. Nothing is saved until they press Save.
 */

export type ScreenshotReading = {
  /** One class per line, for the class-times box ("" if none were found). */
  classText: string;
  /** How many class times were found. */
  linesFound: number;
  /** True when the reading is probably poor: Tesseract wasn't confident, or no class times turned up. */
  lowConfidence: boolean;
  /** A plain-language explanation to show instead of the usual "no class times found" (see `NO_TIMES_NOTE`). */
  note?: string;
  /** True when the times were MEASURED from the size of each class box (nothing was written), so they can be a few minutes off. */
  measured?: boolean;
};

/**
 * Shown when the picture is a weekly calendar but its boxes don't have the times written in them (some sites
 * only show the course name and room and let the box's height show the time, which can't be read reliably).
 */
export const NO_TIMES_NOTE =
  "This looks like a weekly calendar picture, but the class boxes don't have their times written in them, and the time labels down the side couldn't be read well enough to measure them. In Workday, switch to the List view (the Meeting Patterns column) and screenshot that instead, or type the times.";

/** Shown with times that were measured from box sizes instead of read from text (see `ScreenshotReading.measured`). */
export const MEASURED_NOTE = "These times were measured from the size of each class box in the picture, so they can be a few minutes off. Check every one against the real schedule.";

export type ReadOutcome = { ok: true; reading: ScreenshotReading } | { ok: false; error: string };

/** A plain-language problem with a chosen file (not a picture, or too big), or null if it can be read. */
export function checkScreenshotFile(file: { type: string; size: number }): string | null {
  if (!SCREENSHOT_TYPES.includes(file.type)) return "Please use a PNG, JPG or WebP screenshot.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_SCREENSHOT_BYTES) return "That picture is bigger than 10 MB. Try a screenshot of just the class list.";
  return null;
}

/**
 * True when a reading probably went wrong: nothing was found, or the normal class-time parser can't
 * understand one of the lines (shown with a red ✕). Either way, enhanced reading is worth suggesting.
 */
function needsFixing(classText: string): boolean {
  return !classText || parseClassText(classText).errors.length > 0;
}

/** Turns any thrown problem into a message a person can act on. */
function messageFrom(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Something went wrong while reading the screenshot. Try typing the times instead.";
}

/** Reads a screenshot in this browser with Tesseract (way 1 in the file comment). Never throws. */
/**
 * Reads a calendar whose boxes have no times written in them by measuring the boxes (see `calendar-geometry.ts`).
 * Null when the day columns or the time labels can't be found.
 */
function measureBoxes(picture: HTMLCanvasElement, words: OcrWord[]): { classText: string; linesFound: number } | null {
  const found = calendarColumns(words);
  const context = picture.getContext("2d", { willReadFrequently: true });
  if (!found || !context) return null;
  const pixels = context.getImageData(0, 0, picture.width, picture.height).data;
  // The picture is already grayscale, so any one colour channel is the brightness.
  const brightness = (x: number, y: number): number => (x < 0 || y < 0 || x >= picture.width || y >= picture.height ? 255 : pixels[(y * picture.width + x) * 4]);
  const reading = readBoxGeometry(found.columns, words, brightness, picture.width, dayName);
  return reading && reading.linesFound > 0 ? reading : null;
}

export async function readScreenshot(file: File, onProgress: (progress: ReadingProgress) => void): Promise<ReadOutcome> {
  const problem = checkScreenshotFile(file);
  if (problem) return { ok: false, error: problem };
  try {
    onProgress({ label: "Preparing the picture…", fraction: 0 });
    const picture = await prepareScreenshot(file, { enlarge: true });
    const { text, confidence, words } = await readWithTesseract(picture, onProgress);
    // A weekly calendar (day names across the top, boxes below) is read by position; anything else, as plain text.
    let calendar = calendarWordsToClassText(words);
    if (calendar) {
      // A calendar's grey class boxes can make the first reading skip whole columns of text, so it is read a second time
      // with the text made pure black on white, and whichever reading found more classes is kept.
      const second = await readWithTesseract(binarizedCopy(picture, CALENDAR_THRESHOLD), onProgress).catch(() => null);
      const again = second ? calendarWordsToClassText(second.words) : null;
      if (again && again.linesFound > calendar.linesFound) calendar = again;
    }
    if (calendar && calendar.linesFound > 0) {
      const lowConfidence = confidence < LOW_CONFIDENCE || needsFixing(calendar.classText);
      return { ok: true, reading: { classText: calendar.classText, linesFound: calendar.linesFound, lowConfidence } };
    }
    const found = ocrTextToClassText(text);
    if (calendar && found.linesFound === 0) {
      // No times are written in the boxes: measure the boxes against the time labels down the side instead.
      const measured = measureBoxes(picture, words);
      if (measured) return { ok: true, reading: { ...measured, lowConfidence: true, measured: true } };
      return { ok: true, reading: { ...found, lowConfidence: true, note: NO_TIMES_NOTE } };
    }
    return { ok: true, reading: { ...found, lowConfidence: confidence < LOW_CONFIDENCE || needsFixing(found.classText) } };
  } catch (err) {
    return { ok: false, error: messageFrom(err) };
  }
}

/** Reads a screenshot with OCR.space through the Syncro server (way 2 in the file comment). Never throws. */
export async function readScreenshotEnhanced(file: File): Promise<ReadOutcome> {
  const problem = checkScreenshotFile(file);
  if (problem) return { ok: false, error: problem };
  try {
    const picture = await prepareScreenshot(file, { enlarge: false });
    const upload = await shrinkForUpload(picture);
    const reply = await readWithEnhancedReader(upload);
    if ("error" in reply) return { ok: false, error: reply.error };
    const found = ocrTextToClassText(reply.text);
    return { ok: true, reading: { ...found, lowConfidence: needsFixing(found.classText) } };
  } catch (err) {
    return { ok: false, error: messageFrom(err) };
  }
}
