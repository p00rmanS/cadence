import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";

/**
 * Tests for the work-preference fields in the add/edit student form: days they want to work, hours each
 * week, and the earliest start. They check that what is picked is saved on the student, shown back when the
 * student is edited, and checked (a silly number of hours stops the save with a clear message).
 */

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

describe("work preferences in the student form", () => {
  it("offers the days the office is open (Monday to Saturday by default), none picked, and an empty hours box", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    const days = within(dialog).getByRole("group", { name: "Days they want to work" });
    expect(within(days).getAllByRole("button").map((b) => b.textContent)).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    expect(within(days).getAllByRole("button").every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect((within(dialog).getByLabelText(/hours they want each week/i) as HTMLInputElement).placeholder).toMatch(/Office limit: 19/);
  });

  it("saves the picked days, hours and earliest start, and shows them again when the student is edited", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText(/student's name/i), "Noa K.");
    const days = within(dialog).getByRole("group", { name: "Days they want to work" });
    await user.click(within(days).getByRole("button", { name: "Tuesday" }));
    await user.click(within(days).getByRole("button", { name: "Thursday" }));
    expect(within(dialog).getByText("Only the picked days.")).toBeTruthy();
    await user.type(within(dialog).getByLabelText(/hours they want each week/i), "8");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /they can't start before/i }), "600");
    await user.click(within(dialog).getByRole("button", { name: "Add student" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // the student's card shows their own hours, and auto-fill uses only their days
    expect(screen.getAllByText(/of 8 hours/).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: /fill schedule for me/i })[0]);
    await user.click(screen.getByRole("tab", { name: "By student" }));
    const list = screen.getByRole("tabpanel");
    // The list holds the whole sample roster; Noa was added last, so her section is everything from her name on.
    const whole = list.textContent ?? "";
    const noa = whole.slice(whole.indexOf("Noa K."));
    expect(noa).toMatch(/Tue\d/);
    expect(noa).toMatch(/Thu\d/);
    expect(noa).not.toMatch(/Mon\d|Wed\d|Fri\d|Sat\d/);
    const hours = [...noa.matchAll(/\(([\d.]+) hours?\)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    expect(hours).toBe(8);
    const starts = [...noa.matchAll(/(?:Tue|Thu)(\d{1,2}):(\d{2})(am|pm)/g)].map((m) => ((Number(m[1]) % 12) + (m[3] === "pm" ? 12 : 0)) * 60 + Number(m[2]));
    expect(starts.length).toBeGreaterThan(0);
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(10 * 60); // "can't start before 10:00am" is respected

    // editing shows the choices back
    await user.click(screen.getByRole("button", { name: /edit noa k/i }));
    const edit = screen.getByRole("dialog", { name: /edit noa k/i });
    const editDays = within(edit).getByRole("group", { name: "Days they want to work" });
    expect(within(editDays).getByRole("button", { name: "Tuesday" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(editDays).getByRole("button", { name: "Monday" }).getAttribute("aria-pressed")).toBe("false");
    expect((within(edit).getByLabelText(/hours they want each week/i) as HTMLInputElement).value).toBe("8");
    expect((within(edit).getByRole("combobox", { name: /they can't start before/i }) as HTMLSelectElement).value).toBe("600");
  });

  it("stops the save and explains when the hours are not a sensible number", async () => {
    const { user } = boot();
    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText(/student's name/i), "Noa K.");
    const hours = within(dialog).getByLabelText(/hours they want each week/i);
    for (const [typed, message] of [["abc", /Type a number of hours/], ["99", /between 1 and 40/], ["12.3", /whole or half hours/]] as const) {
      await user.clear(hours);
      await user.type(hours, typed);
      expect(within(dialog).getByRole("alert").textContent).toMatch(message);
      await user.click(within(dialog).getByRole("button", { name: "Add student" }));
      expect(screen.getByRole("dialog", { name: /add a student/i })).toBeTruthy(); // still open: nothing was saved
    }
    await user.clear(hours);
    await user.click(within(dialog).getByRole("button", { name: "Add student" }));
    expect(screen.queryByRole("dialog")).toBeNull(); // an empty box is fine: it means the office limit
  });
});
