import { describe, expect, it } from "vitest";
import { buildStudentIcs } from "../features/calendar/ics";
import { buildDemoData } from "../features/scheduling/demo-data";
import { evaluateSchedule } from "../features/scheduling/evaluate";
import { autoFill } from "../features/scheduling/scheduler";
import type { SemesterConfig } from "../features/scheduling/types";
import { buildPublishRequest } from "../services/automation/contracts";
import { makeSettings } from "./testkit";

/**
 * Whole-week checks for both schedules (Semester and Break): whatever auto-fill produces must pass
 * the rules and turn into calendar times that are real (no "24:00"), including shifts ending at midnight.
 */

const semester: SemesterConfig = { startDate: "2026-08-31", endDate: "2026-12-11", timeZone: "Pacific/Honolulu" };
const NOW = new Date("2026-08-01T12:00:00Z");

describe.each(["semester", "break"] as const)("%s schedule -> calendar", (term) => {
  const settings = makeSettings({ term });
  const { students } = buildDemoData();
  const { assignments } = autoFill(students, [], settings);

  it("passes every rule", () => {
    expect(evaluateSchedule(students, assignments, settings).ok).toBe(true);
  });

  it("builds a publish request whose times are all real clock times", () => {
    const request = buildPublishRequest(students, assignments, settings, semester);
    expect(request.events.length).toBeGreaterThan(0);
    for (const event of request.events) {
      for (const iso of [event.recurrence?.startIso, event.recurrence?.endIso, ...(event.recurrence?.exdates ?? [])]) {
        if (iso) expect(iso, iso).toMatch(/T(0\d|1\d|2[0-3]):[0-5]\d:00$/);
      }
    }
  });

  it("builds .ics files with no hour 24", () => {
    for (const student of students) {
      expect(buildStudentIcs(student, assignments, semester, settings.slotMinutes, NOW)).not.toMatch(/T24\d{4}/);
    }
  });
});
