import { describe, expect, it } from "vitest";
import { parseClassText } from "../features/scheduling/parser";

/**
 * A table of the many ways people really write class times (short forms, spelled-out days, registration
 * exports with a course name and room around the time, several meetings on one line). Each line must give
 * exactly the right busy blocks, so a manager's pasted text is never half-read without a warning. Times
 * are minutes after midnight (540 = 9:00am). Added after a check found that "M 9:00AM-9:50AM, W 9:00AM-9:50AM"
 * kept only Monday and said nothing, and that a course code in front made a line unreadable.
 */

/** The meetings a pasted text produced, as sorted "day|start-end" strings. */
function read(text: string): string[] {
  return parseClassText(text)
    .busy.map((b) => `${b.day}|${b.start}-${b.end}`)
    .sort();
}

const MWF_9 = ["fri|540-590", "mon|540-590", "wed|540-590"];
const TTH_1 = ["thu|780-855", "tue|780-855"];

describe("the usual short and long forms", () => {
  it.each([
    ["MWF 9:00-9:50", MWF_9],
    ["MWF 9:00 AM - 9:50 AM", MWF_9],
    ["MWF 9:00am-9:50am", MWF_9],
    ["M/W/F 9:00 AM to 9:50 AM", MWF_9],
    ["Mon, Wed, Fri 9:00-9:50", MWF_9],
    ["Monday Wednesday Friday 9:00 AM - 9:50 AM", MWF_9],
    ["MWF 9:00–9:50", MWF_9],
    ["MWF 9 AM - 9:50 AM", MWF_9],
    ["TTh 1:00pm-2:15pm", TTH_1],
    ["TR 1:00 PM - 2:15 PM", TTH_1],
    ["Tue/Thu 1:00-2:15 PM", TTH_1],
    ["Tu Th 13:00-14:15", TTH_1],
    ["F 8-9", ["fri|480-540"]],
    ["W 3-4:50pm", ["wed|900-1010"]],
    ["Sat 10:00 AM - 12:00 PM", ["sat|600-720"]],
    ["MTWThF 8:00-8:50", ["fri|480-530", "mon|480-530", "thu|480-530", "tue|480-530", "wed|480-530"]],
    ["Mon 9:00 a.m. - 9:50 a.m.", ["mon|540-590"]],
  ])("%s", (text, expected) => {
    expect(read(text)).toEqual(expected);
  });
});

describe("several meetings on one line are all kept (none silently dropped)", () => {
  it("splits at a comma that starts a new meeting", () => {
    expect(read("M 9:00AM-9:50AM, W 9:00AM-9:50AM")).toEqual(["mon|540-590", "wed|540-590"]);
    expect(read("M 9:00-9:50, W 9:00-9:50, F 9:00-9:50")).toEqual(MWF_9);
    expect(read("MW 9:00-9:50, TTh 1:00pm-2:15pm")).toEqual([...MWF_9.filter((m) => !m.startsWith("fri")), ...TTH_1].sort());
  });

  it("does not split the commas inside a list of days, or before a room name", () => {
    expect(parseClassText("Mon, Wed, Fri 9:00-9:50").lines).toHaveLength(1);
    expect(parseClassText("MWF 9:00-9:50, Room 214").lines).toHaveLength(1);
    expect(read("MWF 9:00-9:50, Room 214")).toEqual(MWF_9);
  });
});

describe("a course name or code around the meeting", () => {
  it.each([
    ["BIOL 101 MWF 9:00 AM - 9:50 AM", MWF_9],
    ["BIOL 101 - Intro | MWF | 9:00 AM - 9:50 AM | Room 214", MWF_9],
    ["MWF 9:00 AM - 9:50 AM Room 214 Prof. Kahale", MWF_9],
    ["CS 101 TTh 1:00pm-2:15pm", TTH_1],
    ["ENG 201 - Writing | Tuesday/Thursday | 1:00 PM - 2:15 PM | SCB 211", TTH_1],
  ])("%s", (text, expected) => {
    expect(read(text)).toEqual(expected);
  });

  it("never mistakes a day group followed by a time for a course code", () => {
    expect(read("MWF 10:00-10:50")).toEqual(["fri|600-650", "mon|600-650", "wed|600-650"]);
    expect(read("TTh 11:30-12:45")).toEqual(["thu|690-765", "tue|690-765"]);
  });

  it("still skips an online course, with or without a code in front, and blocks nothing", () => {
    for (const text of ["Online - Asynchronous", "TBA", "BIOL 101 Online - Asynchronous"]) {
      const result = parseClassText(text);
      expect(result.busy, text).toEqual([]);
      expect(result.errors, text).toEqual([]);
    }
  });
});

describe("lines that cannot be read are flagged, never guessed", () => {
  it.each(["MWF 9:00-8:50", "MWF 25:00-26:00", "Sunday 10:00-11:00", "MWF 0900-0950", "hello there"])("%s", (text) => {
    const result = parseClassText(text);
    expect(result.busy).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});
