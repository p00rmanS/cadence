import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { Root } from "../app/Root";
import { ImportStudentDialog } from "../components/share/ImportStudentDialog";
import { ShiftViewPage } from "../components/share/ShiftViewPage";
import { StudentIntakePage } from "../components/share/StudentIntakePage";
import { buildIntakeCode, buildShiftsCode, codeFromText, parseIntakeCode, parseShiftsCode, studentLink } from "../features/sharing/links";
import type { NewStudentInput } from "../hooks/useShiftFitStore";
import { makeSettings, makeStudent, run } from "./testkit";

/**
 * Tests for the screens built on student links and shift links: the manager's "Student links" window, the
 * student's "Send your details" page, the student's "Your shifts" page, and the routing that decides which
 * of them an address opens. They also check the safety promise of the student pages: opening one never shows
 * or touches the manager's schedule.
 */

const input: NewStudentInput = {
  name: "Noa K.",
  preference: "any",
  daysPerWeek: 4,
  classText: "MWF 9:00-9:50\nTTh 1:00pm-2:15pm",
  blockedText: "",
  latestEnd: 24 * 60,
  breaks: [],
  needsOpeningShift: false,
  workDays: ["tue", "thu"],
  weeklyHours: 12,
};
const settings = makeSettings();
const semester = { startDate: "2026-08-24", endDate: "2026-12-11", timeZone: "Pacific/Honolulu", skipDates: [] };

/** A pretend clipboard that remembers what was copied. */
function fakeClipboard() {
  const copied: string[] = [];
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => void copied.push(text) } });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  return copied;
}

