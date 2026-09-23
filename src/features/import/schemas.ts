import { DAYS } from "../scheduling/types";

/** Structured, review-required output of AI/OCR schedule extraction. Never applied to state unmodified. */
export type ExtractedSchedule = {
  requestId: string;
  status: "ok" | "needs_review" | "error";
  confidence: number;
  meetings: { day: string; start: number; end: number; source: "class" }[];
  constraints: {
    latestEnd: number | null;
    lunchStart: number | null;
    needsOpeningShift: boolean;
    preference: "any" | "morning" | "afternoon";
    daysPerWeek: number | null;
  };
  warnings: string[];
  unresolved: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const FULL_DAYS = new Set(DAYS);

function inDay(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 24 * 60;
}

/**
 * Validates untrusted AI/OCR extraction output against a strict schema before it
 * is allowed anywhere near application state or the add-student form. Pasted
 * text and OCR/AI output are data, never instructions — this only ever produces
 * a plain data object, and the caller still requires manager review before save.
 */
export function validateExtractedSchedule(input: unknown): { ok: true; value: ExtractedSchedule } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["Response was not a JSON object."] };

  if (typeof input.requestId !== "string") errors.push("requestId must be a string.");
  if (!["ok", "needs_review", "error"].includes(input.status as string)) errors.push("status is invalid.");
  if (typeof input.confidence !== "number" || input.confidence < 0 || input.confidence > 1) {
    errors.push("confidence must be a number between 0 and 1.");
  }

  const meetings = input.meetings;
  const cleanMeetings: ExtractedSchedule["meetings"] = [];
  if (!Array.isArray(meetings)) {
    errors.push("meetings must be an array.");
  } else {
    meetings.forEach((m, i) => {
      if (!isRecord(m) || !FULL_DAYS.has(m.day as never) || !inDay(m.start) || !inDay(m.end)) {
        errors.push(`meetings[${i}] is malformed.`);
        return;
      }
      if (m.end <= m.start) {
        errors.push(`meetings[${i}] end must be after start.`);
        return;
      }
      cleanMeetings.push({ day: m.day as string, start: m.start, end: m.end, source: "class" });
    });
  }

  const constraints = isRecord(input.constraints) ? input.constraints : {};

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      requestId: input.requestId as string,
      status: input.status as ExtractedSchedule["status"],
      confidence: input.confidence as number,
      meetings: cleanMeetings,
      constraints: {
        latestEnd: inDay(constraints.latestEnd) ? constraints.latestEnd : null,
        lunchStart: inDay(constraints.lunchStart) ? constraints.lunchStart : null,
        needsOpeningShift: Boolean(constraints.needsOpeningShift),
        preference: ["any", "morning", "afternoon"].includes(constraints.preference as string)
          ? (constraints.preference as ExtractedSchedule["constraints"]["preference"])
          : "any",
        daysPerWeek:
          typeof constraints.daysPerWeek === "number" && Number.isInteger(constraints.daysPerWeek) && constraints.daysPerWeek >= 1 && constraints.daysPerWeek <= 5
            ? constraints.daysPerWeek
            : null,
      },
      warnings: Array.isArray(input.warnings) ? input.warnings.slice(0, 20).map((w) => String(w).slice(0, 300)) : [],
      unresolved: Array.isArray(input.unresolved) ? input.unresolved.slice(0, 20).map((w) => String(w).slice(0, 300)) : [],
    },
  };
}
