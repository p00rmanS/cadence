/**
 * ============================================================================
 *  TESTS: THE "REVIEW YOUR SCHEDULE" PANEL AND ITS "WHAT YOU CAN DO NEXT" BUTTONS
 * ============================================================================
 * A professor looking at the phone version said the "Health" tab "does not do anything": once a schedule was
 * finished, the page was a green box and some numbers, with nothing to press. The tab is now called
 * "Review", says in one line what it is for, and always offers real buttons: fill the empty times, print, and
 * send/back up. These tests protect that: the right main button for each situation, and each button does its job.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsightsPanel } from "../components/summary/InsightsPanel";
import { makeSettings, makeStudent, run } from "./testkit";
import type { Day } from "../features/scheduling/types";

/** A tiny office open 8:00-9:00am Monday to Friday, so "fully covered" needs only ten shifts. */
const settings = makeSettings({ openTime: 8 * 60, closeTime: 9 * 60, openDays: "mon-fri" });
const students = [makeStudent({ id: "s1", name: "Noa K." })];
const week: Day[] = ["mon", "tue", "wed", "thu", "fri"];
const fullWeek = week.flatMap((day) => run("s1", day, 8 * 60, 9 * 60));

/** Draws the panel with spy functions for the three buttons and returns them. */
function show(overrides: Partial<Parameters<typeof InsightsPanel>[0]> = {}) {
  const onFillAll = vi.fn();
  const onPrint = vi.fn();
  const onShare = vi.fn();
  render(
    <InsightsPanel
      students={students}
      assignments={[]}
      settings={settings}
      issues={[]}
      lastAutofill={null}
      onSelectStudent={() => undefined}
      onFillGap={() => undefined}
      onFillAll={onFillAll}
      onPrint={onPrint}
      onShare={onShare}
      {...overrides}
    />,
  );
  return { onFillAll, onPrint, onShare, user: userEvent.setup() };
}

describe("Review your schedule", () => {
  it("is called Review, not Health, and says in one line what it is for", () => {
    show();
    expect(screen.getByRole("heading", { name: "Review your schedule" })).toBeTruthy();
    expect(screen.getByText("Checks the week and tells you what to do next.")).toBeTruthy();
    expect(screen.queryByText(/schedule health/i)).toBeNull();
  });

  it("with times still empty: the main button fills them, and Print is not offered yet (nothing to print)", async () => {
    const { user, onFillAll } = show();
    expect(screen.getByRole("heading", { name: "What you can do next" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Fill the empty times/ }));
    expect(onFillAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /Print the schedule/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Send shifts or save a backup/ })).toBeTruthy();
  });

  it("once everything is covered: Print is the main button, Fill is gone, and both other buttons work", async () => {
    const { user, onFillAll, onPrint, onShare } = show({ assignments: fullWeek });
    expect(screen.getByText("Every hour is covered")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Fill the empty times/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Print the schedule/ }));
    expect(onPrint).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /Send shifts or save a backup/ }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(onFillAll).not.toHaveBeenCalled();
  });

  it("gives words on every button (a title and one line), not only an icon", () => {
    show({ assignments: fullWeek });
    for (const button of screen.getAllByRole("button", { name: /Print the schedule|Send shifts or save a backup/ })) {
      expect(button.textContent?.length ?? 0).toBeGreaterThan(30);
    }
  });

  it("shows no action list before there is a student (the next-step banner covers that)", () => {
    show({ students: [] });
    expect(screen.queryByRole("heading", { name: "What you can do next" })).toBeNull();
  });

  it("shows no action list when the buttons were not given (the panel still works on its own)", () => {
    show({ onFillAll: undefined, onPrint: undefined, onShare: undefined });
    expect(screen.queryByRole("heading", { name: "What you can do next" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Review your schedule" })).toBeTruthy();
  });
});
