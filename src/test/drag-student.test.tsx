import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";

/**
 * Dragging a student card (or an existing shift) onto a time in the schedule opens a pop-up where the manager
 * says when the student works, and confirming it makes the shifts. jsdom has no real drag and drop, so these
 * tests send the same events a browser would, with a small stand-in for the "dataTransfer" object that
 * carries what is being dragged.
 */

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("shiftfit:welcomed", "1");
});
afterEach(cleanup);

/** A stand-in for the browser's dataTransfer: remembers what was set and lists its labels like the real one. */
function makeDataTransfer() {
  const data: Record<string, string> = {};
  return {
    data,
    get types() {
      return Object.keys(data);
    },
    setData: (type: string, value: string) => {
      data[type] = value;
    },
    getData: (type: string) => data[type] ?? "",
    effectAllowed: "",
    dropEffect: "",
  };
}

/** The list card for a student, found by the name on it. */
function card(name: string): HTMLElement {
  const item = screen.getByText(name, { selector: "span" }).closest("li");
  if (!item) throw new Error(`no card for ${name}`);
  return item;
}

/** One box of the grid, found by the start of its spoken description. */
function box(description: RegExp): HTMLElement {
  return screen.getByRole("button", { name: description });
}

/** Picks a time in one of the pop-up's lists. Minutes after midnight: 8:00am is 480, 1:00pm is 780. */
function pickTime(label: string, minutes: number) {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value: String(minutes) } });
}

/** Drags a student card onto a box and lets go. */
function dropCardOn(name: string, boxLabel: RegExp) {
  const dataTransfer = makeDataTransfer();
  fireEvent.dragStart(card(name), { dataTransfer });
  fireEvent.dragOver(box(boxLabel), { dataTransfer });
  fireEvent.drop(box(boxLabel), { dataTransfer });
}

