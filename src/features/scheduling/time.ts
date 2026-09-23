import type { Minutes } from "./types";

/**
 * ============================================================================
 *  TIME FORMATTING AND PARSING HELPERS
 * ============================================================================
 * Small, self-contained functions for converting between the app's internal
 * time format (`Minutes` — an integer number of minutes since midnight, see
 * `types.ts`) and human-readable or ISO text. Nothing in here knows about
 * students, shifts, or scheduling rules — just plain time/date math.
 */

/** Central minutes-from-midnight formatting so every screen agrees ("9:00am", "12:30pm"). */
export function formatMinutes(minutes: Minutes): string {
  let hour = Math.floor(minutes / 60);
  const ampm = hour >= 12 && hour < 24 ? "pm" : "am";
  hour = hour % 12 || 12;
  return `${hour}:${String(minutes % 60).padStart(2, "0")}${ampm}`;
}

/** "1 hour", "2 hours", "19.5 hours": spoken hours with correct singular/plural. */
export function hoursLabel(hours: number): string {
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** Makes sure a sentence ends with exactly one full stop, even when it already ends with one (like "Noa K."). */
export function endSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function formatRange(start: Minutes, end: Minutes): string {
  return `${formatMinutes(start)}–${formatMinutes(end)}`;
}

export function isValidTimeZone(zone: string): boolean {
  if (!zone || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** True for a real calendar date written YYYY-MM-DD (rejects 2026-02-31). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** "13:30" -> 810. Returns null for anything that isn't a valid 24-hour HH:MM. */
export function parseClock24(value: string): Minutes | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}
