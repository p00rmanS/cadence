import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { DEFAULT_SETTINGS, MIN_STAFF_OPTIONS, PEOPLE_CHOICES } from "../features/scheduling/constants";
import { buildDemoData } from "../features/scheduling/demo-data";
import { buildPrintedGrid } from "../features/scheduling/printView";
import { STORAGE_KEY } from "../features/persistence/storage";

/**
 * Features asked for in the meeting with the manager: one-hour boxes next to half-hour boxes, a small
 * "who is working" card on hover (with pictures and hours), a clean printed schedule, hours shown while
 * placing someone, room for seven or more people in one hour, and a 20-student sample.
 */

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("shiftfit:welcomed", "1");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Saves a week where the first `count` sample students all work Monday 7:00 to 9:00am, then shows the app with `selected` picked. */
function renderWithCrowd(count: number, selected = "s4") {
  const demo = buildDemoData();
  const students = demo.students;
  const assignments = students.slice(0, count).flatMap((s) =>
    [420, 450, 480, 510].map((start) => ({ id: `${s.id}-${start}`, studentId: s.id, day: "mon" as const, start, source: "manual" as const })),
  );
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, settings: DEFAULT_SETTINGS, students, assignments, otherTermAssignments: [], selectedStudentId: selected, semester: null }),
  );
  render(<App />);
}

/** A pretend drag-and-drop payload, the same shape the browser hands to drag events. */
function makeDataTransfer() {
  return {
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
}

describe("the sample roster", () => {
  it("has twenty made-up students", () => {
    expect(buildDemoData().students).toHaveLength(20);
  });
});

describe("how many people a time can need", () => {
  it("offers up to seven in the top bar and up to ten when placing or in Busy times", () => {
    expect(MIN_STAFF_OPTIONS).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(PEOPLE_CHOICES).toHaveLength(10);
    renderWithCrowd(0);
    const group = screen.getByRole("group", { name: "People needed at once" });
    expect(within(group).getAllByRole("button")).toHaveLength(7);
  });
});

describe("a box with four to eight people", () => {
  it("shows a small initials tag for each person, and a count only above eight", () => {
    renderWithCrowd(7);
    const box = screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ });
    // seven people: seven tags, no "working" count
    expect(box.textContent).not.toMatch(/working/);
    expect(box.querySelectorAll("[draggable=true]")).toHaveLength(7);
    cleanup();
    window.localStorage.clear();
    window.localStorage.setItem("shiftfit:welcomed", "1");
    renderWithCrowd(9);
    expect(screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ }).textContent).toMatch(/9 working/);
  });
});

describe("one-hour boxes", () => {
  it("can be switched on, remembered, and add both half hours with one click", () => {
    renderWithCrowd(0);
    fireEvent.click(screen.getByRole("button", { name: "1 hour" }));
    expect(window.localStorage.getItem("shiftfit:block-size")).toBe("60");
    // one box now covers the whole hour, and there is no separate 7:30 box
    expect(screen.queryByRole("button", { name: /^Monday 7:30am to 8:00am/ })).toBeNull();
    const hour = screen.getByRole("button", { name: /^Monday 7:00am to 8:00am/ });
    fireEvent.click(hour);
    // going back to half hours shows the student on both halves
    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    expect(screen.getByRole("button", { name: /^Monday 7:00am to 7:30am. Working: Mele T\./ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Monday 7:30am to 8:00am. Working: Mele T\./ })).toBeTruthy();
  });

  it("lists everyone who works any part of the hour", () => {
    renderWithCrowd(3);
    fireEvent.click(screen.getByRole("button", { name: "1 hour" }));
    const label = screen.getByRole("button", { name: /^Monday 7:00am to 8:00am/ }).getAttribute("aria-label") ?? "";
    for (const name of ["Troy C.", "Leilani P.", "Kekoa M."]) expect(label).toContain(name);
  });
});