describe("dragging a student onto the schedule", () => {
  it("opens a pop-up, and confirming it gives a two-hour shift starting at the box they were dropped on", () => {
    render(<App />);
    expect(box(/^Monday 7:00am to 7:30am. Nobody is working/)).toBeTruthy();

    dropCardOn("Leilani P.", /^Monday 7:00am to 7:30am/);
    // nothing is added until the manager confirms
    expect(box(/^Monday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Nobody is working/);
    expect(screen.getByRole("dialog", { name: /Schedule Leilani P\./ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add shifts" }));

    for (const start of ["7:00am to 7:30am", "7:30am to 8:00am", "8:00am to 8:30am", "8:30am to 9:00am"]) {
      expect(box(new RegExp(`^Monday ${start}`)).getAttribute("aria-label")).toMatch(/Leilani P\. is working here/);
    }
    // exactly the minimum shift: the next half hour is still empty
    expect(box(/^Monday 9:00am to 9:30am/).getAttribute("aria-label")).not.toMatch(/Leilani P\. is working here/);
  });

  it("lets the manager pick the exact times, and add a second time for the afternoon", () => {
    render(<App />);
    dropCardOn("Leilani P.", /^Monday 7:00am to 7:30am/);

    pickTime("Time 1 starts", 8 * 60 + 30);
    pickTime("Time 1 ends", 9 * 60 + 30);
    fireEvent.click(screen.getByRole("button", { name: /add another time/i }));
    pickTime("Time 2 starts", 13 * 60);
    pickTime("Time 2 ends", 15 * 60);
    fireEvent.click(screen.getByRole("button", { name: "Add shifts" }));

    expect(box(/^Monday 8:30am to 9:00am/).getAttribute("aria-label")).toMatch(/Leilani P\. is working here/);
    expect(box(/^Monday 9:00am to 9:30am/).getAttribute("aria-label")).toMatch(/Leilani P\. is working here/);
    expect(box(/^Monday 9:30am to 10:00am/).getAttribute("aria-label")).not.toMatch(/Leilani P\. is working here/);
    expect(box(/^Monday 1:00pm to 1:30pm/).getAttribute("aria-label")).toMatch(/Leilani P\. is working here/);
    expect(box(/^Monday 2:30pm to 3:00pm/).getAttribute("aria-label")).toMatch(/Leilani P\. is working here/);
    expect(box(/^Monday 3:00pm to 3:30pm/).getAttribute("aria-label")).not.toMatch(/Leilani P\. is working here/);
  });

  it("will not let an end time come before the start time", () => {
    render(<App />);
    dropCardOn("Leilani P.", /^Monday 7:00am to 7:30am/);
    pickTime("Time 1 starts", 10 * 60); // later than the 9:00am end it began with
    expect(screen.getByText(/end must be after the start/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add shifts" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("changes nothing when the pop-up is cancelled", () => {
    render(<App />);
    dropCardOn("Leilani P.", /^Monday 7:00am to 7:30am/);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(box(/^Monday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Nobody is working/);
  });

  /** Picks up Troy's first shift in the grid (his Friday 7:00am to 11:00am in the demo) and drops it on a box. */
  function dragTroysShiftTo(boxLabel: RegExp) {
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(screen.getAllByTitle(/Drag Troy C.'s shift/)[0], { dataTransfer });
    fireEvent.dragOver(box(boxLabel), { dataTransfer });
    fireEvent.drop(box(boxLabel), { dataTransfer });
  }

  it("moves a shift that is dragged from the grid to another time, and the old one goes away", () => {
    render(<App />);
    dragTroysShiftTo(/^Wednesday 7:00am to 7:30am/);

    expect(screen.getByRole("dialog", { name: /Move Troy C.'s shift/ })).toBeTruthy();
    pickTime("Time 1 ends", 8 * 60); // his Wednesday class-free hour before 8:00am
    fireEvent.click(screen.getByRole("button", { name: "Move shift" }));

    expect(box(/^Wednesday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Troy C. is working here/);
    expect(box(/^Friday 7:00am to 7:30am/).getAttribute("aria-label")).not.toMatch(/Troy C. is working here/);
  });

  it("keeps the original shift when the move is not allowed (Troy only works 3 days a week)", () => {
    render(<App />);
    dragTroysShiftTo(/^Tuesday 7:00am to 7:30am/);
    fireEvent.click(screen.getByRole("button", { name: "Move shift" }));

    expect(screen.getByText(/only works 3 days a week/)).toBeTruthy();
    expect(box(/^Tuesday 7:00am to 7:30am/).getAttribute("aria-label")).not.toMatch(/Troy C. is working here/);
    expect(box(/^Friday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Troy C. is working here/);
  });

  it("outlines the start while the card is held over a box, and clears it after", () => {
    render(<App />);
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(card("Leilani P."), { dataTransfer });
    fireEvent.dragOver(box(/^Monday 7:00am to 7:30am/), { dataTransfer });
    expect(screen.getByText(/Let go to choose their times, starting at 7:00am/)).toBeTruthy();
    expect(box(/^Monday 8:30am to 9:00am/).className).toMatch(/outline-accent/);
    expect(box(/^Monday 9:00am to 9:30am/).className).not.toMatch(/outline-accent/);

    fireEvent.drop(box(/^Monday 7:00am to 7:30am/), { dataTransfer });
    expect(screen.queryByText(/Let go to choose/)).toBeNull();
  });

  it("ignores anything that is not a student card (a dragged file or text does nothing)", () => {
    render(<App />);
    const notAStudent = { ...makeDataTransfer(), types: ["Files"], getData: () => "" };
    const allowed = fireEvent.dragOver(box(/^Monday 7:00am to 7:30am/), { dataTransfer: notAStudent });
    expect(allowed).toBe(true); // true means nobody called preventDefault, so the browser will not accept the drop
    fireEvent.drop(box(/^Monday 7:00am to 7:30am/), { dataTransfer: notAStudent });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(box(/^Monday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Nobody is working/);
  });

  it("can be undone like any other change", () => {
    render(<App />);
    dropCardOn("Leilani P.", /^Monday 7:00am to 7:30am/);
    fireEvent.click(screen.getByRole("button", { name: "Add shifts" }));
    expect(box(/^Monday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Leilani P\. is working here/);

    fireEvent.click(screen.getByRole("button", { name: /^undo/i }));
    expect(box(/^Monday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Nobody is working/);
  });

  it("tells the manager about the drag option and that the cards can be picked up", () => {
    render(<App />);
    expect(screen.getByText(/Drag a name onto a time/)).toBeTruthy();
    expect(card("Leilani P.").getAttribute("draggable")).toBe("true");
  });
});
