import { describe, expect, it } from "vitest";
import { parseRoster } from "../features/scheduling/roster";

describe("parseRoster", () => {
  it("reads 'Name: classes' lines, several classes per student separated by semicolons", () => {
    const r = parseRoster("Noa K.: MWF 9:00am-9:50am; TTh 1:00pm-2:15pm\nKai P.: Tuesday/Thursday 8:00 AM - 9:15 AM");
    expect(r.valid).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ name: "Noa K.", meetings: 5, ok: true, line: 1 });
    expect(r.rows[1]).toMatchObject({ name: "Kai P.", meetings: 2, ok: true, line: 2 });
  });

  it("never mistakes the colon inside a time for the name separator", () => {
    const r = parseRoster("Noa K.: MWF 9:00am-9:50am");
    expect(r.rows[0].name).toBe("Noa K.");
    expect(r.rows[0].classText).toBe("MWF 9:00am-9:50am");
  });

  it("reads tab-separated spreadsheet rows: first cell is the name, the rest are classes", () => {
    const r = parseRoster("Noa K.\tMWF 9:00am-9:50am\tTTh 1:00pm-2:15pm\nKai P.\tMW 1:00pm-2:15pm");
    expect(r.valid.map((x) => [x.name, x.meetings])).toEqual([["Noa K.", 5], ["Kai P.", 2]]);
  });

  it("allows a student with no classes, with a heads-up", () => {
    const r = parseRoster("Noa K.\nKai P.:");
    expect(r.valid.map((x) => x.name)).toEqual(["Noa K.", "Kai P."]);
    expect(r.rows[0].warnings.join(" ")).toMatch(/No class times listed/);
  });

  it("accepts a plain name that happens to contain a digit", () => {
    expect(parseRoster("Student 2").valid[0].name).toBe("Student 2");
  });

  it("refuses class times with the name forgotten, pointing at the line", () => {
    const r = parseRoster("Noa K.: MWF 9:00am-9:50am\nMWF 10:00-10:50\nMWF 10:00");
    expect(r.rows[1]).toMatchObject({ ok: false, line: 2 });
    expect(r.rows[1].errors[0]).toMatch(/Put the name first/);
    expect(r.rows[2].ok).toBe(false);
    expect(r.valid).toHaveLength(1);
  });

  it("reports unreadable class times per student without losing the good ones", () => {
    const r = parseRoster("Noa K.: MWF 9:00am-9:50am\nKai P.: garbled nonsense; TTh 1:00pm-2:15pm");
    expect(r.valid.map((x) => x.name)).toEqual(["Noa K."]);
    expect(r.rows[1].ok).toBe(false);
    expect(r.rows[1].errors[0]).toMatch(/garbled nonsense/);
  });

  it("carries through the 'no am/pm given' warning", () => {
    const r = parseRoster("Noa K.: MWF 9:00-9:50");
    expect(r.rows[0].ok).toBe(true);
    expect(r.rows[0].warnings.join(" ")).toMatch(/No am\/pm given/);
  });

  it("ignores blank lines and # comments, but keeps real line numbers", () => {
    const r = parseRoster("# my roster\n\nNoa K.: MWF 9:00am-9:50am\n\nKai P.: MW 1:00pm-2:15pm");
    expect(r.rows.map((x) => x.line)).toEqual([3, 5]);
  });

  it("warns about repeated names but still allows them", () => {
    const r = parseRoster("Noa K.: MWF 9:00am-9:50am\nnoa k.: TTh 1:00pm-2:15pm");
    expect(r.valid).toHaveLength(2);
    expect(r.rows.every((x) => x.warnings.includes("This name appears more than once."))).toBe(true);
  });

  it("handles Windows line endings and hostile input without throwing", () => {
    expect(parseRoster("Noa K.: MWF 9:00am-9:50am\r\nKai P.: MW 1:00pm-2:15pm\r\n").valid).toHaveLength(2);
    for (const s of ["", "\n\n", ":", "::::", "\t\t\t", "<script>alert(1)</script>", "x".repeat(5000)]) {
      expect(() => parseRoster(s)).not.toThrow();
    }
    expect(parseRoster("x".repeat(5000)).rows[0].ok).toBe(false);
  });

  it("rejects a missing or over-long name", () => {
    expect(parseRoster(": MWF 9:00am-9:50am").rows[0].ok).toBe(false);
    expect(parseRoster(`${"n".repeat(81)}: MWF 9:00am-9:50am`).rows[0].errors[0]).toMatch(/longer than 80/);
  });

  it("stops a paste that would go past the student limit", () => {
    const many = Array.from({ length: 5 }, (_, i) => `S${i}: MWF 9:00am-9:50am`).join("\n");
    expect(parseRoster(many, 198).overall[0]).toMatch(/more than 200/);
    expect(parseRoster(many, 0).overall).toEqual([]);
  });
});

describe("names that contain digits", () => {
  it("still find the separator, because a time's colon has digits on both sides", () => {
    const r = parseRoster("Student 2: MWF 9:00am-9:50am");
    expect(r.valid[0]).toMatchObject({ name: "Student 2", meetings: 3 });
  });
});
