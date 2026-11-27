import { useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { HelpTip } from "../help/HelpTip";
import { Avatar } from "../ui/Avatar";
import { makeAvatar } from "../../lib/image";
import { ImportPanel } from "../import/ImportPanel";
import { MeetingReview } from "../import/MeetingReview";
import { BreakEditor } from "./BreakEditor";
import { DEFAULT_BREAK_MINUTES, DEFAULT_BREAK_START, MAX_DAYS_PER_WEEK, NO_CUTOFF } from "../../features/scheduling/constants";
import { clsx } from "../../lib/clsx";
import { buildBusy } from "../../features/scheduling/parser";
import { formatMinutes } from "../../features/scheduling/time";
import { openDays } from "../../features/scheduling/days";
import { studentLimit } from "../../features/scheduling/term";
import { DAY_LONG } from "../../features/scheduling/types";
import type { ExtractionOutcome } from "../../features/import/schedule-extractor";
import type { NewStudentInput } from "../../hooks/useShiftFitStore";
import type { Day, ScheduleSettings, Student, WorkBreak } from "../../features/scheduling/types";

/**
 * The "Add a student" / "Edit student" popup form. Holds its own draft state
 * (every field below is a `useState`) until Save is pressed, at which point
 * `onSave` hands a plain `NewStudentInput` object up to `App.tsx`, which
 * forwards it to the store (`addStudent`/`updateStudent`). Class-time text is
 * re-parsed live on every keystroke (`buildBusy`) so the "here's what we
 * understood" review (`<MeetingReview>`) never goes stale.
 */
type Opt = { value: number | null; label: string };

const LATEST_OPTIONS: Opt[] = [
  { value: NO_CUTOFF, label: "No limit — any time the office is open" },
  { value: 12 * 60, label: "12:00pm" },
  { value: 13 * 60, label: "1:00pm" },
  { value: 14 * 60, label: "2:00pm" },
  { value: 15 * 60, label: "3:00pm" },
  { value: 16 * 60, label: "4:00pm" },
  { value: 17 * 60, label: "5:00pm" },
  { value: 18 * 60, label: "6:00pm" },
  { value: 19 * 60, label: "7:00pm" },
  { value: 20 * 60, label: "8:00pm" },
  { value: 21 * 60, label: "9:00pm" },
  { value: 22 * 60, label: "10:00pm" },
  { value: 23 * 60, label: "11:00pm" },
];

/** The "can't start before" choices (0 means no limit, which is stored as "missing"). */
const EARLIEST_OPTIONS: Opt[] = [
  { value: 0, label: "No limit — from when the office opens" },
  ...[8, 9, 10, 11, 12, 13, 14].map((hour) => ({ value: hour * 60, label: formatMinutes(hour * 60) })),
];

/** A plain-language problem with a typed weekly-hours number (blank is fine: it means the office limit), or null. */
function weeklyHoursProblem(text: string): string | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  if (Number.isNaN(value)) return "Type a number of hours, like 12, or leave it empty.";
  if (value < 1 || value > 40) return "Choose between 1 and 40 hours.";
  if (Math.round(value * 2) / 2 !== value) return "Use whole or half hours, like 12 or 12.5.";
  return null;
}

const inputCls = "mt-1 w-full rounded-lg border border-line bg-bg p-2 text-sm";

/** If a saved value isn't one of the standard choices, keep it selectable instead of silently changing it. */
function withCurrent(options: Opt[], current: number | null, label: (v: number) => string): Opt[] {
  if (current === null || options.some((o) => o.value === current)) return options;
  return [...options, { value: current, label: label(current) }].sort((a, b) => (a.value ?? -1) - (b.value ?? -1));
}

