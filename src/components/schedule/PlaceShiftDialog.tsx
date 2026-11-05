import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { MIN_SHIFT_MINUTES } from "../../features/scheduling/constants";
import { formatMinutes } from "../../features/scheduling/selectors";
import { DAY_LONG } from "../../features/scheduling/types";
import type { Day } from "../../features/scheduling/types";

/**
 * The pop-up that opens when a manager drops a student's name (or an existing shift) onto the schedule.
 * It lets them say exactly when the student works that day, for example 8:30am to 9:30am and then
 * 1:00pm to 3:00pm, instead of guessing a length. It only collects the answer; the schedule grid
 * hands the result to the store, which still applies every scheduling rule.
 */

/** One row of the pop-up: a start time and an end time, in minutes after midnight (the end is when they stop). */
export type TimeRow = { from: number; to: number };

type Props = {
  studentName: string;
  /** "move" is shown when an existing shift was dragged, so the wording says it is being moved. */
  mode: "add" | "move";
  /** The day dropped on; the manager can change it here. */
  day: Day;
  days: Day[];
  rows: TimeRow[];
  /** Every half-hour the office is open (the first one is opening time). */
  slots: number[];
  slotMinutes: number;
  /** The other students, so a pair (or more) can be put on the same times at once. */
  others: { id: string; name: string; color: string }[];
  /** How many people these times need right now (shown as the starting answer). */
  currentNeed: number;
  /** `needPeople` is only sent when the manager changed the answer. */
  onConfirm: (day: Day, rows: TimeRow[], extra: { alsoStudentIds?: string[]; needPeople?: number }) => void;
  onCancel: () => void;
};

/** With more other students than this, the "also working" list gets a search box. */
const SEARCH_AFTER = 8;

/** The numbers of people a manager can ask for at a time. */
const PEOPLE_CHOICES = [1, 2, 3, 4, 5, 6];

/** How long a new second row lasts when "Add another time" is pressed (the shortest normal shift). */
const NEW_ROW_MINUTES = MIN_SHIFT_MINUTES;
/** The gap left between the end of one row and the start of the next new row (a lunch break). */
const NEW_ROW_GAP_MINUTES = 60;

