import { evaluateSchedule } from "../features/scheduling/evaluate";
import { autoFill } from "../features/scheduling/scheduler";
import { validatePersistedState } from "../features/scheduling/validation";
import { fail, isAuthorized, json, readBody } from "./http";

/**
 * ============================================================================
 *  THE SERVER SIDE: "CHECK MY SCHEDULE" AND "MAKE ME A SCHEDULE"
 * ============================================================================
 * ShiftFit mostly runs inside the browser, but some jobs must NOT trust the browser: before a schedule is
 * published to Google Calendar, a server should re-check it with the same rules (a browser can be edited by
 * anyone). This file is that server. It is Workflow B in `docs/N8N_ARCHITECTURE.md`. It reuses the exact same
 * rule code as the app (`src/features/scheduling`), so the browser and the server can never disagree.
 *
 * It is written as one plain function, `handleRequest(Request) -> Response`, using the web standard request and
 * response objects. That means it can run on Netlify Functions, Cloudflare Workers or a small Node server
 * without changes; only a thin wrapper around it differs. Nothing here is deployed yet: see the doc for how to
 * switch it on.
 *
 * Three endpoints:
 *  - `GET  /health`    says the service is alive. Needs no login and returns no data.
 *  - `POST /evaluate`  takes a schedule and reports whether it breaks any rule, plus coverage numbers.
 *  - `POST /generate`  takes students and settings, runs the same auto-fill as the app, and returns the result.
 *
 * Safety choices (each is tested):
 *  - It refuses to work until a secret is configured ("fail closed"), and every data endpoint needs it.
 *  - Input is checked with the same strict validator used for backup files; unknown fields are dropped.
 *  - Bodies over a size limit are refused before they are parsed.
 *  - Errors are short and generic. Student data is never logged and never echoed back in an error.
 *  - Responses are marked "do not cache".
 */

export type ServerOptions = {
  /** The shared password callers must send as `Authorization: Bearer <secret>`. Undefined or too short = service disabled. */
  secret: string | undefined;
  /** Largest request body accepted, in bytes. */
  maxBodyBytes?: number;
};

/** Shortest secret we will accept. Anything shorter is too easy to guess, so the service stays off. */
export const MIN_SECRET_LENGTH = 16;
export const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Answers one web request. In order: find the address, check the method, check the password,
 * check the size, read the JSON, validate every field, then run /evaluate or /generate. Any
 * unexpected crash becomes a generic 500 answer that reveals nothing.
 */
export async function handleRequest(request: Request, options: ServerOptions): Promise<Response> {
  try {
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    const route = ["/health", "/evaluate", "/generate"].find((r) => path === r || path.endsWith(r));
    if (!route) return fail(404, "not_found", "There is nothing at that address.");

    if (route === "/health") {
      return request.method === "GET" ? json(200, { status: "ok" }) : fail(405, "method_not_allowed", "Use GET for /health.");
    }
    if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

    // Login comes before anything else, so an unauthorized caller learns nothing about the service.
    const secret = options.secret ?? "";
    if (secret.length < MIN_SECRET_LENGTH) {
      return fail(503, "not_configured", "This service has not been set up yet.");
    }
    if (!isAuthorized(request, secret)) return fail(401, "unauthorized", "Missing or wrong credentials.");

    const body = await readBody(request, options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES);
    if (!body.ok) return body.response;

    let parsed: unknown;
    try {
      parsed = JSON.parse(body.text);
    } catch {
      return fail(400, "bad_json", "The request was not valid JSON.");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return fail(400, "bad_request", "The request must be a JSON object.");
    }
    const input = parsed as Record<string, unknown>;

    // Only these fields are read. Anything else the caller sends is ignored, then the validator checks every one.
    const checked = validatePersistedState({
      version: 1,
      students: input.students,
      assignments: input.assignments ?? [],
      settings: input.settings,
      semester: input.semester ?? null,
      selectedStudentId: null,
    });
    if (!checked.ok) return fail(422, "invalid_schedule", "The schedule could not be read.", { problems: checked.errors });
    const { students, assignments, settings } = checked.value;

    if (route === "/evaluate") {
      return json(200, { evaluation: evaluateSchedule(students, assignments, settings), notes: checked.notes });
    }

    // /generate: the same deterministic planner the app uses, so a given roster always gets the same schedule.
    const result = autoFill(students, assignments, settings, { replaceAutoFilled: input.replaceAutoFilled === true });
    return json(200, {
      assignments: result.assignments,
      unmet: result.unmet,
      openingShiftUnmet: result.openingShiftUnmet,
      explanations: result.explanations,
      deterministic: result.deterministic,
      evaluation: evaluateSchedule(students, result.assignments, settings),
      notes: checked.notes,
    });
  } catch {
    // Deliberately says nothing about what went wrong: the cause could contain student data.
    return fail(500, "internal_error", "Something went wrong on the server.");
  }
}
