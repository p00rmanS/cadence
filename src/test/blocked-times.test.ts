import { describe, expect, it } from "vitest";
import { blockedBySlot, canAssign } from "../features/scheduling/availability";
import { buildDemoData } from "../features/scheduling/demo-data";
import { describeGap, explainSlot, findIssues } from "../features/scheduling/issues";
import { buildBusy } from "../features/scheduling/parser";
import { autoFill } from "../features/scheduling/scheduler";
import { validatePersistedState } from "../features/scheduling/validation";
import { DEFAULT_SETTINGS } from "../features/scheduling/constants";
import { makeSettings, makeStudent, run, slot } from "./testkit";

const settings = makeSettings();

describe("other times a student can't work", () => {
  it("are parsed like class times but tagged as manual", () => {
    const { busy, classes, blocked } = buildBusy("MWF 9:00am-9:50am", "W 2:00pm-4:00pm\nF 12:00-1:00");
    expect(classes.busy).toHaveLength(3);
    expect(blocked.busy).toHaveLength(2);
    expect(busy.filter((b) => b.source === "class")).toHaveLength(3);
    expect(busy.filter((b) => b.source === "manual")).toHaveLength(2);
  });

  it("report their own errors separately from the class list", () => {
    const { classes, blocked } = buildBusy("MWF 9:00am-9:50am", "not a time");
    expect(classes.errors).toEqual([]);
    expect(blocked.errors).toHaveLength(1);
  });

  it("block a slot with 'unavailable', not 'has class'", () => {
    const s = makeStudent({ busy: [{ day: "wed", start: 14 * 60, end: 16 * 60, source: "manual" }] });
    const v = blockedBySlot(s, "wed", 14 * 60, settings);
    expect(v?.code).toBe("unavailable");
    expect(v?.message).toBe("is unavailable on Wed at this time");
    expect(canAssign(s, "wed", 15 * 60, [], settings)?.code).toBe("unavailable");
    expect(canAssign(s, "wed", 16 * 60, [], settings)).toBeNull();
  });

  it("still call a class a class", () => {
    const s = makeStudent({ busy: [{ day: "wed", start: 14 * 60, end: 15 * 60, source: "class" }] });
    expect(blockedBySlot(s, "wed", 14 * 60, settings)?.code).toBe("class_conflict");
  });

  it("are flagged if a shift is later left on top of one", () => {
    const s = makeStudent({ name: "Ana", busy: [{ day: "wed", start: 14 * 60, end: 15 * 60, source: "manual" }] });
    const issues = findIssues([s], run("s1", "wed", 14 * 60, 15 * 60), settings);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "unavailable", overridden: false });
    expect(issues[0].message).toBe("Ana is marked unavailable then: Wed 2:00pm–3:00pm.");
  });

  it("are explained plainly in 'why is this empty' text", () => {
    const s = makeStudent({ name: "Ana", busy: [{ day: "wed", start: 14 * 60, end: 15 * 60, source: "manual" }] });
    expect(explainSlot([s], [], settings, "wed", 14 * 60)[0].text).toBe("not available");
    expect(describeGap([s], [], settings, "wed", 14 * 60)).toBe("Nobody is free: Ana (not available).");
  });

  it("can never be overridden", () => {
    const s = makeStudent({ busy: [{ day: "wed", start: 14 * 60, end: 15 * 60, source: "manual" }] });
    // an "unavailable" slot is a hard block, so it is not one of the two soft limits
    expect(canAssign(s, "wed", 14 * 60, [slot("s1", "mon", 540)], settings)?.code).not.toMatch(/over_/);
  });

  it("are respected by auto-fill", () => {
    const { students } = buildDemoData();
    const leilani = students.find((x) => x.name === "Leilani P.")!;
    expect(leilani.blockedText).toBe("W 2:00pm-4:00pm");
    const r = autoFill(students, [], DEFAULT_SETTINGS);
    expect(r.assignments.some((a) => a.studentId === leilani.id && a.day === "wed" && a.start >= 14 * 60 && a.start < 16 * 60)).toBe(false);
    expect(findIssues(students, r.assignments, DEFAULT_SETTINGS)).toEqual([]);
  });

  it("survive a backup round-trip, and older backups without the field still load", () => {
    const { students } = buildDemoData();
    const state = { version: 1, settings: DEFAULT_SETTINGS, students, assignments: [], selectedStudentId: null, semester: null };
    const ok = validatePersistedState(state);
    expect(ok.ok && ok.value.students.find((x) => x.name === "Leilani P.")?.blockedText).toBe("W 2:00pm-4:00pm");

    const legacy = { ...state, students: students.map(({ blockedText: _drop, ...rest }) => rest) };
    const loaded = validatePersistedState(legacy);
    expect(loaded.ok && loaded.value.students.every((x) => x.blockedText === "")).toBe(true);
  });
});
