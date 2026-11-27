/**
 * ============================================================================
 *  TESTS: CLEANING CLASS TIMES COPIED FROM A SCHOOL SCHEDULE PAGE
 * ============================================================================
 * A manager's fastest way to enter classes is to copy them from the school's page and paste. The copied rows
 * carry course names, rooms and teachers around the times, which the class-times box used to refuse. These tests
 * protect two things at once: copied rows now work, and NOTHING IS EVER DROPPED SILENTLY (a typo like
 * "garbled nonsense" must still be flagged, and anything left out of a spreadsheet row must be listed).
 */
import { describe, expect, it } from "vitest";
import { cleanPastedClassText, cleanTableCells } from "../features/import/paste-clean";
import { parseClassText } from "../features/scheduling/parser";
import { parseRoster } from "../features/scheduling/roster";

const WORKDAY_ROW_1 = "ENGL 101 - College Writing\tENGL 101-03\tLecture\tMWF | 9:00 AM - 9:50 AM | GCB 112\tPat Example";
const WORKDAY_ROW_2 = "MATH 110 - College Algebra\tMATH 110-01\tLecture\tTTh | 1:00 PM - 2:15 PM | SCB 211\tSam Sample";

describe("cleanPastedClassText (text pasted into the class-times box)", () => {
  it("cuts a copied table row down to just the class time", () => {
    const cleaned = cleanPastedClassText(WORKDAY_ROW_1);
    expect(cleaned?.classText).toBe("MWF 9:00 AM-9:50 AM");
    expect(cleaned?.linesFound).toBe(1);
  });

  it("cleans several rows at once, in order", () => {
    const cleaned = cleanPastedClassText(`${WORKDAY_ROW_1}\n${WORKDAY_ROW_2}`);
    expect(cleaned?.classText).toBe("MWF 9:00 AM-9:50 AM\nTTh 1:00 PM-2:15 PM");
    expect(parseClassText(cleaned!.classText).errors).toEqual([]);
  });

  it("handles rows written with spaces instead of tabs (course name, times, room)", () => {
    const cleaned = cleanPastedClassText("BUS 201 Principles of Accounting  MWF 10:00 AM - 10:50 AM  Room GCB 120");
    expect(cleaned?.classText).toBe("MWF 10:00 AM-10:50 AM");
  });

  it("leaves text that already reads fine exactly as it is (returns nothing to change)", () => {
    expect(cleanPastedClassText("MWF 9:00-9:50\nTTh 1:00pm-2:15pm")).toBeNull();
    expect(cleanPastedClassText("MWF | 9:00 AM - 9:50 AM | GCB 112")).toBeNull();
  });

  it("never drops a line that has no class time: a typo stays in place so it is still flagged", () => {
    const cleaned = cleanPastedClassText(`${WORKDAY_ROW_1}\ngarbled nonsense`);
    expect(cleaned?.classText).toBe("MWF 9:00 AM-9:50 AM\ngarbled nonsense");
    expect(parseClassText(cleaned!.classText).errors.join(" ")).toMatch(/garbled nonsense/);
  });

  it("does nothing when no line has a time range to clean (a plain typo is not 'cleaned' away)", () => {
    expect(cleanPastedClassText("MWF 9:00-9:50\ngarbled nonsense")).toBeNull();
    expect(cleanPastedClassText("garbled nonsense")).toBeNull();
  });

  it("keeps a line that looks like a time but cannot be read, so it is flagged for fixing", () => {
    const cleaned = cleanPastedClassText(`${WORKDAY_ROW_1}\nMWF 9:0x`);
    expect(cleaned?.classText.split("\n")).toContain("MWF 9:0x");
  });
});

describe("cleanTableCells (cells of a pasted spreadsheet row)", () => {
  it("keeps the class cell, and lists every cell it left out (course, section, format, teacher)", () => {
    const cells = cleanTableCells(["ENGL 101 - College Writing", "ENGL 101-03", "Lecture", "MWF | 9:00 AM - 9:50 AM | GCB 112", "Pat Example"]);
    // This pattern ("days | times | room") is already understood by the class-times reader, so it is kept as it is.
    expect(cells.classText).toBe("MWF | 9:00 AM - 9:50 AM | GCB 112");
    expect(cells.leftOut).toEqual(["ENGL 101 - College Writing", "ENGL 101-03", "Lecture", "Pat Example"]);
  });

  it("cuts a cell where the time sits inside other words down to the class time", () => {
    const cells = cleanTableCells(["BUS 201 Principles of Accounting  MWF 10:00 AM - 10:50 AM  Room GCB 120"]);
    expect(cells.classText).toBe("MWF 10:00 AM-10:50 AM");
    expect(cells.leftOut).toEqual([]);
  });

  it("keeps cells that already read fine, joined with semicolons", () => {
    const cells = cleanTableCells(["MWF 9:00-9:50", "TTh 1:00pm-2:15pm"]);
    expect(cells.classText).toBe("MWF 9:00-9:50; TTh 1:00pm-2:15pm");
    expect(cells.leftOut).toEqual([]);
  });

  it("keeps a cell that looks like a time but cannot be read, instead of leaving it out", () => {
    const cells = cleanTableCells(["MWF 9:00-", "Seminar"]);
    expect(cells.classText).toBe("MWF 9:00-");
    expect(cells.leftOut).toEqual(["Seminar"]);
  });

  it("ignores empty cells", () => {
    expect(cleanTableCells(["", "  ", "MWF 9:00-9:50"]).classText).toBe("MWF 9:00-9:50");
  });
});

describe("adding several students at once with rows copied from a school page", () => {
  it("accepts a tab-separated row with course names around the times, and says what it left out", () => {
    const row = `Noa K.\t${WORKDAY_ROW_1.split("\t").slice(0, 2).join("\t")}\tLecture\tMWF | 9:00 AM - 9:50 AM | GCB 112\tPat Example`;
    const roster = parseRoster(row);
    expect(roster.rows[0].ok).toBe(true);
    expect(roster.rows[0].name).toBe("Noa K.");
    expect(roster.rows[0].classText).toBe("MWF | 9:00 AM - 9:50 AM | GCB 112");
    expect(roster.rows[0].meetings).toBe(3);
    expect(roster.rows[0].warnings.join(" ")).toMatch(/Left out \(not class times\).*ENGL 101 - College Writing.*Pat Example/);
  });

  it("still flags a typo in the 'Name: classes' form (that form is never cleaned)", () => {
    const roster = parseRoster("Kai P.: garbled nonsense; TTh 1:00pm-2:15pm");
    expect(roster.valid).toEqual([]);
    expect(roster.rows[0].errors[0]).toMatch(/garbled nonsense/);
  });

  it("leaves an ordinary spreadsheet row exactly as before", () => {
    const roster = parseRoster("Noa K.\tMWF 9:00am-9:50am\tTTh 1:00pm-2:15pm");
    expect(roster.rows[0].ok).toBe(true);
    expect(roster.rows[0].meetings).toBe(5);
    expect(roster.rows[0].warnings.join(" ")).not.toMatch(/Left out/);
  });
});
