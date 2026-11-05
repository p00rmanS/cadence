import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { DEFAULT_SETTINGS } from "../features/scheduling/constants";
import { buildDemoData } from "../features/scheduling/demo-data";
import { buildRoster, describeStretches, rosterCounts, rosterEntry, weekMap } from "../features/scheduling/rosterView";
import { validatePersistedState } from "../features/scheduling/validation";
import type { FormerStudent } from "../features/scheduling/types";

/**
 * The roster: the wide student list that shows who is working, who needs hours and when each student is
 * free, with filters for a long list; plus what happens to a student who graduates or leaves. The logic
 * is tested as plain functions first, then through the screen the way a manager would use it.
 */

const demo = buildDemoData();
const settings = DEFAULT_SETTINGS;

describe("the roster's logic", () => {
  it("says where each student stands", () => {
    const troy = demo.students.find((s) => s.name === "Troy C.")!;
    const leilani = demo.students.find((s) => s.name === "Leilani P.")!;
    expect(rosterEntry(troy, demo.assignments, settings).status).toBe("full");
    expect(rosterEntry(leilani, [], settings).status).toBe("unscheduled");
    const some = demo.assignments.filter((a) => a.studentId === troy.id).slice(0, 8);
    const partway = rosterEntry(troy, some, settings);
    expect(partway.status).toBe("needs");
    expect(partway.label).toMatch(/^Needs .* more$/);
  });

  it("marks each half hour of a student's week as working, free or can't work", () => {
    const troy = demo.students.find((s) => s.name === "Troy C.")!;
    const week = weekMap(troy, demo.assignments, settings);
    const everySlot = week.flatMap((d) => d.slots);
    expect(everySlot.some((s) => s.state === "scheduled")).toBe(true);
    expect(everySlot.some((s) => s.state === "busy")).toBe(true);
    // the words list the same stretches the strip draws
    expect(describeStretches(week, "scheduled", settings.slotMinutes)).toMatch(/^Mon /);
    const none = weekMap(troy, [], settings);
    expect(describeStretches(none, "scheduled", settings.slotMinutes)).toBe("");
  });

  it("filters, searches and sorts a long list", () => {
    const options = { query: "", filter: "all" as const, sort: "name" as const };
    expect(buildRoster(demo.students, demo.assignments, settings, options)).toHaveLength(demo.students.length);
    const needing = buildRoster(demo.students, demo.assignments, settings, { ...options, filter: "needs" });
    expect(needing.every((e) => e.status === "needs" || e.status === "unscheduled")).toBe(true);
    expect(needing.map((e) => e.student.name)).not.toContain("Troy C.");
    expect(buildRoster(demo.students, demo.assignments, settings, { ...options, query: "leil" }).map((e) => e.student.name)).toEqual(["Leilani P."]);
    const byNeed = buildRoster(demo.students, demo.assignments, settings, { ...options, sort: "needs" });
    expect(byNeed[0].hoursLeft).toBeGreaterThanOrEqual(byNeed[byNeed.length - 1].hoursLeft);
    expect(rosterCounts(demo.students, demo.assignments, settings).all).toBe(demo.students.length);
  });
});

describe("saving students who have left", () => {
  const base = { version: 1, settings, assignments: [], semester: null, selectedStudentId: null };
  const former: FormerStudent = { ...demo.students[0], id: "gone1", name: "Old Student", leftReason: "resigned", leftOn: "2026-10-01" };

  it("keeps them and why they left", () => {
    const result = validatePersistedState({ ...base, students: [demo.students[1]], formerStudents: [former] });
    expect(result.ok && result.value.formerStudents).toEqual([expect.objectContaining({ name: "Old Student", leftReason: "resigned", leftOn: "2026-10-01" })]);
  });

  it("is not required, and drops one that is broken or has the same id as a current student", () => {
    expect(validatePersistedState({ ...base, students: [demo.students[1]] }).ok).toBe(true);
    const clash = { ...former, id: demo.students[1].id };
    const result = validatePersistedState({ ...base, students: [demo.students[1]], formerStudents: [clash, { name: 5 }] });
    expect(result.ok && result.value.formerStudents).toBeUndefined();
  });
});

describe("a student who graduates or leaves, on screen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("shiftfit:welcomed", "1");
  });
  afterEach(cleanup);

  it("moves to Former students with their shifts off the schedule, and can be brought back", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("button", { name: /^Monday 8:00am to 8:30am. Working: Troy C./ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Mark Troy C. as leaving or graduating" }));
    const dialog = screen.getByRole("dialog", { name: /Troy C\. is leaving/ });
    await user.click(within(dialog).getByRole("radio", { name: /They have left/ }));
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /why did they leave/i }), "resigned");
    await user.click(within(dialog).getByRole("button", { name: "Move to former students" }));

    // gone from the list and the grid, shown in Former students with the reason, and the toast says hours opened up
    expect(screen.queryByRole("button", { name: /^Troy C\./ })).toBeNull();
    expect(screen.getByText("Former students (1)")).toBeTruthy();
    expect(screen.getByText(/Resigned/)).toBeTruthy();
    expect(screen.getByText(/19 hours are now open/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Monday 8:00am to 8:30am. Nobody is working. Needs 1 more/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Bring back Troy C." }));
    expect(screen.getByRole("button", { name: /^Troy C\./ })).toBeTruthy();
    expect(screen.queryByText(/Former students/)).toBeNull();
  });

  it("can be undone like any other change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Mark Troy C. as leaving or graduating" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /They have left/ }));
    await user.click(within(dialog).getByRole("button", { name: "Move to former students" }));
    expect(screen.queryByRole("button", { name: /^Troy C\./ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /^undo/i }));
    expect(screen.getByRole("button", { name: /^Troy C\./ })).toBeTruthy();
    expect(screen.queryByText(/Former students/)).toBeNull();
  });

  it("marks a student as graduating without taking them off the schedule, and keeps the mark after an edit", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Mark Troy C. as leaving or graduating" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark as graduating" }));
    expect(screen.getByText("Graduating")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Troy C\./ })).toBeTruthy(); // still on the list, still scheduled

    await user.click(screen.getByRole("button", { name: "Edit Troy C." }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^save/i }));
    expect(screen.getByText("Graduating")).toBeTruthy();
  });

  it("deletes a former student for good only after asking", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Mark Troy C. as leaving or graduating" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /They have left/ }));
    await user.click(within(dialog).getByRole("button", { name: "Move to former students" }));
    await user.click(screen.getByRole("button", { name: "Delete Troy C. for good" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete for good" }));
    expect(screen.queryByText(/Former students/)).toBeNull();
  });
});

describe("the roster look of the student list", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("shiftfit:welcomed", "1");
  });
  afterEach(cleanup);

  it("opens from the Roster button, filters the list, and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole("group", { name: /show which students/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /open the roster/i }));
    const chips = screen.getByRole("group", { name: /show which students/i });
    expect(within(chips).getByRole("button", { name: /Everyone/ })).toBeTruthy();
    expect(window.localStorage.getItem("shiftfit:roster-wide")).toBe("1");

    // each student shows what they are doing and when they are free, in words
    expect(screen.getAllByText("Free times").length).toBeGreaterThan(5);
    expect(screen.getAllByText(/Not scheduled yet/).length).toBeGreaterThan(0);

    await user.click(within(chips).getByRole("button", { name: /At their hours/ }));
    const list = screen.getByRole("list", { name: "Student list" });
    expect(within(list).getByRole("button", { name: /^Troy C\./ })).toBeTruthy();
    expect(within(list).queryByRole("button", { name: /^Leilani P\./ })).toBeNull();
  });
});
