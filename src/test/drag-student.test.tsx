import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";

/**
 * Dragging a student card from the list onto a time in the schedule gives that student a shift there.
 * jsdom has no real drag and drop, so these tests send the same events a browser would, with a small
 * stand-in for the "dataTransfer" object that carries what is being dragged.
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

describe("dragging a student onto the schedule", () => {
  it("gives the student a two-hour shift starting at the box they are dropped on", () => {
    render(<App />);
    const dataTransfer = makeDataTransfer();
    expect(box(/^Monday 7:00am to 7:30am. Nobody is working/)).toBeTruthy();

    fireEvent.dragStart(card("Leilani P."), { dataTransfer });
    fireEvent.dragOver(box(/^Monday 7:00am to 7:30am/), { dataTransfer });
    fireEvent.drop(box(/^Monday 7:00am to 7:30am/), { dataTransfer });

    for (const start of ["7:00am to 7:30am", "7:30am to 8:00am", "8:00am to 8:30am", "8:30am to 9:00am"]) {
      expect(box(new RegExp(`^Monday ${start}`)).getAttribute("aria-label")).toMatch(/Leilani P\. is working here/);
    }
    // exactly the minimum shift: the next half hour is still empty
    expect(box(/^Monday 9:00am to 9:30am/).getAttribute("aria-label")).not.toMatch(/Leilani P\. is working here/);
  });

  it("outlines and explains what will happen while the card is held over a box, and clears it after", () => {
    render(<App />);
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(card("Leilani P."), { dataTransfer });
    fireEvent.dragOver(box(/^Monday 7:00am to 7:30am/), { dataTransfer });
    expect(screen.getByText(/Let go to give them 7:00am to 9:00am/)).toBeTruthy();
    expect(box(/^Monday 8:30am to 9:00am/).className).toMatch(/outline-accent/);
    expect(box(/^Monday 9:00am to 9:30am/).className).not.toMatch(/outline-accent/);

    fireEvent.drop(box(/^Monday 7:00am to 7:30am/), { dataTransfer });
    expect(screen.queryByText(/Let go to give them/)).toBeNull();
  });

  it("ignores anything that is not a student card (a dragged file or text does nothing)", () => {
    render(<App />);
    const notAStudent = { ...makeDataTransfer(), types: ["Files"], getData: () => "" };
    const allowed = fireEvent.dragOver(box(/^Monday 7:00am to 7:30am/), { dataTransfer: notAStudent });
    expect(allowed).toBe(true); // true means nobody called preventDefault, so the browser will not accept the drop
    fireEvent.drop(box(/^Monday 7:00am to 7:30am/), { dataTransfer: notAStudent });
    expect(box(/^Monday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Nobody is working/);
  });

  it("can be undone like any other change", () => {
    render(<App />);
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(card("Leilani P."), { dataTransfer });
    fireEvent.drop(box(/^Monday 7:00am to 7:30am/), { dataTransfer });
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
