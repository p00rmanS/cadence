import { describe, expect, it } from "vitest";
import { parseShareRoute } from "../app/shareRoute";
import {
  MAX_CODE_LENGTH,
  buildIntakeCode,
  buildShiftsCode,
  codeFromText,
  hoursOfShifts,
  parseIntakeCode,
  parseShiftsCode,
  shiftsLink,
  studentLink,
  studentPageLink,
} from "../features/sharing/links";
import type { NewStudentInput } from "../hooks/useShiftFitStore";
import { makeSettings, makeStudent, run } from "./testkit";

/**
 * Tests for the student links and shift links (`features/sharing/links.ts`, `app/shareRoute.ts`). A link
 * arrives from outside, so these tests treat it like a tampered file: it must round-trip when honest, and
 * be refused or cleaned when broken, oversized, of the wrong kind, or carrying silly values.
 */

const input: NewStudentInput = {
  name: "Noa K.",
  preference: "morning",
  daysPerWeek: 4,
  classText: "MWF 9:00-9:50\nTTh 1:00pm-2:15pm",
  blockedText: "F 12:00-1:00",
  latestEnd: 17 * 60,
  breaks: [{ start: 12 * 60, minutes: 30 }],
  needsOpeningShift: true,
  workDays: ["tue", "thu", "fri"],
  weeklyHours: 12.5,
  earliestStart: 9 * 60,
};

