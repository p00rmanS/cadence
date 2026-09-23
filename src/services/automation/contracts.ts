import { mergeContiguousBlocks, scheduleVersion } from "../../features/scheduling/blocks";
import { countWeeklyOccurrences, excludedOccurrences, isSemesterConfigured } from "../../features/calendar/ics";
import type { Day, ScheduleSettings, SemesterConfig, ShiftBlock, Student } from "../../features/scheduling/types";

/**
 * ============================================================================
 *  THE "CONTRACT" WITH THE CALENDAR-PUBLISHING SERVER (n8n)
 * ============================================================================
 * ShiftFit itself never talks to Google Calendar. Instead, when the manager
 * presses "Save & share" -> publish, this app sends a plain description of
 * the approved shifts to a separate server (an automation tool called n8n —
 * see `docs/N8N_ARCHITECTURE.md` and the `n8n/` folder) which is responsible
 * for actually creating Google Calendar events. This file defines the exact
 * shape of that request and response (a "contract" both sides agree to), and
 * `validatePublishResponse` makes sure whatever comes back matches it before
 * the app trusts it — the same "never trust outside data blindly" pattern
 * used in `../../features/scheduling/validation.ts`.
 */

/**
 * A shift's real, repeatable calendar placement — a weekday + minutes-of-day alone isn't
 * enough for Google Calendar, which needs an actual first date, a timezone, and a recurrence
 * rule. This is only ever built from `SemesterConfig` (never guessed — same rule as the .ics
 * export in `../../features/calendar/ics.ts`, whose already-tested date math this reuses).
 */
export type PublishRecurrence = {
  /** ISO 8601 local date-time (no offset) of the FIRST occurrence's start, e.g. "2026-10-06T09:00:00". */
  startIso: string;
  /** Same, for the first occurrence's end. */
  endIso: string;
  /** IANA zone the times above are local to, e.g. "Pacific/Honolulu". */
  timeZone: string;
  /** RFC 5545 recurrence rule, weekly, e.g. "FREQ=WEEKLY;COUNT=12". */
  rrule: string;
  /** ISO 8601 local date-times to exclude from the recurrence (holidays/breaks that fall on this weekday). */
  exdates: string[];
};

export type PublishEventPayload = {
  studentId: string;
  studentName: string;
  day: Day;
  start: number;
  end: number;
  /** Stable per shift (student + day + start) so retries update instead of duplicating. */
  shiftId: string;
  /** Present only when the manager has saved semester dates and a timezone (see `isSemesterConfigured`). */
  recurrence?: PublishRecurrence;
};

export type PublishRequest = {
  scheduleVersion: string;
  events: PublishEventPayload[];
};

export type PublishEventStatus = "created" | "updated" | "unchanged" | "failed" | "dry_run";

export type PublishEventResult = {
  shiftId: string;
  status: PublishEventStatus;
  googleEventId?: string;
  error?: string;
};

export type PublishResponse = {
  scheduleVersion: string;
  results: PublishEventResult[];
};

export type SyncState = "not_synced" | "syncing" | "synced" | "partially_synced" | "sync_failed";

export type AutomationClient = {
  /** "n8n" when VITE_AUTOMATION_API_URL is set, "mock" otherwise. The UI must never imply a mock run reached Google Calendar. */
  kind: "n8n" | "mock";
  publishSchedule(request: PublishRequest): Promise<PublishResponse>;
};

