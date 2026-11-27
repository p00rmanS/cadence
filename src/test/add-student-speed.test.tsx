/**
 * ============================================================================
 *  TESTS: ADDING MANY STUDENTS QUICKLY
 * ============================================================================
 * A manager with 20 or more students found the Add student form slow: the form closed after every student, was
 * long even when only a name and class times were needed, refused text copied from a school page, and hid the
 * "Add several at once" window. These tests protect the fixes:
 *  - text copied from a school page is cleaned when pasted (but typos are still flagged, never dropped);
 *  - "Add and add another" saves the student, keeps the window open and clears it for the next one;
 *  - the rarely changed options sit in a fold-out (open when editing, and forced open if a problem is hidden in it);
 *  - the form links to "Add several at once".
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";

/** Starts the app with nothing saved and the welcome screen out of the way. */
function boot() {
  window.localStorage.clear();
  window.localStorage.setItem("shiftfit:welcomed", "1");
  return { user: userEvent.setup(), ...render(<App />) };
}

/** Opens the Add student form and returns it. */
async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add student" }));
  return screen.getByRole("dialog", { name: /add a student/i });
}

/** How many students the list says it holds ("Students (25)"). */
function studentCount(): number {
  const heading = screen.getAllByText(/^Students$/)[0].parentElement?.textContent ?? "";
  return Number(heading.match(/\((\d+)\)/)?.[1] ?? NaN);
}

const WORKDAY_ROW = "ENGL 101 - College Writing\tENGL 101-03\tLecture\tMWF | 9:00 AM - 9:50 AM | GCB 112\tPat Example";
const COPIED_ROW = "BUS 201 Principles of Accounting  MWF 10:00 AM - 10:50 AM  Room GCB 120";

describe("pasting class times copied from a school page", () => {
  it("cuts a copied row down to the class time and says so", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    const box = within(dialog).getByLabelText(/when does this student have class/i) as HTMLTextAreaElement;
    await user.click(box);
    await user.paste(COPIED_ROW);
    expect(box.value).toBe("MWF 10:00 AM-10:50 AM");
    expect(within(dialog).getByText(/Cleaned up what you pasted: found 1 class time/)).toBeTruthy();
    // The usual "what Syncro understood" list now shows the class, with no red problem.
    expect(within(dialog).getByText(/1 of 1 lines/)).toBeTruthy();
  });

  it("leaves a typo in place so it is still flagged (nothing is dropped silently)", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    const box = within(dialog).getByLabelText(/when does this student have class/i) as HTMLTextAreaElement;
    await user.click(box);
    await user.paste(`${COPIED_ROW}\ngarbled nonsense`);
    expect(box.value).toBe("MWF 10:00 AM-10:50 AM\ngarbled nonsense");
    expect(within(dialog).getByText(/1 of 2 lines/)).toBeTruthy();
  });

  it("pastes ordinary class times exactly as typed, with no cleanup message", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    const box = within(dialog).getByLabelText(/when does this student have class/i) as HTMLTextAreaElement;
    await user.click(box);
    await user.paste("MWF 9:00-9:50\nTTh 1:00pm-2:15pm");
    expect(box.value).toBe("MWF 9:00-9:50\nTTh 1:00pm-2:15pm");
    expect(within(dialog).queryByText(/Cleaned up what you pasted/)).toBeNull();
  });

  it("puts cleaned lines after what is already in the box instead of replacing it", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    const box = within(dialog).getByLabelText(/when does this student have class/i) as HTMLTextAreaElement;
    await user.click(box);
    await user.paste("TTh 1:00pm-2:15pm");
    await user.paste(WORKDAY_ROW.replace("MWF | 9:00 AM - 9:50 AM | GCB 112", "Seminar MWF 9:00 AM - 9:50 AM GCB 112"));
    expect(box.value).toBe("TTh 1:00pm-2:15pm\nMWF 9:00 AM-9:50 AM");
  });
});

