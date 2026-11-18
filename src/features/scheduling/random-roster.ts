import { buildBusy } from "./parser";
import { NO_CUTOFF, STUDENT_COLORS } from "./constants";
import type { Student } from "./types";

/**
 * ============================================================================
 *  RANDOM MADE-UP STUDENTS FOR TESTING
 * ============================================================================
 * Builds 1 to 25 made-up students, each with their own random class schedule, so the team (and a manager
 * exploring the app) can quickly try Auto-fill on a roster of any size. Nothing here is a real person.
 * The students come with NO shifts on purpose: the point is to press "Fill shifts" and watch it work.
 * Used by the "Try random students" button in Save & share (see `SaveShareDialog.tsx`).
 */

/** The fewest and most random students the button can make. 25 matches the built-in sample roster. */
export const MIN_RANDOM_STUDENTS = 1;
export const MAX_RANDOM_STUDENTS = 25;

/** Made-up first names (a mix of the names common on campus). Each one is used at most once per roster. */
const FIRST_NAMES = [
  "Kalani", "Leilani", "Makana", "Noelani", "Keoni", "Malia", "Sione", "Tevita", "Aroha", "Hemi",
  "Mele", "Yuki", "Minh", "Tiare", "Pita", "Ana", "Kimo", "Priya", "Joaquin", "Sofia",
  "Waleed", "Lopini", "Jin", "Hina", "Eli", "Moana", "Kai", "Lani", "Tomasi", "Ioane",
  "Mei", "Haruto", "Sakura", "Diego", "Valeria", "Amara", "Kofi", "Zara", "Nikau", "Tane",
];

/** Made-up last initials, added to the first name ("Kalani M.") so two students never look the same. */
const LAST_INITIALS = "ABCDEFGHJKLMNPRSTVWY".split("");

/** Hours (24-hour clock) a 50-minute Monday/Wednesday/Friday class can start. One per hour, so they never overlap. */
const MWF_START_HOURS = [8, 9, 10, 11, 12, 13, 14, 15];

/**
 * 75-minute Tuesday/Thursday class start times as [hour, minute]. They are spaced so no two overlap
 * (the latest one ends 4:45pm).
 */
const TTH_STARTS: [number, number][] = [[8, 0], [9, 30], [11, 0], [12, 30], [14, 0], [15, 30]];

/** Class length for the two kinds of class, in minutes. */
const MWF_CLASS_MINUTES = 50;
const TTH_CLASS_MINUTES = 75;

/** A function that returns a number from 0 up to (but not including) 1, like `Math.random`. Tests pass in a fixed one. */
export type RandomSource = () => number;

/** Picks a whole number from `low` to `high`, both included. */
function between(random: RandomSource, low: number, high: number): number {
  return low + Math.floor(random() * (high - low + 1));
}

/** Returns a shuffled copy of the list, so the same list can be reordered randomly without changing the original. */
function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const copy = [...items];
  // Walk backwards, swapping each spot with a random earlier spot (the standard "Fisher-Yates" shuffle).
  for (let i = copy.length - 1; i > 0; i--) {
    const j = between(random, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Writes a time of day the way the class box expects it, e.g. (13, 5) becomes "1:05pm". */
function clock(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")}${suffix}`;
}

/** One class line such as "MWF 9:00am-9:50am". */
function classLine(days: string, startMinutes: number, lengthMinutes: number): string {
  return `${days} ${clock(startMinutes)}-${clock(startMinutes + lengthMinutes)}`;
}

/** A random weekly class schedule: 2 to 3 Mon/Wed/Fri classes and 1 to 2 Tue/Thu classes, none overlapping. */
function randomClassText(random: RandomSource): string {
  const mwf = shuffled(MWF_START_HOURS, random)
    .slice(0, between(random, 2, 3))
    .map((hour) => classLine("MWF", hour * 60, MWF_CLASS_MINUTES));
  const tth = shuffled(TTH_STARTS, random)
    .slice(0, between(random, 1, 2))
    .map(([hour, minute]) => classLine("TTh", hour * 60 + minute, TTH_CLASS_MINUTES));
  return [...mwf, ...tth].join("\n");
}

/**
 * Makes `count` random made-up students (clamped to 1-25). Everyone is free any day and any time outside
 * class, wants to work 5 days a week, and has no shifts yet. Pass your own `random` only in tests.
 */
export function buildRandomStudents(count: number, random: RandomSource = Math.random): Student[] {
  const howMany = Math.max(MIN_RANDOM_STUDENTS, Math.min(MAX_RANDOM_STUDENTS, Math.round(count)));
  const names = shuffled(FIRST_NAMES, random).slice(0, howMany);
  return names.map((first, index) => {
    const classText = randomClassText(random);
    const initial = LAST_INITIALS[between(random, 0, LAST_INITIALS.length - 1)];
    return {
      id: `r${index + 1}`,
      name: `${first} ${initial}.`,
      color: STUDENT_COLORS[(index + 1) % STUDENT_COLORS.length],
      preference: "any",
      daysPerWeek: 5,
      classText,
      blockedText: "",
      busy: buildBusy(classText, "").busy,
      latestEnd: NO_CUTOFF,
      breaks: [],
      needsOpeningShift: false,
    };
  });
}
