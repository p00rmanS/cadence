import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, NO_CUTOFF, SLOW_AUTOFILL_STUDENTS } from "../features/scheduling/constants";
import { STORAGE_KEY } from "../features/persistence/storage";
import { useShiftFitStore } from "../hooks/useShiftFitStore";

/**
 * Tests for the "Building the schedule" message. A big roster makes auto-fill freeze the page for a few
 * seconds, so the store first raises `autoFilling` (the page shows a message), then runs the fill a moment
 * later. A small roster must still fill instantly, with no message and no delay.
 */

/** Saves a roster of `count` made-up students (no shifts yet) the way the app saves its own data, so the store loads it. */
function seedRoster(count: number): void {
  const students = Array.from({ length: count }, (_, i) => ({
    id: `s${i}`, name: `Student ${i}`, color: "#1F6FB2", preference: "any", daysPerWeek: 5, classText: "", blockedText: "",
    busy: [], latestEnd: NO_CUTOFF, breaks: [], needsOpeningShift: false,
  }));
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, settings: DEFAULT_SETTINGS, students, assignments: [], otherTermAssignments: [], selectedStudentId: "s0", semester: null }),
  );
}

describe("auto-fill busy message", () => {
  beforeEach(() => window.localStorage.clear());

  it("a small roster fills instantly with no message", () => {
    seedRoster(SLOW_AUTOFILL_STUDENTS - 1);
    const { result } = renderHook(() => useShiftFitStore());
    act(() => result.current.runAutoFill(false));
    expect(result.current.autoFilling).toBe(false);
    expect(result.current.assignments.length).toBeGreaterThan(0);
  });

  it("a big roster shows the message first, then fills, then hides it", async () => {
    seedRoster(SLOW_AUTOFILL_STUDENTS);
    const { result } = renderHook(() => useShiftFitStore());
    act(() => result.current.runAutoFill(false));
    expect(result.current.autoFilling).toBe(true);
    expect(result.current.assignments.length).toBe(0);
    await waitFor(() => expect(result.current.autoFilling).toBe(false), { timeout: 20_000 });
    expect(result.current.assignments.length).toBeGreaterThan(0);
  }, 30_000);
});
