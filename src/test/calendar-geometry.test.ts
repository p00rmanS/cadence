import { describe, expect, it } from "vitest";
import {
  clockText,
  findBoxes,
  fitTimeAxis,
  pageBackground,
  readBoxGeometry,
  snapToClassTimes,
  timeLabelsFromWords,
} from "../features/import/ocr/calendar-geometry";
import { calendarColumns, dayName } from "../features/import/ocr/calendar-layout";
import type { OcrWord } from "../features/import/ocr/calendar-layout";
import { parseClassText } from "../features/scheduling/parser";

/**
 * Tests for reading a calendar whose class boxes have no times written in them, by measuring the boxes
 * against the time labels down the side (`ocr/calendar-geometry.ts`). Everything is made-up numbers and
 * pixels. The "real picture" test reproduces the measurements taken from a real Workday course calendar (a
 * 2000-pixel-wide enlargement: 116 pixels per hour, boxes found at the heights listed), whose true times were
 * known from the same student's Workday list.
 */

/** A word centred at `cx`, `y` pixels from the top (10 px per letter, 30 px tall). */
function word(text: string, cx: number, y: number): OcrWord {
  const half = (text.length * 10) / 2;
  return { text, x0: cx - half, x1: cx + half, y0: y, y1: y + 30 };
}

describe("timeLabelsFromWords", () => {
  const LEFT_EDGE = 300;

  it("reads '7 AM' as two words, '12PM' as one and '7:00 AM' with minutes", () => {
    const words = [
      word("7", 130, 700), word("AM", 170, 700),
      word("12PM", 150, 1300),
      word("3:00", 130, 1600), word("PM", 175, 1600),
    ];
    expect(timeLabelsFromWords(words, LEFT_EDGE).map((l) => l.minutes)).toEqual([7 * 60, 12 * 60, 15 * 60]);
  });

  it("puts each label at the middle of its own height, and ignores words right of the first column", () => {
    const labels = timeLabelsFromWords([word("9AM", 150, 900), word("10AM", 900, 900)], LEFT_EDGE);
    expect(labels).toEqual([{ minutes: 9 * 60, y: 915 }]);
  });

  it("ignores numbers that are not hours", () => {
    expect(timeLabelsFromWords([word("13", 130, 100), word("AM", 170, 100), word("0AM", 150, 200), word("May", 150, 300)], LEFT_EDGE)).toEqual([]);
  });
});

describe("fitTimeAxis", () => {
  // 7 AM at y = 742 and 116 pixels per hour, like the real picture
  const at = (hour: number) => ({ minutes: hour * 60, y: 742 + 116 * (hour - 7) });

  it("gives the time at any height, even with labels missing", () => {
    const axis = fitTimeAxis([at(7), at(9), at(12), at(16), at(18)]);
    expect(axis?.pixelsPerHour).toBeCloseTo(116, 1);
    // the label sits a little below its line, so the 8:00 line is a few pixels above where the 8 AM label would be
    const eight = axis!.minutesAt(742 + 116);
    expect(eight).toBeGreaterThan(8 * 60);
    expect(eight).toBeLessThan(8 * 60 + 5);
  });

  it("drops a misread label that is far off the line and still fits", () => {
    const axis = fitTimeAxis([at(7), at(8), at(9), at(10), { minutes: 15 * 60, y: at(11).y }, at(12)]);
    expect(axis?.pixelsPerHour).toBeCloseTo(116, 0);
  });

  it("needs three labels that run downward", () => {
    expect(fitTimeAxis([at(7), at(8)])).toBeNull();
    expect(fitTimeAxis([at(9), at(8), at(7)].map((l, i) => ({ ...l, y: 100 + i * 50 })))).toBeNull(); // later hours higher up
    expect(fitTimeAxis([])).toBeNull();
  });
});

describe("findBoxes", () => {
  /** A white page (255) with grey boxes (232) drawn at the given x range and heights, plus a 1-pixel grid line. */
  function page(boxes: { left: number; right: number; top: number; bottom: number }[], gridY: number[] = []) {
    return (x: number, y: number): number => {
      if (boxes.some((b) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom)) return 232;
      return gridY.includes(y) ? 235 : 255;
    };
  }
  const column = { left: 400, right: 600 };

  it("finds each tall run, ignoring thin grid lines", () => {
    const brightness = page([{ left: 405, right: 595, top: 300, bottom: 420 }, { left: 405, right: 595, top: 700, bottom: 790 }], [100, 200, 500, 600]);
    expect(findBoxes(brightness, column, 0, 1000, 255, 116)).toEqual([{ top: 300, bottom: 420 }, { top: 700, bottom: 790 }]);
  });

  it("ignores a short mark that is not a class box", () => {
    expect(findBoxes(page([{ left: 405, right: 595, top: 300, bottom: 315 }]), column, 0, 1000, 255, 116)).toEqual([]);
  });

  it("keeps back-to-back boxes apart when there is a gap between them", () => {
    const brightness = page([{ left: 405, right: 595, top: 300, bottom: 400 }, { left: 405, right: 595, top: 403, bottom: 500 }]);
    expect(findBoxes(brightness, column, 0, 1000, 255, 116)).toHaveLength(2);
  });

  it("only looks inside its own column", () => {
    const brightness = page([{ left: 605, right: 800, top: 300, bottom: 500 }]);
    expect(findBoxes(brightness, column, 0, 1000, 255, 116)).toEqual([]);
  });

  it("works on a page that is not white, by comparing with the page's own colour", () => {
    const grey = (x: number, y: number) => (x >= 405 && x <= 595 && y >= 300 && y <= 420 ? 150 : 240);
    expect(pageBackground(grey, 1000, 0, 1000)).toBe(240);
    expect(findBoxes(grey, column, 0, 1000, 240, 116)).toEqual([{ top: 300, bottom: 420 }]);
  });
});

