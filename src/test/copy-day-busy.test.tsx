import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";

/**
 * Two helpers for a manager who repeats the same pattern all week: "Copy a day" puts one day's shifts
 * onto other days, and "Busy times" says which hours need more people (the grid then shows "Needs 2").
 * Both go through the same rules as everything else, and each is one Undo.
 */

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("shiftfit:welcomed", "1");
});
afterEach(cleanup);

/** A stand-in for the browser's dataTransfer, as in the drag tests. */
function makeDataTransfer() {
  const data: Record<string, string> = {};
  return {
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

/** One box of the grid, found by the start of its spoken description. */
function box(description: RegExp): HTMLElement {
  return screen.getByRole("button", { name: description });
}

/** Gives Leilani P. her 7:00 to 9:00am shift on Monday, by dropping her card and confirming. */
function scheduleLeilaniMonday() {
  const dataTransfer = makeDataTransfer();
  fireEvent.dragStart(screen.getByText("Leilani P.", { selector: "span" }).closest("li")!, { dataTransfer });
  fireEvent.dragOver(box(/^Monday 7:00am to 7:30am/), { dataTransfer });
  fireEvent.drop(box(/^Monday 7:00am to 7:30am/), { dataTransfer });
  fireEvent.click(screen.getByRole("button", { name: "Add shifts" }));
}

describe("Copy a day", () => {
  it("puts Monday's shifts onto the days ticked, in one undo step", async () => {
    const user = userEvent.setup();
    render(<App />);
    scheduleLeilaniMonday();
    expect(box(/^Wednesday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Nobody is working/);

    await user.click(screen.getByRole("button", { name: /copy a day/i }));
    const dialog = screen.getByRole("dialog", { name: "Copy a day" });
    expect((within(dialog).getByRole("button", { name: "Copy" }) as HTMLButtonElement).disabled).toBe(true); // no day ticked yet
    await user.click(within(dialog).getByRole("checkbox", { name: "Wednesday" }));
    await user.click(within(dialog).getByRole("button", { name: "Copy" }));

    expect(box(/^Wednesday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Working: Leilani P\./);
    // Troy also works Wednesday from 8:00am, so his name may come first in the box
    expect(box(/^Wednesday 7:30am to 8:00am/).getAttribute("aria-label")).toMatch(/Working: .*Leilani P\./);
    expect(screen.getByText(/Copied Monday to Wednesday/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^undo/i }));
    expect(box(/^Wednesday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Nobody is working/);
    expect(box(/^Monday 7:00am to 7:30am/).getAttribute("aria-label")).toMatch(/Working: Leilani P\./); // the original stays
  });

  it("says so when every shift would break a rule (Troy only works 3 days a week)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /copy a day/i }));
    const dialog = screen.getByRole("dialog", { name: "Copy a day" });
    await user.click(within(dialog).getByRole("checkbox", { name: "Tuesday" }));
    await user.click(within(dialog).getByRole("button", { name: "Copy" }));
    expect(screen.getByText(/Nothing could be copied to Tuesday/)).toBeTruthy();
    expect(box(/^Tuesday 7:00am to 7:30am/).getAttribute("aria-label")).not.toMatch(/Troy C\. is working here/);
  });
});

describe("Busy times", () => {
  it("lists hours that need more people, shows them on the grid, and can take them away again", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(box(/^Monday 11:00am to 11:30am/).getAttribute("aria-label")).not.toMatch(/needs 2 people/);

    await user.click(screen.getByRole("button", { name: /busy times/i }));
    const dialog = screen.getByRole("dialog", { name: "Busy times" });
    expect(within(dialog).getByText(/None yet/)).toBeTruthy();
    // Monday to Friday, 11:00am to 1:00pm, 2 people are the starting answers
    await user.click(within(dialog).getByRole("button", { name: "Add busy time" }));
    expect(within(dialog).getByText("Mon, Tue, Wed, Thu, Fri")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Remove Monday, Tuesday, Wednesday, Thursday, Friday 11:00am to 1:00pm" })).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(box(/^Monday 11:00am to 11:30am/).getAttribute("aria-label")).toMatch(/This time needs 2 people/);
    expect(box(/^Monday 12:30pm to 1:00pm/).getAttribute("aria-label")).toMatch(/This time needs 2 people/);
    expect(box(/^Monday 1:00pm to 1:30pm/).getAttribute("aria-label")).not.toMatch(/This time needs 2 people/);

    await user.click(screen.getByRole("button", { name: /busy times/i }));
    await user.click(screen.getByRole("button", { name: "Remove Monday, Tuesday, Wednesday, Thursday, Friday 11:00am to 1:00pm" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(box(/^Monday 11:00am to 11:30am/).getAttribute("aria-label")).not.toMatch(/This time needs 2 people/);
    expect(box(/^Tuesday 12:00pm to 12:30pm/).getAttribute("aria-label")).not.toMatch(/This time needs 2 people/); // the whole line (all five days) goes
  });
});