describe("Add and add another", () => {
  it("saves the student, keeps the window open, clears it, and is ready for the next name", async () => {
    const { user } = boot();
    const before = studentCount();
    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText(/student's name/i), "Noa K.");
    const box = within(dialog).getByLabelText(/when does this student have class/i);
    await user.click(box);
    await user.paste("MWF 9:00am-9:50am");
    await user.click(within(dialog).getByRole("button", { name: "Add and add another" }));

    expect(screen.getByRole("dialog", { name: /add a student/i })).toBeTruthy();
    expect(studentCount()).toBe(before + 1);
    expect((within(dialog).getByLabelText(/student's name/i) as HTMLInputElement).value).toBe("");
    expect((within(dialog).getByLabelText(/when does this student have class/i) as HTMLTextAreaElement).value).toBe("");
    expect(within(dialog).getByText(/Added Noa K\. · 1 added so far/)).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByLabelText(/student's name/i));
  });

  it("can be repeated, counting as it goes, and Cancel finishes", { timeout: 30000 }, async () => {
    const { user } = boot();
    const before = studentCount();
    const dialog = await openForm(user);
    for (const name of ["Noa K.", "Kai P.", "Mele T."]) {
      await user.type(within(dialog).getByLabelText(/student's name/i), name);
      await user.click(within(dialog).getByLabelText(/when does this student have class/i));
      await user.paste("MWF 9:00am-9:50am");
      await user.click(within(dialog).getByRole("button", { name: "Add and add another" }));
    }
    expect(within(dialog).getByText(/Added Mele T\. · 3 added so far/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(studentCount()).toBe(before + 3);
  });

  it("does not save a student with problems, and keeps what was typed", async () => {
    const { user } = boot();
    const before = studentCount();
    const dialog = await openForm(user);
    await user.click(within(dialog).getByRole("button", { name: "Add and add another" }));
    expect(within(dialog).getByText("Type the student's name.")).toBeTruthy();
    expect(studentCount()).toBe(before);
    await user.type(within(dialog).getByLabelText(/student's name/i), "Noa K.");
    await user.click(within(dialog).getByLabelText(/when does this student have class/i));
    await user.paste("garbled nonsense");
    await user.click(within(dialog).getByRole("button", { name: "Add and add another" }));
    expect(studentCount()).toBe(before);
    expect((within(dialog).getByLabelText(/student's name/i) as HTMLInputElement).value).toBe("Noa K.");
  });

  it("is not offered when editing a student", async () => {
    const { user } = boot();
    await user.click(screen.getAllByRole("button", { name: /^Edit /i })[0] ?? screen.getAllByRole("button", { name: /Ana L\./ })[0]);
    expect(screen.queryByRole("button", { name: "Add and add another" })).toBeNull();
  });
});

describe("the fold-out of less used options", () => {
  /** The "More options" fold-out inside the open dialog. */
  function fold(dialog: HTMLElement): HTMLDetailsElement {
    return within(dialog).getByText(/More options/).closest("details") as HTMLDetailsElement;
  }

  it("starts closed for a new student, and its title shows the usual defaults", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    expect(fold(dialog).open).toBe(false);
    expect(fold(dialog).textContent).toMatch(/12:00pm break, any day, up to 19 hours/);
  });

  it("opens with a click, and the title follows what is chosen", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    await user.click(within(dialog).getByText(/More options/));
    expect(fold(dialog).open).toBe(true);
    await user.type(within(dialog).getByLabelText(/hours they want each week/i), "12");
    expect(fold(dialog).textContent).toMatch(/12 hours/);
  });

  it("opens by itself when a problem is hidden inside it", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText(/student's name/i), "Noa K.");
    await user.click(within(dialog).getByText(/More options/));
    await user.type(within(dialog).getByLabelText(/hours they want each week/i), "99");
    await user.click(within(dialog).getByText(/More options/)); // fold it away
    expect(fold(dialog).open).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Add student" }));
    expect(fold(dialog).open).toBe(true);
    expect(within(dialog).getByText(/Choose between 1 and 40 hours/)).toBeTruthy();
  });
});

describe("a way to add a whole list", () => {
  it("links from the form to the Add several at once window, closing the form first", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    await user.click(within(dialog).getByRole("button", { name: "Add several at once" }));
    expect(screen.queryByRole("dialog", { name: /add a student/i })).toBeNull();
    expect(screen.getByRole("dialog", { name: /add several students at once/i })).toBeTruthy();
  });
});