describe("snapToClassTimes", () => {
  it("snaps a start to the nearest quarter hour when it is close, and the length to a common class length", () => {
    expect(snapToClassTimes(7 * 60 + 56, 9 * 60 + 5)).toEqual({ start: 8 * 60, end: 8 * 60 + 75 }); // 8:00 - 9:15
    expect(snapToClassTimes(13 * 60 + 1, 13 * 60 + 54)).toEqual({ start: 13 * 60, end: 13 * 60 + 50 }); // 1:00 - 1:50
    expect(snapToClassTimes(8 * 60 + 2, 9 * 60 + 41)).toEqual({ start: 8 * 60, end: 8 * 60 + 100 }); // 8:00 - 9:40
  });

  it("keeps a start that is not near a quarter hour to the nearest 5 minutes, and an unusual length to the nearest 5", () => {
    expect(snapToClassTimes(9 * 60 + 8, 9 * 60 + 8 + 21)).toEqual({ start: 9 * 60 + 10, end: 9 * 60 + 30 });
  });
});

describe("clockText", () => {
  it("writes minutes after midnight the way the class-time reader understands", () => {
    expect(clockText(0)).toBe("12:00 AM");
    expect(clockText(555)).toBe("9:15 AM");
    expect(clockText(12 * 60)).toBe("12:00 PM");
    expect(clockText(15 * 60 + 50)).toBe("3:50 PM");
    expect(parseClassText(`Tuesday ${clockText(480)}-${clockText(555)}`).busy).toEqual([{ day: "tue", start: 480, end: 555, source: "class" }]);
  });
});

describe("a whole calendar picture measured from its boxes", () => {
  // The real picture, as numbers: day names at these x positions, time labels 116 px apart, and boxes at these heights.
  const HEADER_Y = 440;
  const centers = { sun: 359, mon: 587, tue: 814, wed: 1042, thu: 1270, fri: 1497, sat: 1725 } as const;
  const names = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" } as const;
  const header = (Object.keys(centers) as (keyof typeof centers)[]).map((d) => word(names[d], centers[d], HEADER_Y));
  const labelY = (hour: number) => 727 + 116 * (hour - 7); // top of the word; its middle is 15 px lower
  const labels = [7, 9, 10, 11, 12, 14, 16, 17].flatMap((hour) => {
    const text = `${((hour + 11) % 12) + 1}${hour < 12 ? "AM" : "PM"}`;
    return [word(text, 150, labelY(hour))];
  });
  const boxesAt: Record<string, [number, number][]> = {
    mon: [[1436, 1539]], wed: [[1436, 1539]], tue: [[851, 984], [1670, 1773]], thu: [[851, 984], [1670, 1773]], sat: [[851, 1042]],
  };
  const brightness = (x: number, y: number): number => {
    for (const [day, runs] of Object.entries(boxesAt)) {
      const left = centers[day as keyof typeof centers] - 113;
      if (x >= left + 5 && x <= left + 222 && runs.some(([top, bottom]) => y >= top && y <= bottom)) return 232;
    }
    return 255;
  };

  it("finds the day columns and gives the same times the Workday list had", () => {
    const found = calendarColumns([...header, ...labels]);
    expect(found?.columns.map((c) => c.day)).toEqual(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
    const reading = readBoxGeometry(found!.columns, [...header, ...labels], brightness, 2000, dayName);
    expect(reading?.classText.split("\n").sort()).toEqual(
      [
        "Monday 1:00 PM-1:50 PM",
        "Wednesday 1:00 PM-1:50 PM",
        "Tuesday 8:00 AM-9:15 AM",
        "Thursday 8:00 AM-9:15 AM",
        "Tuesday 3:00 PM-3:50 PM",
        "Thursday 3:00 PM-3:50 PM",
        "Saturday 8:00 AM-9:40 AM",
      ].sort(),
    );
    expect(parseClassText(reading?.classText ?? "").errors).toEqual([]);
  });

  it("gives up (null) when the time labels cannot be read, instead of guessing", () => {
    const found = calendarColumns(header);
    expect(readBoxGeometry(found!.columns, header, brightness, 2000, dayName)).toBeNull();
  });
});
