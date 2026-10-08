import { beforeEach, describe, expect, it } from "vitest";
import {
  BACKUP_REMINDER_DAYS,
  describeLastBackup,
  fingerprint,
  isBackupDue,
  readLastBackup,
  recordBackup,
  subscribeToBackups,
} from "../features/persistence/backupStatus";
import type { ScheduleContent } from "../features/persistence/backupStatus";
import { DEFAULT_SETTINGS } from "../features/scheduling/constants";
import { buildDemoData } from "../features/scheduling/demo-data";
import { nextStep } from "../features/scheduling/guidance";
import { makeSettings, makeStudent, run } from "./testkit";

/**
 * Tests for backup tracking (`features/persistence/backupStatus.ts`). With no database, a backup file
 * is the only copy of a schedule outside the browser, so the app must remind the manager when the
 * schedule changed since the last backup, and must never nag about an empty or untouched sample one.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 1, 12);

/** A small real schedule: one student with a two-hour Monday shift. */
const mine: ScheduleContent = {
  settings: makeSettings(),
  students: [makeStudent({ id: "s1", name: "Noa K." })],
  assignments: run("s1", "mon", 540, 660),
  semester: null,
};

beforeEach(() => window.localStorage.clear());

describe("fingerprint", () => {
  it("is the same for the same schedule and changes when anything in it changes", () => {
    expect(fingerprint(mine)).toBe(fingerprint({ ...mine }));
    expect(fingerprint(mine)).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprint({ ...mine, assignments: run("s1", "mon", 540, 690) })).not.toBe(fingerprint(mine));
    expect(fingerprint({ ...mine, students: [makeStudent({ id: "s1", name: "Noa P." })] })).not.toBe(fingerprint(mine));
  });
});

describe("when a backup reminder is due", () => {
  it("never for an empty schedule or the untouched sample students", () => {
    expect(isBackupDue({ ...mine, students: [], assignments: [] }, null, NOW)).toBe(false);
    const demo = buildDemoData();
    expect(isBackupDue({ settings: DEFAULT_SETTINGS, students: demo.students, assignments: demo.assignments, semester: null }, null, NOW)).toBe(false);
  });

  it("right away for real work that has never been backed up", () => {
    expect(isBackupDue(mine, null, NOW)).toBe(true);
  });

  it("not while the last backup matches the schedule, however old it is", () => {
    const record = { at: NOW - 100 * DAY, fingerprint: fingerprint(mine) };
    expect(isBackupDue(mine, record, NOW)).toBe(false);
  });

  it("after changes, only once the last backup is a week old", () => {
    const changed = { ...mine, assignments: run("s1", "tue", 540, 660) };
    const fresh = { at: NOW - (BACKUP_REMINDER_DAYS - 1) * DAY, fingerprint: fingerprint(mine) };
    const stale = { at: NOW - BACKUP_REMINDER_DAYS * DAY, fingerprint: fingerprint(mine) };
    expect(isBackupDue(changed, fresh, NOW)).toBe(false);
    expect(isBackupDue(changed, stale, NOW)).toBe(true);
  });
});

describe("remembering backups in this browser", () => {
  it("records a backup, tells listening screens, and reads it back", () => {
    let told = 0;
    const stop = subscribeToBackups(() => told++);
    recordBackup(mine, NOW);
    stop();
    expect(told).toBe(1);
    expect(readLastBackup()).toEqual({ at: NOW, fingerprint: fingerprint(mine) });
    expect(isBackupDue(mine, readLastBackup(), NOW)).toBe(false);
  });

  it("treats a broken or hand-edited record as 'no backup' (the safe side: one extra reminder)", () => {
    for (const bad of ["not json", '{"at":"yesterday","fingerprint":"x"}', '{"fingerprint":"x"}', "null"]) {
      window.localStorage.setItem("shiftfit:lastBackup", bad);
      expect(readLastBackup(), bad).toBeNull();
    }
  });

  it("says when the last backup was in plain words", () => {
    expect(describeLastBackup(null, NOW)).toBe("never");
    expect(describeLastBackup({ at: NOW - 1000, fingerprint: "x" }, NOW)).toBe("today");
    expect(describeLastBackup({ at: NOW - DAY, fingerprint: "x" }, NOW)).toBe("yesterday");
    expect(describeLastBackup({ at: NOW - 5 * DAY, fingerprint: "x" }, NOW)).toBe("5 days ago");
  });
});

describe("the next-step banner", () => {
  const done = { studentCount: 3, shiftCount: 40, blockingIssues: 0, gapSlots: 0, studentsBelowTarget: 0 };

  it("asks for a backup when one is due, once the schedule works", () => {
    const step = nextStep({ ...done, backupDue: true });
    expect(step.title).toBe("Save a backup of this schedule");
    expect(step.body).toMatch(/only kept in this browser/);
    expect(step.action?.kind).toBe("save-share");
    expect(nextStep({ ...done, backupDue: false }).title).toMatch(/Looks great/);
  });

  it("still puts broken rules and empty hours first", () => {
    expect(nextStep({ ...done, blockingIssues: 2, backupDue: true }).tone).toBe("problem");
    expect(nextStep({ ...done, gapSlots: 4, backupDue: true }).title).toMatch(/still need/);
  });
});

describe("backup fingerprint covers the other (Semester/Break) schedule", () => {
  it("changes when only the schedule that is not showing changes", () => {
    const base = { settings: DEFAULT_SETTINGS, students: [], assignments: [], semester: null };
    const other = [{ id: "a", studentId: "s", day: "mon" as const, start: 540, source: "manual" as const }];
    expect(fingerprint({ ...base, otherTermAssignments: other })).not.toBe(fingerprint(base));
    expect(fingerprint({ ...base, otherTermAssignments: [] })).toBe(fingerprint(base));
  });
});