/** "2026-10-06" + 540 minutes -> "2026-10-06T09:00:00" (no timezone offset — paired with a separate `timeZone` field, same convention as the .ics export). */
function isoLocal(date: Date, minutes: number): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mi = String(minutes % 60).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:00`;
}

/** Builds the real-dates recurrence info for one weekly shift, or `undefined` if it has no calendar occurrence in the configured semester (or no semester is configured yet). */
function buildRecurrence(semester: SemesterConfig | null, day: Day, start: number, end: number): PublishRecurrence | undefined {
  if (!isSemesterConfigured(semester)) return undefined;
  const occurrences = countWeeklyOccurrences(semester, day);
  if (!occurrences) return undefined;
  const exdates = excludedOccurrences(semester, occurrences.first, occurrences.count).map((d) => isoLocal(d, start));
  return {
    startIso: isoLocal(occurrences.first, start),
    endIso: isoLocal(occurrences.first, end),
    timeZone: semester.timeZone,
    rrule: `FREQ=WEEKLY;COUNT=${occurrences.count}`,
    exdates,
  };
}

export function buildPublishRequest(
  students: Student[],
  assignments: ShiftBlock[],
  settings: ScheduleSettings,
  semester: SemesterConfig | null,
): PublishRequest {
  const names = new Map(students.map((s) => [s.id, s.name]));
  return {
    scheduleVersion: scheduleVersion(assignments),
    events: mergeContiguousBlocks(assignments, settings.slotMinutes).map((b) => {
      const recurrence = buildRecurrence(semester, b.day, b.start, b.end);
      return {
        studentId: b.studentId,
        studentName: names.get(b.studentId) ?? b.studentId,
        day: b.day,
        start: b.start,
        end: b.end,
        shiftId: `${b.studentId}-${b.day}-${b.start}`,
        ...(recurrence ? { recurrence } : {}),
      };
    }),
  };
}

const STATUSES: PublishEventStatus[] = ["created", "updated", "unchanged", "failed", "dry_run"];

/** Never trust a webhook's JSON: check the shape and that every result maps to something we sent. */
export function validatePublishResponse(
  json: unknown,
  request: PublishRequest,
): { ok: true; value: PublishResponse } | { ok: false; error: string } {
  if (typeof json !== "object" || json === null) return { ok: false, error: "The publish service sent back something unexpected." };
  const body = json as Record<string, unknown>;
  if (typeof body.scheduleVersion !== "string" || !Array.isArray(body.results)) {
    return { ok: false, error: "The publish service response is missing its results." };
  }
  const sent = new Set(request.events.map((e) => e.shiftId));
  const results: PublishEventResult[] = [];
  for (const r of body.results) {
    if (typeof r !== "object" || r === null) return { ok: false, error: "A publish result was malformed." };
    const row = r as Record<string, unknown>;
    if (typeof row.shiftId !== "string" || !sent.has(row.shiftId) || !STATUSES.includes(row.status as PublishEventStatus)) {
      return { ok: false, error: "A publish result did not match the shifts that were sent." };
    }
    results.push({
      shiftId: row.shiftId,
      status: row.status as PublishEventStatus,
      ...(typeof row.googleEventId === "string" ? { googleEventId: row.googleEventId } : {}),
      ...(typeof row.error === "string" ? { error: row.error.slice(0, 300) } : {}),
    });
  }
  return { ok: true, value: { scheduleVersion: body.scheduleVersion, results } };
}

export type PublishSummary = {
  state: SyncState;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  /** Shifts we sent that the service never reported on. */
  missing: number;
  dryRun: boolean;
};

/** Turns a validated response into an honest sync state — a mock run is never "synced". */
export function summarizePublish(request: PublishRequest, response: PublishResponse): PublishSummary {
  const count = (s: PublishEventStatus) => response.results.filter((r) => r.status === s).length;
  const reported = new Set(response.results.map((r) => r.shiftId));
  const missing = request.events.filter((e) => !reported.has(e.shiftId)).length;
  const dryRun = response.results.length > 0 && response.results.every((r) => r.status === "dry_run");
  const failed = count("failed");
  const ok = count("created") + count("updated") + count("unchanged");

  let state: SyncState;
  if (dryRun) state = "not_synced";
  else if (failed + missing === 0 && ok > 0) state = "synced";
  else if (ok > 0) state = "partially_synced";
  else if (request.events.length === 0) state = "not_synced";
  else state = "sync_failed";

  return { state, created: count("created"), updated: count("updated"), unchanged: count("unchanged"), failed, missing, dryRun };
}
