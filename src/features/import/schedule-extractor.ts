import { parseClassText } from "../scheduling/parser";
import type { ParseResult } from "../scheduling/types";
import { createId } from "../../lib/id";
import { validateExtractedSchedule } from "./schemas";
import type { ExtractedSchedule } from "./schemas";

export type ExtractionSource = "local-text" | "remote-ai";

export type ExtractionOutcome = {
  source: ExtractionSource;
  parse: ParseResult;
  ai?: ExtractedSchedule;
  error?: string;
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const TIMEOUT_MS = 60_000;

export function checkImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Please use a PNG, JPG or WebP screenshot.";
  if (file.size > MAX_IMAGE_BYTES) return "That image is bigger than 5 MB. Try a smaller screenshot.";
  return null;
}

export function isRemoteExtractionAvailable(): boolean {
  return Boolean(import.meta.env.VITE_AUTOMATION_API_URL);
}

/**
 * Turns pasted text (and optionally a screenshot) into candidate schedule data.
 *
 * Text is ALWAYS parsed locally and deterministically first: no network, no AI, no
 * provider needed. A screenshot is only sent anywhere when the manager attaches one
 * AND a server-side endpoint is configured; this module never calls an AI API directly
 * and never holds a private key. Whatever comes back is validated against a strict
 * schema and shown for review — it is data, never instructions, and never auto-saved.
 */
export async function extractSchedule(input: { text: string; image?: File | null }): Promise<ExtractionOutcome> {
  const parse = parseClassText(input.text);
  if (!input.image) return { source: "local-text", parse };

  const imageProblem = checkImageFile(input.image);
  if (imageProblem) return { source: "local-text", parse, error: imageProblem };

  const endpoint = import.meta.env.VITE_AUTOMATION_API_URL;
  if (!endpoint) {
    return {
      source: "local-text",
      parse,
      error: "Reading screenshots isn't set up here yet. You can type or paste the class times instead — that always works.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append("requestId", createId("req"));
    form.append("image", input.image);
    form.append("text", input.text.slice(0, 4000));
    const res = await fetch(`${endpoint.replace(/\/$/, "")}/webhook/shiftfit/interpret`, {
      method: "POST",
      body: form,
      credentials: "omit",
      signal: controller.signal,
    });
    if (!res.ok) return { source: "remote-ai", parse, error: `The reading service had a problem (${res.status}). Try typing the times instead.` };
    const validated = validateExtractedSchedule(await res.json());
    if (!validated.ok) {
      return { source: "remote-ai", parse, error: "The reading service sent back something we couldn't trust, so we ignored it. Try typing the times instead." };
    }
    return { source: "remote-ai", parse, ai: validated.value };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "AbortError";
    return {
      source: "remote-ai",
      parse,
      error: timedOut ? "The reading service took too long. Try again or type the times instead." : "Couldn't reach the reading service. Try typing the times instead.",
    };
  } finally {
    clearTimeout(timer);
  }
}