/** Writes any object the way a link does, so tests can build hand-made (even hostile) links. */
function codeOf(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("student links", () => {
  it("carry a student's details and come back exactly, ready for the add-student form", () => {
    const result = parseIntakeCode(buildIntakeCode(input));
    expect(result.ok && result.input).toEqual(input);
    expect(result.ok && result.student.busy.length).toBeGreaterThan(0); // the class times were parsed again
  });

  it("work without any optional preference", () => {
    const plain: NewStudentInput = { name: "Lea P.", preference: "any", daysPerWeek: 5, classText: "MWF 8:00-8:50", blockedText: "", latestEnd: 24 * 60, breaks: [], needsOpeningShift: false };
    const result = parseIntakeCode(buildIntakeCode(plain));
    expect(result.ok && result.input).toMatchObject(plain);
    expect(result.ok && "workDays" in result.input && result.input.workDays).toBeFalsy();
  });

  it("carry names with accents, other alphabets and emoji", () => {
    const result = parseIntakeCode(buildIntakeCode({ ...input, name: "José Ñandú 山田 🌺" }));
    expect(result.ok && result.input.name).toBe("José Ñandú 山田 🌺");
  });

  it("refuse anything that is not a student link", () => {
    for (const bad of ["", "not a link", "!!!!", "eyJ", codeOf([1, 2]), codeOf("text"), codeOf({ kind: "shifts", v: 1 }), codeOf({ kind: "intake", v: 2, name: "x" }), codeOf(null)]) {
      expect(parseIntakeCode(bad).ok, bad).toBe(false);
    }
  });

  it("refuse silly values and a missing name, saying only that the link doesn't look right", () => {
    const base = { kind: "intake", v: 1, name: "Noa K.", classText: "MWF 9:00-9:50", preference: "any", daysPerWeek: 4, latestEnd: 1020, breaks: [], needsOpeningShift: false };
    const mistakes: object[] = [{ name: "" }, { name: "x".repeat(200) }, { daysPerWeek: 99 }, { latestEnd: -1 }, { weeklyHours: 500 }, { workDays: ["funday"] }, { earliestStart: 99999 }, { breaks: [{ start: -5, minutes: 30 }] }];
    for (const mistake of mistakes) {
      const result = parseIntakeCode(codeOf({ ...base, ...mistake }));
      expect(result.ok, JSON.stringify(mistake)).toBe(false);
      expect(!result.ok && result.error).toMatch(/doesn't look right/);
    }
    expect(parseIntakeCode(codeOf(base)).ok).toBe(true); // the unchanged example is fine
  });

  it("clean hidden characters out of the name, and keep script-like text as plain text", () => {
    const code = codeOf({ kind: "intake", v: 1, name: "Noa\u0000\u0007 <script>alert(1)</script>", classText: "MWF 9:00-9:50", preference: "any", daysPerWeek: 4, latestEnd: 1020, breaks: [], needsOpeningShift: false });
    const result = parseIntakeCode(code);
    // the two hidden characters became spaces; the tag-like text is kept as ordinary letters (it is never shown as page code)
    expect(result.ok && result.input.name).toBe("Noa   <script>alert(1)</script>");
    expect(result.ok && /[\u0000-\u001f]/.test(result.input.name)).toBe(false);
  });

  it("refuse a link that is too long", () => {
    expect(parseIntakeCode("A".repeat(MAX_CODE_LENGTH + 1)).ok).toBe(false);
  });

  it("drop unknown extra fields instead of keeping them", () => {
    const code = codeOf({ kind: "intake", v: 1, name: "Noa K.", classText: "", preference: "any", daysPerWeek: 3, latestEnd: 1440, breaks: [], needsOpeningShift: false, isAdmin: true, avatar: "javascript:alert(1)" });
    const result = parseIntakeCode(code);
    expect(result.ok && Object.keys(result.input)).not.toContain("isAdmin");
    expect(result.ok && result.student.avatar).toBeUndefined();
  });
});

describe("shift links", () => {
  const settings = makeSettings();
  const student = makeStudent({ id: "s1", name: "Noa K." });
  const semester = { startDate: "2026-08-24", endDate: "2026-12-11", timeZone: "Pacific/Honolulu", skipDates: ["2026-09-07"] };
  const assignments = [...run("s1", "mon", 9 * 60, 12 * 60), ...run("s1", "wed", 13 * 60, 15 * 60), ...run("s2", "tue", 9 * 60, 12 * 60)];

  it("carry only that student's shifts, merged into whole shifts, plus the semester dates", () => {
    const parsed = parseShiftsCode(buildShiftsCode(student, assignments, settings, semester));
    expect(parsed.ok && parsed.shared.name).toBe("Noa K.");
    expect(parsed.ok && parsed.shared.shifts).toEqual([{ day: "mon", start: 540, end: 720 }, { day: "wed", start: 780, end: 900 }]);
    expect(parsed.ok && parsed.shared.semester).toEqual(semester);
    expect(parsed.ok && hoursOfShifts(parsed.shared.shifts)).toBe(5);
  });

  it("work without semester dates, and remember a break schedule", () => {
    const parsed = parseShiftsCode(buildShiftsCode(student, assignments, makeSettings({ term: "break" }), null));
    expect(parsed.ok && parsed.shared.semester).toBeNull();
    expect(parsed.ok && parsed.shared.term).toBe("break");
  });

  it("never contain another student's name or shifts", () => {
    const code = buildShiftsCode(student, assignments, settings, semester);
    const text = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    expect(text).not.toContain("s2");
    expect(text).not.toContain("Lea");
  });

  it("refuse anything that is not a shift link, or has silly shifts or dates", () => {
    const base = { kind: "shifts", v: 1, name: "Noa K.", term: "semester", shifts: [{ day: "mon", start: 540, end: 720 }], semester: null };
    expect(parseShiftsCode(codeOf(base)).ok).toBe(true);
    const mistakes: object[] = [
      { shifts: [{ day: "sun", start: 540, end: 720 }] },
      { shifts: [{ day: "mon", start: 720, end: 540 }] },
      { shifts: [{ day: "mon", start: -1, end: 60 }] },
      { shifts: [{ day: "mon", start: 0, end: 5000 }] },
      { shifts: [{ day: "mon", start: 1.5, end: 60 }] },
      { shifts: [null] },
      { shifts: "many" },
      { shifts: Array.from({ length: 101 }, () => ({ day: "mon", start: 540, end: 600 })) },
      { name: 5 },
      { semester: { startDate: "tomorrow", endDate: "later", timeZone: "Mars/Base" } },
    ];
    for (const mistake of mistakes) expect(parseShiftsCode(codeOf({ ...base, ...mistake })).ok, JSON.stringify(mistake).slice(0, 60)).toBe(false);
    for (const bad of ["", "x", codeOf({ kind: "intake", v: 1 }), "A".repeat(MAX_CODE_LENGTH + 1)]) expect(parseShiftsCode(bad).ok).toBe(false);
  });
});

describe("pasting a link", () => {
  const code = buildIntakeCode(input);

  it("finds the link text in a whole link, in just the part after the #, or on its own", () => {
    expect(codeFromText(`https://p00rmans.github.io/cadence/#/add/${code}`)).toBe(code);
    expect(codeFromText(`#/add/${code}`)).toBe(code);
    expect(codeFromText(code)).toBe(code);
    expect(codeFromText(`  ${code}\n`)).toBe(code);
  });

  it("copes with a long link an email wrapped over several lines, and with words around it", () => {
    const wrapped = code.replace(/(.{40})/g, "$1\n");
    expect(codeFromText(`Here you go: https://site.example/cadence/#/add/${wrapped} thanks!`.replace("thanks!", ""))).toBe(code);
    expect(codeFromText(`https://site.example/cadence/#/shifts/${code}`)).toBe(code);
  });

  it("gives nothing for text with no link in it, even plain words that would look like a code with the spaces removed", () => {
    expect(codeFromText("hello there, no link here")).toBe("");
    expect(codeFromText("just some words")).toBe("");
    expect(codeFromText("")).toBe("");
  });

  it("still accepts a bare code that an email wrapped over several lines", () => {
    expect(codeFromText(code.replace(/(.{30})/g, "$1\n"))).toBe(code);
  });
});

describe("the links themselves and which screen they open", () => {
  const here = { origin: "https://p00rmans.github.io" };

  it("are built from the site's address, with the part after the # holding the details", () => {
    expect(studentPageLink(here)).toBe("https://p00rmans.github.io/#/send");
    expect(studentLink("ABC_-9", here)).toBe("https://p00rmans.github.io/#/add/ABC_-9");
    expect(shiftsLink("ABC_-9", here)).toBe("https://p00rmans.github.io/#/shifts/ABC_-9");
  });

  it("are read back to the right screen", () => {
    expect(parseShareRoute("#/send")).toEqual({ kind: "send" });
    expect(parseShareRoute("#/send/")).toEqual({ kind: "send" });
    expect(parseShareRoute("#/shifts/abc-DEF_123")).toEqual({ kind: "shifts", code: "abc-DEF_123" });
    expect(parseShareRoute("#/add/abc")).toEqual({ kind: "add", code: "abc" });
  });

  it("leave everything else to the normal app", () => {
    for (const hash of ["", "#", "#/", "#/other", "#/add/", "#/add/has space", "#/add/a/b", "#/shifts", "#send", "#/SEND", "#/add/<script>"]) {
      expect(parseShareRoute(hash), hash).toBeNull();
    }
  });
});
