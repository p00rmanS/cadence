import { describe, expect, it } from "vitest";
import { FAQ, FAQ_TOPICS, GLOSSARY, SHORTCUTS } from "../content/help";
import { nextStep } from "../features/scheduling/guidance";
import type { GuidanceInput } from "../features/scheduling/guidance";

const base: GuidanceInput = { studentCount: 3, shiftCount: 40, blockingIssues: 0, gapSlots: 0, studentsBelowTarget: 0 };

describe("nextStep tells a newcomer what to do next", () => {
  it("starts with adding a student", () => {
    const g = nextStep({ ...base, studentCount: 0, shiftCount: 0 });
    expect(g.action?.kind).toBe("add-student");
    expect(g.tone).toBe("start");
  });

  it("then suggests filling the schedule", () => {
    const g = nextStep({ ...base, shiftCount: 0 });
    expect(g.action?.kind).toBe("auto-fill");
  });

  it("puts broken rules ahead of empty times", () => {
    const g = nextStep({ ...base, blockingIssues: 2, gapSlots: 10 });
    expect(g.tone).toBe("problem");
    expect(g.title).toBe("2 problems need fixing");
    expect(nextStep({ ...base, blockingIssues: 1 }).title).toBe("1 problem needs fixing");
  });

  it("counts gaps in hours, not half-hour boxes", () => {
    expect(nextStep({ ...base, gapSlots: 5 }).title).toBe("2.5 hours still need someone");
    expect(nextStep({ ...base, gapSlots: 2 }).title).toBe("1 hour still needs someone");
  });

  it("congratulates when everything is fine, and only nudges about hours gently", () => {
    const done = nextStep(base);
    expect(done.tone).toBe("good");
    expect(done.action?.kind).toBe("save-share");
    const below = nextStep({ ...base, studentsBelowTarget: 2 });
    expect(below.tone).toBe("good");
    expect(below.body).toMatch(/2 students are under/);
    expect(nextStep({ ...base, studentsBelowTarget: 1 }).body).toMatch(/1 student is under/);
  });
});

describe("help content", () => {
  it("has unique ids, real topics and non-empty answers", () => {
    const ids = FAQ.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FAQ) {
      expect(FAQ_TOPICS, f.id).toContain(f.topic);
      expect(f.question.trim().length, f.id).toBeGreaterThan(5);
      expect(f.answer.length, f.id).toBeGreaterThan(0);
      expect(f.answer.every((p) => p.trim().length > 10), f.id).toBe(true);
    }
  });

  it("has every topic filled in, so no empty section appears", () => {
    for (const topic of FAQ_TOPICS) expect(FAQ.some((f) => f.topic === topic), topic).toBe(true);
  });

  it("uses the exact button names people will see on screen", () => {
    const all = FAQ.flatMap((f) => f.answer).join(" ");
    for (const label of ["Add student", "Fill schedule for me", "Rebuild automatic shifts", "Save & share", "Save a backup file", "Load a backup file", "Schedule health", "Rules", "Undo", "By student", "Copy as text", "Print", "Days off", "Add several at once", "Quick fix"]) {
      expect(all, label).toContain(label);
    }
  });

  it("explains its jargon, and lists shortcuts", () => {
    expect(GLOSSARY.length).toBeGreaterThan(5);
    expect(SHORTCUTS.some((s) => s.action === "Undo")).toBe(true);
  });

  it("keeps sentences short enough for a first-time reader", () => {
    for (const f of FAQ) {
      for (const paragraph of f.answer) {
        for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
          expect(sentence.split(/\s+/).length, `${f.id}: ${sentence}`).toBeLessThanOrEqual(45);
        }
      }
    }
  });
});
