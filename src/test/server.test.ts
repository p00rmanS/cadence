// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_BODY_BYTES, handleRequest, MIN_SECRET_LENGTH } from "../server/handler";
import type { ServerOptions } from "../server/handler";
import { makeSettings, makeStudent } from "./testkit";

/** These tests run in a plain Node environment (no browser), which is what a real server is. */

const SECRET = "test-secret-0123456789";
const options = { secret: SECRET };

const roster = [makeStudent({ id: "s1", name: "Noa K." }), makeStudent({ id: "s2", name: "Kai P.", color: "#1F7A5C" })];
const schedule = { students: roster, assignments: [], settings: makeSettings() };

/** Sends one pretend web request to the server code (with the right password unless told otherwise). */
function call(path: string, init: { method?: string; auth?: string | null; body?: unknown; headers?: Record<string, string> } = {}, opts: ServerOptions = options) {
  const headers: Record<string, string> = { "content-type": "application/json", ...init.headers };
  if (init.auth !== null) headers.authorization = init.auth ?? `Bearer ${SECRET}`;
  const body = init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body);
  return handleRequest(new Request(`https://shiftfit.test${path}`, { method: init.method ?? "POST", headers, body }), opts);
}

describe("addresses and methods", () => {
  it("answers /health with no login and no data", async () => {
    const res = await call("/health", { method: "GET", auth: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("rejects the wrong method and unknown addresses", async () => {
    expect((await call("/health", { method: "POST" })).status).toBe(405);
    expect((await call("/evaluate", { method: "GET" })).status).toBe(405);
    expect((await call("/nothing-here")).status).toBe(404);
  });

  it("works behind a path prefix such as a hosting provider's functions folder", async () => {
    const res = await call("/.netlify/functions/server/evaluate", { body: schedule });
    expect(res.status).toBe(200);
  });
});

describe("login (it must fail closed)", () => {
  it("stays switched off until a long enough secret is configured, even for a caller who 'guesses' it", async () => {
    for (const secret of [undefined, "", "short"]) {
      const res = await call("/evaluate", { body: schedule, auth: `Bearer ${secret ?? ""}` }, { secret });
      expect(res.status, String(secret)).toBe(503);
    }
    expect("x".repeat(MIN_SECRET_LENGTH - 1).length).toBeLessThan(MIN_SECRET_LENGTH);
  });

  it("refuses a missing, malformed, or wrong password (same length or not)", async () => {
    for (const auth of [null, "", SECRET, "Basic abc", "Bearer ", "Bearer wrong", `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(0, -1)}`, `Bearer ${"z".repeat(SECRET.length)}`]) {
      const res = await call("/evaluate", { body: schedule, auth });
      expect(res.status, String(auth)).toBe(401);
    }
  });

  it("checks the password before reading the request, so a stranger learns nothing about what is accepted", async () => {
    const res = await call("/evaluate", { body: "not json at all", auth: "Bearer nope" });
    expect(res.status).toBe(401);
  });
});

describe("bad requests", () => {
  it("rejects bodies that are not a JSON object", async () => {
    expect((await call("/evaluate", { body: "{oops" })).status).toBe(400);
    expect((await call("/evaluate", { body: "[1,2]" })).status).toBe(400);
    expect((await call("/evaluate", { body: "null" })).status).toBe(400);
  });

  it("refuses oversized bodies, both by the declared size and by the real size", async () => {
    const small = { secret: SECRET, maxBodyBytes: 200 };
    expect((await call("/evaluate", { body: schedule }, small)).status).toBe(413);
    expect((await call("/evaluate", { body: "{}", headers: { "content-length": "999999" } }, small)).status).toBe(413);
    expect(DEFAULT_MAX_BODY_BYTES).toBe(2 * 1024 * 1024);
  });

  it("uses the strict backup validator: a bad schedule gets a clear 422", async () => {
    const res = await call("/evaluate", { body: { students: "nope", settings: makeSettings() } });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("invalid_schedule");
  });

  it("never echoes what the caller sent back inside an error", async () => {
    const bad = { students: [{ ...makeStudent({ name: "PRIVATE-NAME-4242" }), daysPerWeek: 99 }], settings: makeSettings() };
    const text = await (await call("/evaluate", { body: bad })).text();
    expect(text).not.toContain("PRIVATE-NAME-4242");
  });

  it("says nothing about the cause of an unexpected crash", async () => {
    const exploding = { get secret(): string { throw new Error("boom PRIVATE-DETAIL"); } };
    const res = await call("/evaluate", { body: schedule }, exploding);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("PRIVATE-DETAIL");
  });
});

describe("responses", () => {
  it("are marked do-not-cache and are JSON", async () => {
    const res = await call("/evaluate", { body: schedule });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("POST /evaluate", () => {
  it("re-checks a schedule with the same rules as the app and reports a shift on top of a class", async () => {
    const withClass = makeStudent({ id: "s1", name: "Noa K.", busy: [{ day: "mon", start: 540, end: 590, source: "class" }] });
    const shift = { id: "x", studentId: "s1", day: "mon", start: 540, source: "manual" };
    const res = await call("/evaluate", { body: { students: [withClass], assignments: [shift], settings: makeSettings() } });
    const { evaluation } = await res.json();
    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockingIssues[0].code).toBe("class_conflict");
  });

  it("returns the same version fingerprint the browser publishes with", async () => {
    const shift = { id: "x", studentId: "s1", day: "tue", start: 480, source: "manual" };
    const { evaluation } = await (await call("/evaluate", { body: { ...schedule, assignments: [shift] } })).json();
    expect(evaluation.scheduleVersion).toMatch(/^v1-[0-9a-f]{8}$/);
  });

  it("ignores fields it does not know about instead of trusting them", async () => {
    const res = await call("/evaluate", { body: { ...schedule, isAdmin: true, __proto__: { hacked: true } } });
    expect(res.status).toBe(200);
  });
});

describe("POST /generate", () => {
  it("builds a schedule with the same auto-fill as the app, and the result checks out", async () => {
    const res = await call("/generate", { body: schedule });
    const out = await res.json();
    expect(res.status).toBe(200);
    expect(out.deterministic).toBe(true);
    expect(out.assignments.length).toBeGreaterThan(0);
    expect(out.evaluation.ok).toBe(true);
    expect(out.explanations.length).toBeGreaterThan(0);
  });

  it("is deterministic: the same roster always gets exactly the same answer", async () => {
    const a = await (await call("/generate", { body: schedule })).text();
    const b = await (await call("/generate", { body: schedule })).text();
    expect(a).toBe(b);
  });

  it("keeps hand-placed shifts and only rebuilds automatic ones when asked", async () => {
    const first = await (await call("/generate", { body: schedule })).json();
    const manual = { id: "keep", studentId: "s1", day: "fri", start: 16 * 60, source: "manual" };
    const again = await (await call("/generate", { body: { ...schedule, assignments: [manual, ...first.assignments], replaceAutoFilled: true } })).json();
    expect(again.assignments.some((a: { id: string }) => a.id === "keep")).toBe(true);
  });
});
