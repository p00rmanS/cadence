import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { DEFAULT_SETTINGS } from "../features/scheduling/constants";
import { buildDemoData } from "../features/scheduling/demo-data";
import { STORAGE_KEY } from "../features/persistence/storage";

/**
 * With 40 or 50 students many people can work the same half hour. A box with too many name tags would
 * stretch its whole column and push the week off the screen, so a busy box shows a count ("5 working")
 * instead, while a screen reader still hears every name.
 */

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("shiftfit:welcomed", "1");
});
afterEach(cleanup);

/** Saves a schedule where the first `count` sample students all work Monday 7:00 to 9:00am, then shows the app. */
function renderWithCrowd(count: number) {
  const demo = buildDemoData();
  const students = demo.students.slice(0, count);
  const assignments = students.flatMap((s) =>
    [420, 450, 480, 510].map((start) => ({ id: `${s.id}-${start}`, studentId: s.id, day: "mon" as const, start, source: "manual" as const })),
  );
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, settings: DEFAULT_SETTINGS, students, assignments, otherTermAssignments: [], selectedStudentId: students[0].id, semester: null }),
  );
  render(<App />);
}

describe("a box with many people working", () => {
  it("shows a count once instead of a name tag for everyone, and still names everyone for screen readers", () => {
    renderWithCrowd(5);
    const first = screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ });
    expect(first.textContent).toMatch(/5 working/);
    // the box below it has the same crowd, so it only draws a thin bar and does not repeat the count
    expect(screen.getByRole("button", { name: /^Monday 7:30am to 8:00am/ }).textContent).not.toMatch(/working/);
    // everyone is still named in the spoken description
    const spoken = first.getAttribute("aria-label") ?? "";
    for (const name of buildDemoData().students.slice(0, 5).map((s) => s.name)) expect(spoken).toContain(name);
  });

  it("still shows each name when only a few people work the box", () => {
    renderWithCrowd(3);
    const first = screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ });
    expect(first.textContent).not.toMatch(/working/);
    expect(first.textContent?.length).toBeGreaterThan(0);
  });
});

describe("choosing who else works a time when there are many students", () => {
  it("can be searched, and says how many are picked", () => {
    const demo = buildDemoData();
    const students = Array.from({ length: 30 }, (_, i) => ({ ...demo.students[i % demo.students.length], id: `many-${i}`, name: `Student ${i + 1} X.` }));
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, settings: DEFAULT_SETTINGS, students, assignments: [], otherTermAssignments: [], selectedStudentId: students[0].id, semester: null }),
    );
    render(<App />);
    const dataTransfer = {
      data: {} as Record<string, string>,
      get types() {
        return Object.keys(this.data);
      },
      setData(type: string, value: string) {
        this.data[type] = value;
      },
      getData(type: string) {
        return this.data[type] ?? "";
      },
      effectAllowed: "",
      dropEffect: "",
    };
    const target = screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ });
    fireEvent.dragStart(screen.getByText("Student 1 X.", { selector: "span" }).closest("li")!, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    expect(screen.getAllByRole("checkbox")).toHaveLength(29);
    fireEvent.change(screen.getByRole("searchbox", { name: /find a student to add/i }), { target: { value: "Student 17" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.click(screen.getByRole("checkbox", { name: /Student 17 X\./ }));
    expect(screen.getByText(/1 picked/)).toBeTruthy();
    // a student who is picked stays in the list even when the search no longer matches them
    fireEvent.change(screen.getByRole("searchbox", { name: /find a student to add/i }), { target: { value: "zzz" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });
});