/** The add/edit student form: name, photo, class times, blocked times and work preferences. */
export function StudentFormSheet({
  student,
  prefill = null,
  title,
  saveLabel,
  hidePhoto = false,
  settings,
  existingNames,
  onSave,
  onSaveAnother,
  onAddSeveral,
  onClose,
}: {
  student: Student | null;
  /** Starting values for a NEW student (a student's own link being reviewed): it is still added as new, not edited. */
  prefill?: Student | null;
  /** Replaces the usual "Add a student" / "Edit ..." heading (the student's own page says "Your details"). */
  title?: string;
  /** Replaces the usual "Add student" / "Save changes" button words. */
  saveLabel?: string;
  /** Leaves out the photo choice (a student's link carries no photo). */
  hidePhoto?: boolean;
  /** The office rules, for the days the office is open and the office weekly limit shown next to the hours box. */
  settings: ScheduleSettings;
  existingNames: string[];
  onSave: (input: NewStudentInput) => void;
  /**
   * When given (only for a brand-new student), an "Add and add another" button appears: it saves this student,
   * keeps the window open, and clears the form for the next one. Adding twenty students no longer means
   * opening the form twenty times.
   */
  onSaveAnother?: (input: NewStudentInput) => void;
  /** When given (only for a brand-new student), a link offers the "Add several at once" window instead. */
  onAddSeveral?: () => void;
  onClose: () => void;
}) {
  // Where the form's starting values come from: the student being edited, or the prefill for a new one.
  const start = student ?? prefill;
  const [name, setName] = useState(start?.name ?? "");
  const [preference, setPreference] = useState<NewStudentInput["preference"]>(start?.preference ?? "any");
  const [daysPerWeek, setDaysPerWeek] = useState(start?.daysPerWeek ?? 5);
  const [latestEnd, setLatestEnd] = useState(start?.latestEnd ?? NO_CUTOFF);
  // A new student starts with the usual 30-minute lunch at noon; the manager can change or remove it.
  const [breaks, setBreaks] = useState<WorkBreak[]>(start ? start.breaks : [{ start: DEFAULT_BREAK_START, minutes: DEFAULT_BREAK_MINUTES }]);
  const [needsOpeningShift, setNeedsOpeningShift] = useState(start?.needsOpeningShift ?? false);
  const [workDays, setWorkDays] = useState<Day[]>(start?.workDays ?? []);
  const [weeklyHoursText, setWeeklyHoursText] = useState(start?.weeklyHours === undefined ? "" : String(start.weeklyHours));
  const [earliestStart, setEarliestStart] = useState(start?.earliestStart ?? 0);
  const [classText, setClassText] = useState(start?.classText ?? "");
  const [blockedText, setBlockedText] = useState(start?.blockedText ?? "");
  const [avatar, setAvatar] = useState<string | null>(start?.avatar ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [triedSave, setTriedSave] = useState(false);
  // The less-used choices (other blocked times, work preferences, breaks, opening shift) sit in a fold-out so a
  // new student needs only a name and class times. It starts open when editing, because then the person came to change one.
  const [moreOpen, setMoreOpen] = useState(Boolean(student ?? prefill));
  // Names added so far through "Add and add another", shown as a confirmation above the form.
  const [addedNames, setAddedNames] = useState<string[]>([]);
  // Goes up each time the form is cleared for the next student, so the class-times box starts completely fresh too.
  const [clearCount, setClearCount] = useState(0);

  // Times are checked live as you type, so there is never a stale "review" list.
  const { classes: parse, blocked: blockedParse } = useMemo(() => buildBusy(classText, blockedText), [classText, blockedText]);

  const trimmed = name.trim();
  const nameError = !trimmed ? "Type the student's name." : null;
  const duplicate = trimmed && existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase() && n !== student?.name);
  const classError =
    parse.errors.length || blockedParse.errors.length ? "Fix or delete the lines marked with a red ✕ before saving." : null;

  // Fills the form with what the screenshot reader found. Nothing is saved until the manager presses Save.
  function handleExtracted(outcome: ExtractionOutcome) {
    const ai = outcome.ai;
    if (!ai) return;
    setClassText(ai.meetings.map((m) => `${DAY_LONG[m.day as keyof typeof DAY_LONG]} ${formatMinutes(m.start)}-${formatMinutes(m.end)}`).join("\n"));
    if (ai.constraints.latestEnd != null) setLatestEnd(ai.constraints.latestEnd);
    if (ai.constraints.breaks.length) setBreaks(ai.constraints.breaks);
    setNeedsOpeningShift(ai.constraints.needsOpeningShift);
    setPreference(ai.constraints.preference);
    if (ai.constraints.daysPerWeek) setDaysPerWeek(ai.constraints.daysPerWeek);
    const notes = [...ai.warnings, ...ai.unresolved];
    setAiNote(
      `Read from the screenshot${ai.status === "needs_review" ? " (please double-check)" : ""}.${notes.length ? ` Things it wasn't sure about: ${notes.join(" ")}` : ""}`,
    );
  }

  // Only the most recently chosen photo may update the form. Shrinking takes a moment, so without
  // this a slow first photo could finish last and silently replace the one picked after it.
  const photoRequest = useRef(0);
  // Shrinks a chosen photo to a thumbnail. If a newer photo is picked meanwhile, the older result is ignored.
  async function handlePhoto(file: File) {
    const mine = ++photoRequest.current;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const url = await makeAvatar(file);
      if (mine === photoRequest.current) setAvatar(url);
    } catch (err) {
      if (mine === photoRequest.current) setPhotoError(err instanceof Error ? err.message : "That photo could not be used.");
    } finally {
      if (mine === photoRequest.current) setPhotoBusy(false);
    }
  }

  // Everything typed so far, in the shape the app saves.
  function currentInput(): NewStudentInput {
    return {
      name: trimmed,
      avatar,
      preference,
      daysPerWeek,
      classText,
      blockedText,
      latestEnd,
      breaks,
      needsOpeningShift,
      workDays,
      weeklyHours: weeklyHoursText.trim() === "" ? undefined : Number(weeklyHoursText),
      earliestStart,
    };
  }

  // True when the form is fine to save. Shows any problems first (and opens the fold-out if a problem is hidden in it).
  function readyToSave(): boolean {
    setTriedSave(true);
    if (nameError || classError) return false;
    if (weeklyHoursProblem(weeklyHoursText)) {
      setMoreOpen(true);
      return false;
    }
    return true;
  }

  // Save button: only saves when the name and class times are fine.
  function handleSubmit() {
    if (readyToSave()) onSave(currentInput());
  }

  // "Add and add another": saves this student, then empties every field so the next one starts from the usual defaults.
  function handleSubmitAnother() {
    if (!onSaveAnother || !readyToSave()) return;
    onSaveAnother(currentInput());
    setAddedNames((names) => [...names, trimmed]);
    setName("");
    setPreference("any");
    setDaysPerWeek(5);
    setLatestEnd(NO_CUTOFF);
    setBreaks([{ start: DEFAULT_BREAK_START, minutes: DEFAULT_BREAK_MINUTES }]);
    setNeedsOpeningShift(false);
    setWorkDays([]);
    setWeeklyHoursText("");
    setEarliestStart(0);
    setClassText("");
    setBlockedText("");
    setAvatar(null);
    setPhotoError(null);
    setAiNote(null);
    setTriedSave(false);
    setClearCount((count) => count + 1);
    // Ready to type the next name straight away.
    window.setTimeout(() => document.getElementById("student-name")?.focus(), 0);
  }

  const latestOptions = withCurrent(LATEST_OPTIONS, latestEnd, (v) => formatMinutes(v));
  const earliestOptions = withCurrent(EARLIEST_OPTIONS, earliestStart, (v) => formatMinutes(v));
  const officeDays = openDays(settings);
  const officeLimit = studentLimit({}, settings);
  const hoursError = weeklyHoursProblem(weeklyHoursText);
  const toggleDay = (day: Day) => setWorkDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));

  return (
    <Modal
      title={title ?? (student ? `Edit ${student.name}` : "Add a student")}
      description="Tell Syncro when they have class and any limits. You can change this later."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {onSaveAnother && !student && !prefill && (
            <Button variant="secondary" onClick={handleSubmitAnother}>
              Add and add another
            </Button>
          )}
          <Button variant="primary" onClick={handleSubmit}>
            {saveLabel ?? (student ? "Save changes" : "Add student")}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {addedNames.length > 0 && (
          <p role="status" className="rounded-lg bg-ok-bg p-2 text-sm">
            Added {addedNames[addedNames.length - 1]} · {addedNames.length} added so far. Type the next student below, or press Cancel when you are done.
          </p>
        )}
        {onAddSeveral && !student && !prefill && (
          <p className="text-sm text-muted">
            Adding a whole list?{" "}
            <button type="button" onClick={onAddSeveral} className="font-medium text-accent underline">
              Add several at once
            </button>
          </p>
        )}
        <div>
          <label htmlFor="student-name" className="block text-sm font-medium">
            Student&apos;s name
          </label>
          <input
            id="student-name"
            data-autofocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="e.g. Noa K."
            aria-invalid={triedSave && Boolean(nameError)}
            aria-describedby="student-name-msg"
            className={inputCls}
          />
          <p id="student-name-msg" className="mt-1 text-xs" role={triedSave && nameError ? "alert" : undefined}>
            {triedSave && nameError ? (
              <span className="text-gap">{nameError}</span>
            ) : duplicate ? (
              <span className="text-warn">Someone else already has this name. Their initials in the schedule may look the same.</span>
            ) : (
              <span className="text-muted">A first name and last initial is enough.</span>
            )}
          </p>
        </div>

        {!hidePhoto && (
          <div className="flex items-center gap-3">
            <Avatar name={trimmed || "?"} color={student?.color ?? "#1F6FB2"} avatar={avatar ?? undefined} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Photo <span className="font-normal text-muted">(optional)</span>
              </p>
              <input
                ref={photoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                aria-label="Choose a photo file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handlePhoto(file);
                  e.target.value = "";
                }}
              />
              <div className="mt-1 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => photoInput.current?.click()} disabled={photoBusy}>
                  {photoBusy ? "Working…" : avatar ? "Change photo" : "Choose a photo"}
                </Button>
                {avatar && (
                  <Button variant="ghost" onClick={() => setAvatar(null)} disabled={photoBusy}>
                    Remove photo
                  </Button>
                )}
              </div>
              <p className={photoError ? "mt-1 text-xs text-gap" : "mt-1 text-xs text-muted"} role={photoError ? "alert" : undefined}>
                {photoError ?? "PNG, JPG or WebP, up to 5 MB. It is shrunk and kept in this browser only."}
              </p>
            </div>
          </div>
        )}

        <ImportPanel key={clearCount} classText={classText} onClassTextChange={setClassText} onExtracted={handleExtracted} />
        {aiNote && <p className="rounded-lg bg-warn-bg p-2 text-xs text-ink">{aiNote}</p>}
        <MeetingReview parse={parse} />

        {triedSave && classError && (
          <p role="alert" className="text-sm text-gap">
            {classError}
          </p>
        )}
        <details
          open={moreOpen}
          onToggle={(e) => setMoreOpen(e.currentTarget.open)}
          className="rounded-xl border border-line p-3"
        >
          <summary className="cursor-pointer text-sm font-semibold">
            More options
            <span className="font-normal text-muted">
              {" "}
              · usual defaults: {breaks.length === 0 ? "no break" : breaks.length === 1 ? `${formatMinutes(breaks[0].start)} break` : `${breaks.length} breaks`},{" "}
              {workDays.length ? `${workDays.length} chosen ${workDays.length === 1 ? "day" : "days"}` : "any day"},{" "}
              {weeklyHoursText.trim() ? `${weeklyHoursText.trim()} hours` : `up to ${officeLimit} hours`}
            </span>
          </summary>
          <div className="mt-4 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <label htmlFor="blocked-text" className="text-sm font-medium">
                  Any other times they can&apos;t work? <span className="font-normal text-muted">(optional)</span>
                </label>
                <HelpTip label="Other times they can't work">
                  Use this for another job, appointments, practice or anything else that is not a class. Write it the same way as
                  class times, like <b>W 2:00pm-4:00pm</b>. Syncro keeps them out of these times too.
                </HelpTip>
              </div>
              <textarea
                id="blocked-text"
                value={blockedText}
                onChange={(e) => setBlockedText(e.target.value)}
                placeholder={"W 2:00pm-4:00pm\nF 12:00-1:00"}
                rows={2}
                maxLength={5000}
                className="w-full rounded-lg border border-line bg-bg p-2 font-mono text-sm"
              />
              <MeetingReview parse={blockedParse} title="Times they can't work" />
            </div>


            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-semibold">Work preferences</legend>
              <div>
                <label htmlFor="pref" className="block text-sm font-medium">
                  When do they like to work?
                </label>
                <select id="pref" value={preference} onChange={(e) => setPreference(e.target.value as NewStudentInput["preference"])} className={inputCls}>
                  <option value="any">No preference</option>
                  <option value="morning">Mornings</option>
                  <option value="afternoon">Afternoons</option>
                </select>
              </div>
              <div>
                <label htmlFor="days" className="block text-sm font-medium">
                  Days they can work each week
                </label>
                <select id="days" value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))} className={inputCls}>
                  {Array.from({ length: MAX_DAYS_PER_WEEK }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d} {d === 1 ? "day" : "days"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <label htmlFor="latest" className="text-sm font-medium">
                    They must leave by
                  </label>
                  <HelpTip label="Must leave by">
                    The latest time they can work. Syncro won&apos;t schedule them past it (for example, if they have an evening job or a bus to catch).
                  </HelpTip>
                </div>
                <select id="latest" value={latestEnd} onChange={(e) => setLatestEnd(Number(e.target.value))} className={inputCls}>
                  {latestOptions.map((o) => (
                    <option key={o.value} value={o.value ?? ""}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <label htmlFor="earliest" className="text-sm font-medium">
                    They can&apos;t start before
                  </label>
                  <HelpTip label="Can't start before">
                    The earliest time they can begin work (for example, they have an early class or a long commute). Syncro won&apos;t schedule them earlier.
                  </HelpTip>
                </div>
                <select id="earliest" value={earliestStart} onChange={(e) => setEarliestStart(Number(e.target.value))} className={inputCls}>
                  {earliestOptions.map((o) => (
                    <option key={o.value} value={o.value ?? ""}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <label htmlFor="weekly-hours" className="text-sm font-medium">
                    Hours they want each week
                  </label>
                  <HelpTip label="Hours per week">
                    How many hours this student wants to work in a week. Leave it empty to use the office limit ({officeLimit} hours right now). A number
                    higher than the office limit is held to the office limit.
                  </HelpTip>
                </div>
                <input
                  id="weekly-hours"
                  inputMode="decimal"
                  value={weeklyHoursText}
                  onChange={(e) => setWeeklyHoursText(e.target.value)}
                  placeholder={`Office limit: ${officeLimit}`}
                  aria-describedby="weekly-hours-err"
                  aria-invalid={Boolean(hoursError)}
                  className={inputCls}
                />
                {hoursError && (
                  <p id="weekly-hours-err" role="alert" className="mt-1 text-xs text-gap">
                    {hoursError}
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center gap-1">
                  <span id="work-days-label" className="text-sm font-medium">
                    Days they want to work
                  </span>
                  <HelpTip label="Days they want to work">
                    Pick the days this student would like to work. Leave every day unpicked if any day is fine. Days that are not picked are treated like
                    days they can&apos;t work, so Syncro won&apos;t put them there.
                  </HelpTip>
                </div>
                <div role="group" aria-labelledby="work-days-label" className="mt-1 flex flex-wrap gap-2">
                  {officeDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={workDays.includes(day)}
                      onClick={() => toggleDay(day)}
                      className={clsx(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                        workDays.includes(day) ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel text-ink hover:bg-line/30",
                      )}
                    >
                      {DAY_LONG[day]}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">{workDays.length === 0 ? "Any day is fine." : "Only the picked days."}</p>
              </div>
            </fieldset>

            <BreakEditor breaks={breaks} onChange={setBreaks} />

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={needsOpeningShift} onChange={(e) => setNeedsOpeningShift(e.target.checked)} />
              <span>
                <span className="font-medium">Needs an opening shift</span>
                <span className="block text-xs text-muted">One day a week they must start at 7:00am and work at least an hour in a row.</span>
              </span>
            </label>
          </div>
        </details>
      </form>
    </Modal>
  );
}
