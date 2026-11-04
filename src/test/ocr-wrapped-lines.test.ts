import { describe, expect, it } from "vitest";
import { binarizePixels } from "../features/import/ocr/preprocess";
import { joinWrappedLines, ocrTextToClassText } from "../features/import/ocr/ocr-text";
import { parseClassText } from "../features/scheduling/parser";

/**
 * Tests for the screenshot reader's text clean-up: meetings the picture wrapped over two lines, a
 * calendar's axis labels, and the pure black-and-white step used for calendar pictures. The wrapped text
 * below is a real reading of a phone screenshot of a Workday list, where only 1 of 7 lines was understood.
 */

/** What the class-time reader makes of some screenshot text: how many meetings it found, and how many lines it could not read. */
function understood(rawText: string): { meetings: string[]; problems: number } {
  const found = ocrTextToClassText(rawText);
  const parsed = parseClassText(found.classText);
  return { meetings: parsed.busy.map((b) => `${b.day}|${b.start}-${b.end}`).sort(), problems: parsed.errors.length };
}

const WRAPPED_LIST = `Tuesday/Thursday | 8:00 AM -
9:15 AM SCB 211
Monday/Wednesday | 1:00 PM
1:50 PM | STC 184
Saturday 8:00 AM-9:40 AM
Tuesday/Thursday | 3:00 PM -
3:50 PM | STC 190 v`;

describe("meetings wrapped over two lines", () => {
  it("are joined, whether the first line ends with a dash or lost it entirely", () => {
    expect(joinWrappedLines(["Tuesday/Thursday | 8:00 AM -", "9:15 AM SCB 211"])).toEqual(["Tuesday/Thursday | 8:00 AM - 9:15 AM SCB 211"]);
    expect(joinWrappedLines(["Monday/Wednesday | 1:00 PM", "1:50 PM | STC 184"])).toEqual(["Monday/Wednesday | 1:00 PM - 1:50 PM | STC 184"]);
  });

  it("make a wrapped Workday list read completely (it used to read 1 line of 7)", () => {
    expect(understood(WRAPPED_LIST)).toEqual({
      meetings: ["sat|480-580", "thu|900-950", "thu|480-555", "mon|780-830", "tue|900-950", "tue|480-555", "wed|780-830"].sort(),
      problems: 0,
    });
  });

  it("leave an already complete line alone", () => {
    const lines = ["MWF 9:00 AM - 9:50 AM", "TTh 1:00 PM - 2:15 PM"];
    expect(joinWrappedLines(lines)).toEqual(lines);
  });

  it("never join a calendar's left-hand time labels into a fake class", () => {
    expect(joinWrappedLines(["8:00 AM", "9:00 AM", "10:00 AM"])).toEqual(["8:00 AM", "9:00 AM", "10:00 AM"]);
  });
});

describe("axis labels and form fields are not reported as problems", () => {
  it("a lone time with no day and no dash produces no line at all", () => {
    const labels = `Start Time | 8:00 AM
End Time | 6:00 PM
8:00 AM
9:00 AM
10:00 AM
11:00 AM`;
    expect(ocrTextToClassText(labels)).toEqual({ classText: "", linesFound: 0 });
  });

  it("a broken range that does mention a day is still reported, so nothing is silently lost", () => {
    const found = ocrTextToClassText("Tuesday 8:00 AM - garbled");
    expect(found.linesFound).toBe(1);
    expect(parseClassText(found.classText).errors).toHaveLength(1);
  });
});

describe("the pure black-and-white step", () => {
  it("makes dark pixels black and everything lighter white, and keeps the picture opaque", () => {
    // RGBA: a dark text pixel (40), a grey box pixel (158) and a white cell pixel (255)
    const pixels = new Uint8ClampedArray([40, 40, 40, 255, 158, 158, 158, 255, 255, 255, 255, 255]);
    binarizePixels(pixels, 115);
    expect([...pixels]).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  });

  it("treats the threshold itself as light, and 114 as dark", () => {
    const pixels = new Uint8ClampedArray([114, 114, 114, 255, 115, 115, 115, 255]);
    binarizePixels(pixels, 115);
    expect([...pixels]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});
