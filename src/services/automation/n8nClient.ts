import { createMockAutomationClient } from "./mockAutomationClient";
import { validatePublishResponse, validateRemoveResponse } from "./contracts";
import type { AutomationClient, PublishRequest, PublishResponse, RemoveResponse, ScheduleForServer } from "./contracts";
import { currentPasscode, problemFromStatus, serverBaseUrl, signOutManager } from "./managerSession";

/**
 * ============================================================================
 *  THE REAL CALENDAR CLIENT (used only once VITE_AUTOMATION_API_URL is set)
 * ============================================================================
 * `getAutomationClient()` at the bottom of this file is what the rest of the app calls. It picks
 * between this real client and `mockAutomationClient.ts` (a "practice run" that pretends nothing is
 * connected) based on one environment variable.
 *
 * The browser NEVER talks to n8n directly any more. It talks to the ShiftFit server
 * (`src/server/gateway.ts`, deployed as a Netlify Function at /api/...), which:
 *   1. checks the manager passcode,
 *   2. re-checks the schedule against every rule and rebuilds the calendar events itself,
 *   3. then calls n8n with a secret password the browser never sees.
 * So even someone who edits this code in their own browser can't send made-up events.
 */

/** How long to wait for the server before giving up (calendar work for many shifts can be slow). */
const TIMEOUT_MS = 30_000;

/**
 * Sends one JSON request to the ShiftFit server with the manager passcode and returns the reply's
 * JSON. Any problem (not signed in, wrong passcode, slow, not 2xx) becomes an Error with a plain
 * message, so the screen shows it instead of a silent success.
 */
async function postToServer(baseUrl: string, path: string, body: unknown): Promise<unknown> {
  const passcode = currentPasscode();
  if (!passcode) throw new Error("Sign in with the manager passcode first.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${passcode}` },
      body: JSON.stringify(body),
      credentials: "omit",
      signal: controller.signal,
    });
    // The passcode was changed on the server (or never right): forget it so the sign-in box shows again.
    if (res.status === 401) signOutManager();
    if (!res.ok) throw new Error(await explainFailure(res));
    return await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new Error("The server took too long to answer.");
    throw err instanceof Error ? err : new Error("Could not reach the ShiftFit server.");
  } finally {
    clearTimeout(timer);
  }
}

/** The server's own short message when it sent one (e.g. "the schedule changed since you approved it"), else a generic one. */
async function explainFailure(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.length <= 300) return body.message;
  } catch {
    /* not JSON: fall through to the generic message */
  }
  return problemFromStatus(res.status);
}

/** The real client: every call goes to the ShiftFit server at `baseUrl`. */
function createServerClient(baseUrl: string): AutomationClient {
  return {
    kind: "server",
    async publishSchedule(schedule: ScheduleForServer, request: PublishRequest): Promise<PublishResponse> {
      const json = await postToServer(baseUrl, "/api/publish", { ...schedule, approvedVersion: request.scheduleVersion });
      const validated = validatePublishResponse(json, request);
      if (!validated.ok) throw new Error(validated.error);
      return validated.value;
    },
    async removeEvents(shiftIds: string[]): Promise<RemoveResponse> {
      const json = await postToServer(baseUrl, "/api/remove", { shiftIds });
      const validated = validateRemoveResponse(json, shiftIds);
      if (!validated.ok) throw new Error(validated.error);
      return validated.value;
    },
  };
}

/** The client the app should use: the real server one if a server address is set, otherwise the practice-run mock. */
export function getAutomationClient(): AutomationClient {
  const base = serverBaseUrl();
  return base !== null ? createServerClient(base) : createMockAutomationClient();
}
