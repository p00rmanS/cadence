import type { ScheduleSettings, Minutes } from "./types";

/**
 * ============================================================================
 *  TUNABLE NUMBERS FOR THE SCHEDULING RULES
 * ============================================================================
 * Every "magic number" the scheduler cares about (default hours, shift-length
 * limits, how many students the app allows) lives in this one file instead of
 * being typed directly into the logic files. If a rule needs to change later
 * (say, the weekly hour cap), this is the one place to look.
 */

/** All scheduling rules live here instead of scattered magic numbers. */
export const DEFAULT_SETTINGS: ScheduleSettings = {
  openTime: 7 * 60,
  closeTime: 17 * 60,
  minStaffPerSlot: 1,
  slotMinutes: 30,
  weeklyTargetHours: 19,
};

export const OPEN_TIME_OPTIONS: Minutes[] = [7 * 60, 8 * 60];

export const MIN_STAFF_OPTIONS = [1, 2];

/** The clock time a "required opening shift" must start at. Independent of the visible open-hours view. */
export const OPENING_SHIFT_START: Minutes = 7 * 60;

/**
 * A "required opening shift" must be a real contiguous block, not a single slot —
 * the prototype this replaces treated any one 30-minute assignment at the opening
 * time as satisfying the requirement.
 */
export const MIN_OPENING_SHIFT_MINUTES = 60;

/** "No cutoff" for a student: they can work until the office closes, whenever that is. */
export const NO_CUTOFF: Minutes = 24 * 60;

/** Auto-fill prefers blocks at least this long; shorter blocks are allowed but penalized. */
export const MIN_SHIFT_MINUTES = 120;

/** Auto-fill never creates a single contiguous block longer than this. */
export const MAX_SHIFT_MINUTES = 240;

/**
 * Auto-fill first spreads a student's hours evenly across their work days. If that leaves them short
 * of their weekly hours, it may add this many extra hours to a single day before giving up.
 */
export const RELAXED_DAY_EXTRA_HOURS = 2;

/** Largest photo a person may pick. The app shrinks it to a small thumbnail before saving. */
export const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Side length (px) of the saved square thumbnail. */
export const AVATAR_SIZE = 128;
/**
 * Longest saved thumbnail data URL we accept (about 12 KB). Browser storage holds roughly 5 MB in
 * total and backup files are capped at 5 MB, so 200 students x 16,000 characters (3.2 MB worst
 * case) still fits. The resizer lowers JPEG quality until a photo is under this.
 */
export const MAX_AVATAR_CHARS = 16_000;

export const MAX_STUDENTS = 200;
export const MAX_ASSIGNMENTS = 5000;

/** Every color keeps >= 4.5:1 contrast with white chip text (enforced in src/test/contrast.test.ts). */
export const STUDENT_COLORS = [
  "#1F6FB2",
  "#1F7A5C",
  "#8E44AD",
  "#B3144F",
  "#A86200",
  "#0E7C86",
  "#5563D0",
  "#5E6E24",
];
