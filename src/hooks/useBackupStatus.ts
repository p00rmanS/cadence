import { useMemo, useSyncExternalStore } from "react";
import { isBackupDue, readLastBackup, subscribeToBackups } from "../features/persistence/backupStatus";
import type { BackupRecord, ScheduleContent } from "../features/persistence/backupStatus";

/**
 * Connects the backup tracking (`features/persistence/backupStatus.ts`) to the screens: returns the
 * last backup and whether a reminder is due, and re-draws the screen the moment a new backup is
 * saved (so the reminder disappears right away).
 */

/** The stored backup record as text, so React can tell cheaply whether it changed. */
function readRecordText(): string {
  return JSON.stringify(readLastBackup());
}

/** The last backup and whether the manager should be reminded to make a new one. */
export function useBackupStatus(content: ScheduleContent): { lastBackup: BackupRecord | null; backupDue: boolean } {
  const recordText = useSyncExternalStore(subscribeToBackups, readRecordText, readRecordText);
  const lastBackup = useMemo(() => JSON.parse(recordText) as BackupRecord | null, [recordText]);
  const { settings, students, assignments, semester } = content;
  const backupDue = useMemo(
    () => isBackupDue({ settings, students, assignments, semester }, lastBackup),
    [settings, students, assignments, semester, lastBackup],
  );
  return { lastBackup, backupDue };
}