async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("shiftfit:welcomed", "1");
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("the manager's Student links window", () => {
  function open(extra: Partial<Parameters<typeof ImportStudentDialog>[0]> = {}) {
    const onReview = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup(); // first: setting it up replaces navigator.clipboard, which tests may then fake
    render(<ImportStudentDialog existingNames={["Lea P."]} onReview={onReview} onClose={onClose} {...extra} />);
    return { user, onReview, onClose };
  }

  it("offers the link to give students, and cannot add anyone until a good link is pasted", () => {
    open();
    const field = screen.getByLabelText("Link for students") as HTMLInputElement;
    expect(field.value).toMatch(/#\/send$/);
    expect((screen.getByRole("button", { name: "Review and add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows what a student sent and hands it over for review, adding nothing by itself", async () => {
    const { user, onReview } = open();
    await user.click(screen.getByLabelText("Paste the link here"));
    await user.paste(studentLink(buildIntakeCode(input)));
    expect(screen.getByText("Noa K. sent their details")).toBeTruthy();
    expect(screen.getByText("5 class times read")).toBeTruthy();
    expect(screen.getByText("Wants to work: Tuesday, Thursday")).toBeTruthy();
    expect(screen.getByText("Wants 12 hours a week")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Review and add" }));
    expect(onReview).toHaveBeenCalledOnce();
    expect(onReview.mock.calls[0][0]).toMatchObject({ name: "Noa K.", weeklyHours: 12, workDays: ["tue", "thu"] });
  });

  it("says so plainly when the pasted link is broken, or is not a link at all", async () => {
    const { user } = open();
    const box = screen.getByLabelText("Paste the link here");
    await user.click(box);
    await user.paste("https://x.example/#/add/not-a-real-code");
    expect(screen.getByRole("alert").textContent).toMatch(/doesn't look right/);
    expect((screen.getByRole("button", { name: "Review and add" }) as HTMLButtonElement).disabled).toBe(true);
    await user.clear(box);
    await user.paste("just some words");
    expect(screen.getByRole("alert").textContent).toMatch(/no student link/i);
  });

  it("warns, without blocking, when a student with that name is already there", async () => {
    const { user } = open({ existingNames: ["noa k."] });
    await user.click(screen.getByLabelText("Paste the link here"));
    await user.paste(buildIntakeCode(input));
    expect(screen.getByText(/already have a student with this name/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Review and add" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("starts filled in when the manager opened a student's link directly", () => {
    open({ initialText: buildIntakeCode(input) });
    expect(screen.getByText("Noa K. sent their details")).toBeTruthy();
  });

  it("copies the link for students", async () => {
    const { user } = open();
    const copied = fakeClipboard();
    await user.click(screen.getByRole("button", { name: /copy link/i }));
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatch(/#\/send$/);
    expect(screen.getByRole("button", { name: /copied/i })).toBeTruthy();
  });

  it("says so, instead of pretending, when the browser refuses to copy", async () => {
    const { user } = open();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => Promise.reject(new Error("no")) } });
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(document, "execCommand", { configurable: true, value: () => false });
    await user.click(screen.getByRole("button", { name: /copy link/i }));
    expect(await screen.findByText(/wouldn't copy it/)).toBeTruthy();
  });

  it("has no accessibility problems", async () => {
    open({ initialText: buildIntakeCode(input) });
    expect(await violations()).toEqual([]);
  });
});

describe("the student's Send your details page", () => {
  async function fillIn(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Fill in my details" }));
    const dialog = screen.getByRole("dialog", { name: "Your details" });
    await user.type(within(dialog).getByLabelText(/student's name/i), "Noa K.");
    await user.click(within(dialog).getByLabelText(/when does this student have class/i));
    await user.paste("MWF 9:00-9:50");
    await user.click(within(within(dialog).getByRole("group", { name: "Days they want to work" })).getByRole("button", { name: "Tuesday" }));
    return dialog;
  }

  it("explains itself, asks for no photo, and never shows the manager's app", async () => {
    render(<StudentIntakePage />);
    expect(screen.getByRole("heading", { name: "Send your details to your manager" })).toBeTruthy();
    expect(screen.getByText(/Nothing is uploaded or saved on a server/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Fill in my details" }));
    const dialog = screen.getByRole("dialog", { name: "Your details" });
    expect(within(dialog).queryByText(/Photo/)).toBeNull();
    expect(screen.queryByRole("button", { name: /fill schedule for me/i })).toBeNull();
  });

  it("makes a link that opens, checked, to exactly what the student typed", async () => {
    const user = userEvent.setup();
    const copied = fakeClipboard();
    render(<StudentIntakePage />);
    const dialog = await fillIn(user);
    await user.click(within(dialog).getByRole("button", { name: "Make my link" }));

    expect(screen.getByRole("heading", { name: /your link is ready, noa k\./i })).toBeTruthy();
    const link = (screen.getByLabelText("Send this link to your manager") as HTMLInputElement).value;
    const opened = parseIntakeCode(codeFromText(link));
    expect(opened.ok && opened.input).toMatchObject({ name: "Noa K.", workDays: ["tue"] });
    expect(opened.ok && opened.student.busy.length).toBe(3);

    expect(screen.getByRole("link", { name: /email it/i }).getAttribute("href")).toContain("mailto:?subject=");
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(copied).toEqual([link]);
  });

  it("lets the student change their details, with everything still filled in", async () => {
    const user = userEvent.setup();
    render(<StudentIntakePage />);
    const first = await fillIn(user);
    await user.click(within(first).getByRole("button", { name: "Make my link" }));
    await user.click(screen.getByRole("button", { name: /change my details/i }));
    const again = screen.getByRole("dialog", { name: "Your details" });
    expect((within(again).getByLabelText(/student's name/i) as HTMLInputElement).value).toBe("Noa K.");
    expect(within(within(again).getByRole("group", { name: "Days they want to work" })).getByRole("button", { name: "Tuesday" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("still asks for a name, kindly", async () => {
    const user = userEvent.setup();
    render(<StudentIntakePage />);
    await user.click(screen.getByRole("button", { name: "Fill in my details" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Make my link" }));
    expect(within(screen.getByRole("dialog")).getAllByRole("alert").some((a) => /name/i.test(a.textContent ?? ""))).toBe(true);
  });

  it("has no accessibility problems", async () => {
    render(<StudentIntakePage />);
    expect(await violations()).toEqual([]);
  });
});

describe("the student's Your shifts page", () => {
  const student = makeStudent({ id: "s1", name: "Noa K." });
  const assignments = [...run("s1", "tue", 20 * 60, 24 * 60), ...run("s1", "thu", 15 * 60, 19 * 60)];

  it("shows only that student's week, day by day, with the hours", () => {
    render(<ShiftViewPage code={buildShiftsCode(student, assignments, settings, semester)} />);
    expect(screen.getByRole("heading", { name: "Noa K.'s shifts" })).toBeTruthy();
    expect(screen.getByText(/Semester schedule · 2026-08-24 to 2026-12-11/)).toBeTruthy();
    expect(screen.getByText("8 hours")).toBeTruthy();
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual(["Tuesday8:00pm–12:00am", "Thursday3:00pm–7:00pm"]);
  });

  it("gives a calendar file that handles a shift ending at midnight, and prints", async () => {
    const downloads: { name: string; text: string }[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      void (blob as Blob).text().then((text) => downloads.push({ name: "x", text }));
      return "blob:test";
    });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ShiftViewPage code={buildShiftsCode(student, assignments, settings, semester)} />);
    await user.click(screen.getByRole("button", { name: /add to my calendar/i }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].text).toContain("BEGIN:VCALENDAR");
    expect(downloads[0].text).toContain("DTSTART;TZID=Pacific/Honolulu:20260825T200000");
    expect(downloads[0].text).toContain("DTEND;TZID=Pacific/Honolulu:20260826T000000"); // midnight rolled to the next day, never hour 24
    await user.click(screen.getByRole("button", { name: /print/i }));
    expect(print).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("explains why there is no calendar file yet when the manager hasn't saved the semester dates", () => {
    render(<ShiftViewPage code={buildShiftsCode(student, assignments, settings, null)} />);
    expect((screen.getByRole("button", { name: /add to my calendar/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/hasn't saved the semester dates/)).toBeTruthy();
  });

  it("says kindly when the student has no shifts yet", () => {
    render(<ShiftViewPage code={buildShiftsCode(student, [], settings, semester)} />);
    expect(screen.getByText(/don't have any shifts yet/)).toBeTruthy();
  });

  it("says kindly, and shows nothing else, when the link is broken", () => {
    render(<ShiftViewPage code="garbage" />);
    expect(screen.getByRole("alert").textContent).toMatch(/couldn't open this link/);
    expect(screen.getByRole("alert").textContent).toMatch(/Ask your manager/);
    expect(screen.queryByRole("button", { name: /calendar/i })).toBeNull();
  });

  it("has no accessibility problems", async () => {
    render(<ShiftViewPage code={buildShiftsCode(student, assignments, settings, semester)} />);
    expect(await violations()).toEqual([]);
  });
});

describe("which screen an address opens", () => {
  it("opens the manager's app by default", () => {
    render(<Root />);
    expect(screen.getAllByRole("button", { name: /fill schedule for me/i }).length).toBeGreaterThan(0);
  });

  it("opens the student's page for #/send, with none of the manager's app or saved schedule", () => {
    window.localStorage.setItem("shiftfit:v1", JSON.stringify({ secret: "manager data" }));
    window.history.replaceState(null, "", "/#/send");
    render(<Root />);
    expect(screen.getByRole("heading", { name: "Send your details to your manager" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /fill schedule for me/i })).toBeNull();
    expect(screen.queryByText("Troy C.")).toBeNull();
  });

  it("opens the student's shifts for #/shifts/<link>", () => {
    window.history.replaceState(null, "", `/#/shifts/${buildShiftsCode(makeStudent({ id: "s1", name: "Noa K." }), run("s1", "mon", 9 * 60, 12 * 60), settings, semester)}`);
    render(<Root />);
    expect(screen.getByRole("heading", { name: "Noa K.'s shifts" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /fill schedule for me/i })).toBeNull();
  });

  it("opens the manager's app with the Student links window filled in for #/add/<link>, then clears the address", async () => {
    window.history.replaceState(null, "", `/#/add/${buildIntakeCode(input)}`);
    render(<Root />);
    expect(await screen.findByText("Noa K. sent their details")).toBeTruthy();
    expect(window.location.hash).toBe(""); // the long link is gone from the address bar
  });
});

describe("in the manager's app", () => {
  it("opens the Student links window from the student list, and adds a student the way a manager would review it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Student links" }));
    const window1 = screen.getByRole("dialog", { name: "Student links" });
    await user.click(within(window1).getByLabelText("Paste the link here"));
    await user.paste(buildIntakeCode(input));
    await user.click(within(window1).getByRole("button", { name: "Review and add" }));

    // the normal add-student form opens, already filled in, and the manager still presses Add
    const form = screen.getByRole("dialog", { name: "Add a student" });
    expect((within(form).getByLabelText(/student's name/i) as HTMLInputElement).value).toBe("Noa K.");
    expect((within(form).getByLabelText(/hours they want each week/i) as HTMLInputElement).value).toBe("12");
    expect(screen.queryByText(/of 12 hours/)).toBeNull(); // nothing added yet
    await user.click(within(form).getByRole("button", { name: "Add student" }));
    expect(screen.getAllByText(/of 12 hours/).length).toBeGreaterThan(0);
  });

  it("copies a link for one student from Save & share, and it opens to that student's own shifts only", async () => {
    const user = userEvent.setup();
    const copied = fakeClipboard();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: /fill schedule for me/i })[0]);
    await user.click(screen.getAllByRole("button", { name: /save & share/i })[0]);
    const dialog = screen.getByRole("dialog", { name: "Save & share" });
    await user.click(within(dialog).getByRole("button", { name: /copy a link that shows troy c\. their own shifts/i }));
    expect(copied).toHaveLength(1);
    const shared = parseShiftsCode(codeFromText(copied[0]));
    expect(shared.ok && shared.shared.name).toBe("Troy C.");
    expect(shared.ok && shared.shared.shifts.length).toBeGreaterThan(0);
    expect(copied[0]).not.toContain("Leilani");
  });
});
