import { DEFAULT_SETTINGS } from "../scheduling/constants";
import { buildDemoData } from "../scheduling/demo-data";
import type { ScheduleSettings, SemesterConfig, ShiftBlock, Student } from "../scheduling/types";

/**
 * ============================================================================
 *  KEEPING TRACK OF BACKUPS (because there is no database)
 * ============================================================================
 * Cadence/ShiftFit has no server database: on GitHub Pages the whole schedule lives in this one
 * browser. That can disappear. Safari deletes a website's saved data after about 7 days without a
 * visit, and any browser may clear it when the disk is full or when someone clears their history.
 * A downloaded backup file is the only copy outside the browser.
 *
 * So this file remembers WHEN the last backup was saved and WHAT the schedule looked like then (a
 * short "fingerprint"). If the schedule has changed since, and the last backup is missing or a week
 * old, `isBackupDue` says so and the "next step" banner reminds the manager.
 *
 * It also asks the browser to treat this site's data as "persistent" (please don't clear it on your
 * own), which modern browsers support. That lowers the risk; it does not remove it, so the reminder
 * stays either way.
 */

/** Where the backup record is kept in this browser's localStorage. */
const BACKUP_RECORD_KEY = "shiftfit:lastBackup";
/** A backup older than this, with changes made since, earns a reminder (Safari's limit is about 7 days). */
export const BACKUP_REMINDER_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** What is remembered about the last backup: when it was saved and the schedule's fingerprint at that moment. */
export type BackupRecord = { at: number; fingerprint: string };

/** Just the parts of a schedule that matter for "has anything changed?" (which student is selected doesn't). */
export type ScheduleContent = {
  settings: ScheduleSettings;
  students: Student[];
  assignments: ShiftBlock[];
  /** The Semester/Break schedule that is NOT showing. Changes to it count as changes too. */
  otherTermAssignments?: ShiftBlock[];
  semester: SemesterConfig | null;
};

/**
 * A short code that changes whenever the schedule's content changes, e.g. "f3a91c0e". It uses the
 * FNV-1a method: walk through the text one character at a time, mixing each into a running number.
 * Two different schedules could in theory get the same code, but that is about 1 in 4 billion.
 */
export function fingerprint(content: ScheduleContent): string {
  const text = JSON.stringify([content.settings, content.students, content.assignments, content.otherTermAssignments ?? [], content.semester ?? null]);
  let hash = 0x811c9dc5; // FNV-1a's standard starting value
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0; // FNV-1a's standard multiplier, kept as a whole 32-bit number
  }
  return hash.toString(16).padStart(8, "0");
}

/** The sample schedule's fingerprint, worked out once and then reused. */
let demoFingerprint: string | null = null;

/** The fingerprint of the made-up sample schedule, so an untouched demo never triggers a reminder. */
function sampleScheduleFingerprint(): string {
  if (demoFingerprint === null) {
    const demo = buildDemoData();
    demoFingerprint = fingerprint({ settings: DEFAULT_SETTINGS, students: demo.students, assignments: demo.assignments, semester: null });
  }
  return demoFingerprint;
}

/** The last backup this browser remembers, or null if there was none (or the record is unreadable). */
export function readLastBackup(): BackupRecord | null {
  try {
    const raw = window.localStorage.getItem(BACKUP_RECORD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BackupRecord>;
    // A hand-edited or broken record is treated as "no backup", which can only cause an extra reminder.
    if (typeof parsed.at !== "number" || !Number.isFinite(parsed.at) || typeof parsed.fingerprint !== "string") return null;
    return { at: parsed.at, fingerprint: parsed.fingerprint };
  } catch {
    return null;
  }
}

/** Screens that want to know when a backup is recorded (see `useBackupStatus`). */
const listeners = new Set<() => void>();

/** Lets a screen be told when a new backup is recorded. Returns a function that stops the updates. */
export function subscribeToBackups(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Remembers that the schedule as it is now has a copy outside the browser: called after a backup
 * file is downloaded, and after a backup file is loaded (the file on disk then matches the app).
 */
export function recordBackup(content: ScheduleContent, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(BACKUP_RECORD_KEY, JSON.stringify({ at: now, fingerprint: fingerprint(content) }));
  } catch {
    /* storage refused: the reminder will simply keep showing, which is the safe side */
  }
  for (const listener of listeners) listener();
}

/**
 * True when the manager should be reminded to save a backup: the schedule has real work in it (it
 * isn't empty or the untouched sample), it changed since the last backup, and that backup is missing
 * or at least BACKUP_REMINDER_DAYS old.
 */
export function isBackupDue(content: ScheduleContent, lastBackup: BackupRecord | null, now: number = Date.now()): boolean {
  if (content.students.length === 0) return false;
  const current = fingerprint(content);
  if (current === sampleScheduleFingerprint()) return false;
  if (lastBackup && lastBackup.fingerprint === current) return false;
  if (lastBackup === null) return true;
  return now - lastBackup.at >= BACKUP_REMINDER_DAYS * MS_PER_DAY;
}

/** Whole days since the last backup (0 = today), or null if there was never one. For the "Last backup" line. */
export function daysSinceBackup(lastBackup: BackupRecord | null, now: number = Date.now()): number | null {
  return lastBackup ? Math.max(0, Math.floor((now - lastBackup.at) / MS_PER_DAY)) : null;
}

/** "never", "today", "yesterday" or "5 days ago": the last backup in plain words. */
export function describeLastBackup(lastBackup: BackupRecord | null, now: number = Date.now()): string {
  const days = daysSinceBackup(lastBackup, now);
  if (days === null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/**
 * Asks the browser to keep this site's saved data instead of clearing it on its own. Returns true if
 * the browser agreed. Some browsers decide by themselves (no question shown); Firefox may ask the
 * person, which is why this is only called right after they press "Save a backup file".
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
