import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPublishRequest, scheduleForServer } from "../services/automation/contracts";
import { currentPasscode, isManagerSignedIn, signInManager, signOutManager } from "../services/automation/managerSession";
import { getAutomationClient } from "../services/automation/n8nClient";
import { makeSettings, makeStudent, run } from "./testkit";

/**
 * Tests for the browser side of signing in and talking to the ShiftFit server
 * (`services/automation/managerSession.ts` and `n8nClient.ts`). The server is replaced by a pretend
 * `fetch` that records each request, so the tests can check the passcode is sent correctly and that
 * a refused passcode is forgotten.
 */

type Call = { url: string; init: RequestInit };

/** Replaces the browser's `fetch` with one that records calls and gives the `answer` for each. */
function fakeServer(answer: (url: string, init: RequestInit) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return answer(url, init);
  });
  return calls;
}

const semester = { startDate: "2026-08-24", endDate: "2026-12-11", timeZone: "Pacific/Honolulu", skipDates: [] };
const students = [makeStudent({ id: "s1", name: "Noa K." })];
const assignments = run("s1", "mon", 540, 600);
const request = buildPublishRequest(students, assignments, makeSettings(), semester);

beforeEach(() => {
  signOutManager();
  vi.stubEnv("VITE_AUTOMATION_API_URL", "/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("signing in", () => {
  it("remembers the passcode only after the server accepts it", async () => {
    const calls = fakeServer((_url, init) => new Response(null, { status: (init.headers as Record<string, string>).authorization === "Bearer right-passcode-1" ? 200 : 401 }));
    expect(await signInManager("wrong-passcode-1")).toMatch(/isn't right/);
    expect(isManagerSignedIn()).toBe(false);
    expect(await signInManager("right-passcode-1")).toBeNull();
    expect(isManagerSignedIn()).toBe(true);
    expect(currentPasscode()).toBe("right-passcode-1");
    expect(calls[0].url).toBe("/api/session");
  });

  it("explains a lock-out and a server that isn't set up in plain words", async () => {
    fakeServer(() => new Response(null, { status: 429 }));
    expect(await signInManager("anything-12345")).toMatch(/Wait 15 minutes/);
    fakeServer(() => new Response(null, { status: 503 }));
    expect(await signInManager("anything-12345")).toMatch(/hasn't been set up/);
  });

  it("never writes the passcode anywhere the next person at this computer could find it", async () => {
    fakeServer(() => new Response(null, { status: 200 }));
    await signInManager("right-passcode-1");
    expect(JSON.stringify({ ...window.localStorage })).not.toContain("right-passcode-1");
    expect(document.cookie).not.toContain("right-passcode-1");
  });
});

describe("the server client", () => {
  it("is only used when a server address is set; otherwise it's the harmless practice run", () => {
    expect(getAutomationClient().kind).toBe("server");
    vi.stubEnv("VITE_AUTOMATION_API_URL", "");
    expect(getAutomationClient().kind).toBe("mock");
  });

  it("refuses to send anything before a manager signs in", async () => {
    const calls = fakeServer(() => new Response(null, { status: 200 }));
    await expect(getAutomationClient().publishSchedule(scheduleForServer(students, assignments, makeSettings(), semester), request)).rejects.toThrow(/Sign in/);
    expect(calls).toHaveLength(0);
  });

  it("sends the schedule and the approved version with the passcode, and checks the reply", async () => {
    const calls = fakeServer((url) =>
      url.endsWith("/api/session")
        ? new Response(null, { status: 200 })
        : Response.json({ scheduleVersion: request.scheduleVersion, results: [{ shiftId: "s1-mon-540", status: "created" }] }),
    );
    await signInManager("right-passcode-1");
    const response = await getAutomationClient().publishSchedule(scheduleForServer(students, assignments, makeSettings(), semester), request);
    expect(response.results[0].status).toBe("created");
    const publish = calls[1];
    expect(publish.url).toBe("/api/publish");
    expect((publish.init.headers as Record<string, string>).authorization).toBe("Bearer right-passcode-1");
    expect(JSON.parse(publish.init.body as string).approvedVersion).toBe(request.scheduleVersion);
  });

  it("shows the server's own explanation, and forgets a passcode the server no longer accepts", async () => {
    let publishStatus = 409;
    fakeServer((url) =>
      url.endsWith("/api/session")
        ? new Response(null, { status: 200 })
        : Response.json({ error: "x", message: "The schedule changed after you approved it." }, { status: publishStatus }),
    );
    await signInManager("right-passcode-1");
    const client = getAutomationClient();
    const schedule = scheduleForServer(students, assignments, makeSettings(), semester);
    await expect(client.publishSchedule(schedule, request)).rejects.toThrow(/changed after you approved/);
    expect(isManagerSignedIn()).toBe(true);
    publishStatus = 401;
    await expect(client.publishSchedule(schedule, request)).rejects.toThrow();
    expect(isManagerSignedIn()).toBe(false);
  });
});