describe("the who-is-working card", () => {
  it("shows each person, their shift and their weekly hours when the mouse rests on a box", () => {
    vi.useFakeTimers();
    renderWithCrowd(3);
    expect(screen.queryByTestId("who-is-working-card")).toBeNull();
    fireEvent.mouseEnter(screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const card = screen.getByTestId("who-is-working-card");
    expect(card.textContent).toContain("Monday, 7:00am–7:30am");
    expect(card.textContent).toContain("3 working");
    expect(card.textContent).toContain("Troy C.");
    expect(card.textContent).toContain("7:00am–9:00am");
    expect(card.textContent).toMatch(/2 of 19 hrs this week/);
    // leaving the grid takes the card away
    fireEvent.mouseLeave(screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ }).closest("tbody")!);
    expect(screen.queryByTestId("who-is-working-card")).toBeNull();
  });

  it("does not show for a box nobody works", () => {
    vi.useFakeTimers();
    renderWithCrowd(0);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByTestId("who-is-working-card")).toBeNull();
  });
});

describe("hours while placing someone", () => {
  it("shows what the student has, what the times add, and the total", () => {
    renderWithCrowd(0);
    const dataTransfer = makeDataTransfer();
    const target = screen.getByRole("button", { name: /^Monday 7:00am to 7:30am/ });
    fireEvent.dragStart(screen.getAllByText("Troy C.", { selector: "span" })[0].closest("li")!, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/Troy C\. has 0 of 19 hours this week\. These times add 2, making 2 of 19\./);
    // every other student shows their hours next to their name in the "also working" list
    expect(within(dialog).getAllByText(/0\/\d+ hrs/).length).toBeGreaterThan(5);
    // up to ten people can be asked for
    const needed = within(dialog).getByRole("combobox", { name: /people needed/i });
    expect(within(needed).getAllByRole("option")).toHaveLength(10);
  });
});

describe("the printed schedule", () => {
  it("spells out every name per hour and marks people who work only half an hour", () => {
    const demo = buildDemoData();
    const assignments = [
      { id: "a", studentId: "s1", day: "mon" as const, start: 420, source: "manual" as const },
      { id: "b", studentId: "s1", day: "mon" as const, start: 450, source: "manual" as const },
      { id: "c", studentId: "s2", day: "mon" as const, start: 450, source: "manual" as const },
    ];
    const grid = buildPrintedGrid(demo.students, assignments, DEFAULT_SETTINGS);
    const monday7 = grid.rows[0].cells.mon;
    expect(monday7.people.map((p) => [p.name, p.half])).toEqual([
      ["Leilani P.", true],
      ["Troy C.", false],
    ]);
    expect(monday7.needMore).toBe(0);
    // an hour nobody works still needs one person
    expect(grid.rows[1].cells.mon.needMore).toBe(1);
    // the Tuesday devotional is closed, not "needs someone"
    const tuesdayRows = grid.rows.map((r) => r.cells.tue);
    expect(tuesdayRows.some((c) => c.closed)).toBe(true);
  });

  it("opens the browser's print window with a clean page, and removes the page afterwards", () => {
    vi.useFakeTimers();
    window.print = vi.fn();
    renderWithCrowd(3);
    expect(screen.queryByTestId("print-schedule")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Print schedule" }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(window.print).toHaveBeenCalledTimes(1);
    const page = screen.getByTestId("print-schedule");
    expect(page.textContent).toContain("Work schedule");
    expect(page.textContent).toContain("Troy C.");
    expect(page.textContent).toContain("Hours and shifts, by person");
    expect(document.documentElement.classList.contains("printing-schedule")).toBe(true);
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(screen.queryByTestId("print-schedule")).toBeNull();
    expect(document.documentElement.classList.contains("printing-schedule")).toBe(false);
  });
});

describe("sharing and installing", () => {
  it("offers a Teams copy button and install steps in Save & share", () => {
    renderWithCrowd(3);
    fireEvent.click(screen.getByRole("button", { name: /Save & share/ }));
    expect(screen.getByRole("button", { name: /paste into Microsoft Teams/i })).toBeTruthy();
    const open = screen.getByRole("link", { name: /Open Teams/ });
    expect(open.getAttribute("href")).toBe("https://teams.microsoft.com/");
    expect(open.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText(/Add to Home Screen/)).toBeTruthy();
  });
});
