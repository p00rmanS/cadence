import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateExtractedSchedule } from "../features/import/schemas";
import { checkImageFile, extractSchedule } from "../features/import/schedule-extractor";
import { buildPublishRequest, summarizePublish, validatePublishResponse } from "../services/automation/contracts";
import type { PublishRequest, PublishResponse } from "../services/automation/contracts";
import { createMockAutomationClient } from "../services/automation/mockAutomationClient";
import type { SemesterConfig } from "../features/scheduling/types";
import { makeSettings, makeStudent, run } from "./testkit";

const students = [makeStudent({ id: "s1", name: "Noa K." })];
const shifts = [...run("s1", "mon", 8 * 60, 10 * 60), ...run("s1", "wed", 8 * 60, 9 * 60)];
const request: PublishRequest = buildPublishRequest(students, shifts, makeSettings(), null);

describe("publish request", () => {
  it("sends one event per contiguous shift with stable ids, and no recurrence when no semester is configured", () => {
    expect(request.events).toEqual([
      { studentId: "s1", studentName: "Noa K.", day: "mon", start: 480, end: 600, shiftId: "s1-mon-480" },
      { studentId: "s1", studentName: "Noa K.", day: "wed", start: 480, end: 540, shiftId: "s1-wed-480" },
    ]);
    expect(request.scheduleVersion).toMatch(/^v6-[0-9a-f]{8}$/);
  });

  it("computes real recurring dates once a semester is configured, reusing the same math as the .ics export", () => {
    // 2026-09-14 is a Monday, so the first Monday occurrence is the start date itself.
    const semester: SemesterConfig = { startDate: "2026-09-14", endDate: "2026-10-02", timeZone: "Pacific/Honolulu", skipDates: ["2026-09-21"] };
    const withDates = buildPublishRequest(students, shifts, makeSettings(), semester);
    const mon = withDates.events.find((e) => e.day === "mon")!;
    expect(mon.recurrence).toEqual({
      startIso: "2026-09-14T08:00:00",
      endIso: "2026-09-14T10:00:00",
      timeZone: "Pacific/Honolulu",
      rrule: "FREQ=WEEKLY;COUNT=3",
      exdates: ["2026-09-21T08:00:00"],
    });
    const wed = withDates.events.find((e) => e.day === "wed")!;
    expect(wed.recurrence?.exdates).toEqual([]); // 2026-09-21 is a Monday, so it doesn't affect the Wednesday shift.
  });

  it("omits recurrence for a day whose first occurrence falls after the semester ends", () => {
    // Ends the Tuesday after the Monday start: the Monday shift still has one occurrence, but
    // the first Wednesday on/after the start date (the 16th) is past the end date.
    const semester: SemesterConfig = { startDate: "2026-09-14", endDate: "2026-09-15", timeZone: "Pacific/Honolulu" };
    const withDates = buildPublishRequest(students, shifts, makeSettings(), semester);
    expect(withDates.events.find((e) => e.day === "mon")!.recurrence?.rrule).toBe("FREQ=WEEKLY;COUNT=1");
    expect(withDates.events.find((e) => e.day === "wed")!.recurrence).toBeUndefined();
  });
});

describe("publish response validation", () => {
  const good: PublishResponse = {
    scheduleVersion: request.scheduleVersion,
    results: [
      { shiftId: "s1-mon-480", status: "created", googleEventId: "abc" },
      { shiftId: "s1-wed-480", status: "updated" },
    ],
  };

  it("accepts a well-formed response", () => {
    expect(validatePublishResponse(good, request).ok).toBe(true);
  });

  it("rejects garbage and results for shifts we never sent", () => {
    for (const bad of [null, "ok", 5, {}, { scheduleVersion: "x", results: "no" }]) expect(validatePublishResponse(bad, request).ok).toBe(false);
    expect(validatePublishResponse({ ...good, results: [{ shiftId: "someone-else", status: "created" }] }, request).ok).toBe(false);
    expect(validatePublishResponse({ ...good, results: [{ shiftId: "s1-mon-480", status: "great success" }] }, request).ok).toBe(false);
  });
});