/** The dialog: a day picker, one or more From/To rows, an "Add another time" button and the confirm button. */
export function PlaceShiftDialog({ studentName, mode, day: startDay, days, rows: startRows, slots, slotMinutes, others, currentNeed, onConfirm, onCancel }: Props) {
  const [day, setDay] = useState<Day>(startDay);
  const [rows, setRows] = useState<TimeRow[]>(startRows);
  const [alsoIds, setAlsoIds] = useState<string[]>([]);
  const [alsoQuery, setAlsoQuery] = useState("");
  const [people, setPeople] = useState(currentNeed);

  const opening = slots[0];
  const closing = slots[slots.length - 1] + slotMinutes;
  const starts = slots;
  const ends = slots.map((slot) => slot + slotMinutes);

  /** Changes one row's start or end time. */
  function change(index: number, part: keyof TimeRow, value: number) {
    setRows(rows.map((row, i) => (i === index ? { ...row, [part]: value } : row)));
  }

  /** Adds a second (or third) time after the last row, for example the afternoon part of the day. */
  function addRow() {
    const last = rows[rows.length - 1];
    const from = Math.min(last.to + NEW_ROW_GAP_MINUTES, closing - slotMinutes);
    setRows([...rows, { from, to: Math.min(from + NEW_ROW_MINUTES, closing) }]);
  }

  const problems = rows.map((row) => (row.to <= row.from ? "The end must be after the start." : ""));
  const shortShift = rows.some((row) => row.to > row.from && row.to - row.from < MIN_SHIFT_MINUTES);
  const canConfirm = problems.every((p) => p === "");
  const selectClass = "rounded-lg border border-line bg-panel px-2 py-2 text-base font-semibold";

  return (
    <Modal
      title={mode === "move" ? `Move ${studentName}'s shift` : `Schedule ${studentName}`}
      description="Say when they work. Add a second time if they work again later in the day."
      onClose={onCancel}
      size="md"
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!canConfirm} onClick={() => onConfirm(day, rows, { alsoStudentIds: alsoIds.length ? alsoIds : undefined, needPeople: people !== currentNeed ? people : undefined })}
          >
            {mode === "move" ? "Move shift" : "Add shifts"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-semibold">Day</span>
          <select value={day} onChange={(e) => setDay(e.target.value as Day)} className={selectClass}>
            {days.map((d) => (
              <option key={d} value={d}>
                {DAY_LONG[d]}
              </option>
            ))}
          </select>
        </label>

        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2 text-base">
              <label className="flex items-center gap-2">
                <span className="font-semibold">{rows.length > 1 ? `Time ${index + 1}: from` : "From"}</span>
                <select
                  value={row.from}
                  onChange={(e) => change(index, "from", Number(e.target.value))}
                  aria-label={`Time ${index + 1} starts`}
                  className={selectClass}
                >
                  {starts.map((m) => (
                    <option key={m} value={m}>
                      {formatMinutes(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="font-semibold">to</span>
                <select
                  value={row.to}
                  onChange={(e) => change(index, "to", Number(e.target.value))}
                  aria-label={`Time ${index + 1} ends`}
                  className={selectClass}
                >
                  {ends.map((m) => (
                    <option key={m} value={m}>
                      {formatMinutes(m)}
                    </option>
                  ))}
                </select>
              </label>
              {rows.length > 1 && (
                <Button variant="ghost" aria-label={`Remove time ${index + 1}`} title="Remove this time" onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              )}
              {problems[index] && (
                <p role="alert" className="w-full text-sm font-semibold text-gap">
                  {problems[index]}
                </p>
              )}
            </li>
          ))}
        </ul>

        {rows.length < 4 && (
          <div>
            <Button onClick={addRow} disabled={rows[rows.length - 1].to >= closing - slotMinutes || rows[rows.length - 1].to < opening}>
              <Plus className="h-4 w-4" aria-hidden /> Add another time
            </Button>
          </div>
        )}

        {mode === "add" && others.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-base font-semibold">
              Also working these times with {studentName}
              {alsoIds.length > 0 && <span className="ml-2 text-sm font-normal text-muted">({alsoIds.length} picked)</span>}
            </legend>
            {/* With 40 or 50 students the list is long, so it can be searched and scrolls inside its own box. */}
            {others.length > SEARCH_AFTER && (
              <input
                type="search"
                value={alsoQuery}
                onChange={(e) => setAlsoQuery(e.target.value)}
                placeholder="Find a student…"
                aria-label="Find a student to add"
                className="rounded-lg border border-line bg-bg px-3 py-2 text-base"
              />
            )}
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
              {others.filter((other) => !alsoQuery.trim() || alsoIds.includes(other.id) || other.name.toLowerCase().includes(alsoQuery.trim().toLowerCase())).map((other) => {
                const on = alsoIds.includes(other.id);
                return (
                  <label
                    key={other.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-base ${on ? "border-accent bg-accent/15 font-semibold" : "border-line bg-panel"}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setAlsoIds(on ? alsoIds.filter((id) => id !== other.id) : [...alsoIds, other.id])}
                    />
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: other.color }} aria-hidden />
                    {other.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <label className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-semibold">People needed at these times</span>
          <select value={people} onChange={(e) => setPeople(Number(e.target.value))} className={selectClass}>
            {PEOPLE_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">A time with fewer people than this turns pink.</span>
        </label>

        {shortShift && (
          <p className="rounded-lg bg-bg px-3 py-2 text-sm">
            Shifts are normally at least {MIN_SHIFT_MINUTES / 60} hours. A shorter one is allowed, but it will show a warning.
          </p>
        )}
        <p className="text-sm text-muted">Anything that breaks a rule (a class, the weekly hours) is skipped, and you are told why.</p>
      </div>
    </Modal>
  );
}