describe("sync state is honest", () => {
  it("is synced only when everything succeeded", () => {
    const res: PublishResponse = { scheduleVersion: "v", results: request.events.map((e) => ({ shiftId: e.shiftId, status: "created" as const })) };
    expect(summarizePublish(request, res)).toMatchObject({ state: "synced", created: 2, failed: 0, missing: 0 });
  });

  it("is partial when some fail or are never reported", () => {
    const some: PublishResponse = {
      scheduleVersion: "v",
      results: [{ shiftId: "s1-mon-480", status: "created" }, { shiftId: "s1-wed-480", status: "failed", error: "quota" }],
    };
    expect(summarizePublish(request, some).state).toBe("partially_synced");
    const silent: PublishResponse = { scheduleVersion: "v", results: [{ shiftId: "s1-mon-480", status: "created" }] };
    expect(summarizePublish(request, silent)).toMatchObject({ state: "partially_synced", missing: 1 });
  });

  it("is failed when nothing worked", () => {
    const none: PublishResponse = { scheduleVersion: "v", results: request.events.map((e) => ({ shiftId: e.shiftId, status: "failed" as const })) };
    expect(summarizePublish(request, none).state).toBe("sync_failed");
  });

  it("never calls a mock practice run 'synced'", async () => {
    const response = await createMockAutomationClient().publishSchedule(request);
    const summary = summarizePublish(request, response);
    expect(summary.dryRun).toBe(true);
    expect(summary.state).toBe("not_synced");
  });
});

describe("screenshot reading is optional and safe", () => {
  const valid = {
    requestId: "r1",
    status: "needs_review",
    confidence: 0.9,
    meetings: [{ day: "tue", start: 480, end: 555, source: "class" }],
    constraints: { latestEnd: 960, lunchStart: 720, needsOpeningShift: true, preference: "morning", daysPerWeek: 3 },
    warnings: [],
    unresolved: [],
  };

  it("accepts a well-formed extraction", () => {
    expect(validateExtractedSchedule(valid).ok).toBe(true);
  });

  it("rejects impossible or hostile data", () => {
    for (const bad of [
      null,
      { ...valid, confidence: 5 },
      { ...valid, meetings: [{ day: "sun", start: 1, end: 2 }] },
      { ...valid, meetings: [{ day: "mon", start: 600, end: 500 }] },
      { ...valid, meetings: [{ day: "mon", start: -5, end: 500 }] },
      { ...valid, status: "definitely fine" },
    ]) {
      expect(validateExtractedSchedule(bad).ok).toBe(false);
    }
  });

  it("clamps out-of-range constraints instead of trusting them", () => {
    const r = validateExtractedSchedule({ ...valid, constraints: { latestEnd: 99999, daysPerWeek: 42, preference: "<b>x</b>" } });
    expect(r.ok && r.value.constraints).toMatchObject({ latestEnd: null, daysPerWeek: null, preference: "any" });
  });

  it("bounds free-text warnings", () => {
    const r = validateExtractedSchedule({ ...valid, warnings: Array.from({ length: 100 }, () => "x".repeat(1000)) });
    expect(r.ok && r.value.warnings).toHaveLength(20);
    expect(r.ok && r.value.warnings[0]).toHaveLength(300);
  });

  it("checks image type and size before anything is sent", () => {
    expect(checkImageFile(new File(["x"], "a.png", { type: "image/png" }))).toBeNull();
    expect(checkImageFile(new File(["x"], "a.exe", { type: "application/x-msdownload" }))).toMatch(/PNG, JPG or WebP/);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    expect(checkImageFile(big)).toMatch(/5 MB/);
  });

  it("still parses pasted text locally, and never fakes an AI read without a provider", async () => {
    const text = await extractSchedule({ text: "MWF 9:00-9:50" });
    expect(text.source).toBe("local-text");
    expect(text.parse.busy).toHaveLength(3);
    const image = await extractSchedule({ text: "MWF 9:00-9:50", image: new File(["x"], "a.png", { type: "image/png" }) });
    expect(image.ai).toBeUndefined();
    expect(image.error).toBeTruthy();
    expect(image.parse.busy).toHaveLength(3);
  });
});

describe("n8n workflow templates", () => {
  const dir = "n8n";
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("ships the three documented workflows", () => {
    expect(files.sort()).toEqual(["shiftfit-generate.json", "shiftfit-interpret.json", "shiftfit-publish.json"]);
  });

  it.each(files)("%s is valid JSON with connected nodes and no real secrets", (file) => {
    const text = readFileSync(`${dir}/${file}`, "utf8");
    const json = JSON.parse(text);
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(json.nodes.length).toBeGreaterThan(1);
    const names = new Set<string>(json.nodes.map((n: { name: string }) => n.name));
    for (const [from, links] of Object.entries<{ main: { node: string }[][] }>(json.connections)) {
      expect(names.has(from), `${file}: connection from unknown node ${from}`).toBe(true);
      for (const branch of links.main) for (const l of branch) expect(names.has(l.node), `${file}: connection to unknown node ${l.node}`).toBe(true);
    }
    expect(text).not.toMatch(/sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|ya29\.|-----BEGIN|api[_-]?key"\s*:\s*"[^"R]/i);
  });

  it("does not return fake successful data from the AI placeholder", () => {
    const text = readFileSync(`${dir}/shiftfit-interpret.json`, "utf8");
    expect(text).not.toMatch(/confidence: 0\.9/);
  });
});
