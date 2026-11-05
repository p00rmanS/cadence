import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { HelpTip } from "../help/HelpTip";
import { assignedHours, canAssign, daySlots, isAssigned, staffAt } from "../../features/scheduling/availability";
import { describeGap } from "../../features/scheduling/issues";
import { isDevotional, isOnBreak, studentLimit } from "../../features/scheduling/term";
import { formatMinutes, initials } from "../../features/scheduling/selectors";
import { endSentence } from "../../features/scheduling/time";
import { MIN_SHIFT_MINUTES } from "../../features/scheduling/constants";
import { droppedShift, droppedStudentId, isStudentDrag, startShiftDrag } from "../../lib/studentDrag";
import { PlaceShiftDialog } from "./PlaceShiftDialog";
import { requiredStaff } from "../../features/scheduling/staffing";
import type { TimeRow } from "./PlaceShiftDialog";
import { DAY_LABEL, DAY_LONG } from "../../features/scheduling/types";
import { openDays } from "../../features/scheduling/days";
import { useLayoutQuery } from "../../hooks/useMediaQuery";
import { clsx } from "../../lib/clsx";
import type { Day, ScheduleIssue, ScheduleSettings, ShiftBlock, Student } from "../../features/scheduling/types";

/** More people than this in one box are shown as a count ("9 working") instead of a name tag each, so a busy box never stretches the whole column. */
const MAX_NAMES_SHOWN = 3;

/** How long the first time in the pop-up is when a student card is dropped: the shortest allowed shift. */
const DEFAULT_DROP_MINUTES = MIN_SHIFT_MINUTES;

/**
 * ============================================================================
 *  THE WEEKLY SCHEDULE GRID
 * ============================================================================
 * The main "build the schedule" screen: one table, days across the top, 30-
 * minute time slots down the side. This is the most interaction-heavy
 * component in the app — it supports click, Shift+click, mouse-drag, and
 * full keyboard navigation (arrow keys / Home / End / Page Up / Page Down) on
 * ONE shared Tab stop (see the AUDIT.md note about ~100 Tab stops in an
 * earlier version). `model` below is recomputed whenever the schedule
 * changes and holds everything one grid box needs to render (who's on it,
 * whether it's short-staffed, its screen-reader label) so the render loop
 * itself stays simple. Read `activate` (click), `beginDrag`/`extendDrag`
 * (mouse drag-to-fill), and `onCellKeyDown` (keyboard) to see the three ways
 * a box gets toggled.
 */
type Anchor = { day: Day; start: number; assign: boolean };

type CellModel = {
  staffIds: string[];
  need: number;
  /** How many people this box needs in total (the standard number, or a special number set for this time). */
  required: number;
  /** True on the first box of a stretch that needs more than one person: only that box prints "Needs N". */
  requiredStart: boolean;
  /** Tuesday devotional during the semester: nobody works, nobody is needed. */
  closed: boolean;
  mine: boolean;
  hardBlocked: boolean;
  label: string;
  /** True on the first box of a run of boxes that all need the same number of people: only that box says "Need N". */
  gapStart: boolean;
  /** Why the picked student can't work here, in one or two plain words ("Class", "Day off"); empty if they can. */
  blockedWhy: string;
  /** True on the first box of a stretch with the same blocked reason: only that box prints the words. */
  blockedStart: boolean;
  /** True on the first box of a closed stretch (the Tuesday devotional): only that box shows the word. */
  closedStart: boolean;
  /** True when too many people work here to show a name tag each (see MAX_NAMES_SHOWN). */
  crowded: boolean;
  /** True on the first box of a stretch with the same crowd size: only that box prints the count. */
  crowdedStart: boolean;
  /** Students who were ALSO working in the box just above: they show as a thin bar, not their initials again. */
  continuing: Set<string>;
};

/** The short, plain words printed in a box where the picked student can't work (instead of a pattern to decode). */
const BLOCKED_WORDS: Record<string, string> = {
  class_conflict: "Class",
  unavailable: "Day off",
  after_cutoff: "Too late",
  break_conflict: "Break",
  devotional: "Devotional",
};

/** How much of a name fits in a box: all of it alone, the first name for two people, initials for three or more. */
function shortName(name: string, peopleInBox: number): string {
  if (peopleInBox >= 3) return initials(name);
  if (peopleInBox === 2) return name.split(/\s+/)[0];
  return name;
}

/**
 * The week grid: one row per half hour, one column per weekday. Clicking a box adds or removes
 * the selected student; dragging (or Shift+click) fills a stretch; arrow keys move around.
 */
export function ScheduleGrid({
  settings,
  students,
  assignments,
  issues,
  selectedStudent,
  onToggle,
  onRange,
  onPlaceShifts,
}: {
  settings: ScheduleSettings;
  students: Student[];
  assignments: ShiftBlock[];
  issues: ScheduleIssue[];
  selectedStudent: Student | null;
  onToggle: (day: Day, start: number) => void;
  onRange: (day: Day, from: number, to: number, assign: boolean) => void;
  /**
   * The manager confirmed the pop-up after dropping a student card (or a shift) on the schedule: give that
   * student these stretches (each `to` is the last half hour). `remove` is the old shift when one was moved.
   */
  onPlaceShifts?: (
    studentId: string,
    ranges: { day: Day; from: number; to: number }[],
    options: { remove?: { day: Day; from: number; to: number }; alsoStudentIds?: string[]; needPeople?: number },
  ) => void;
}) {
  const slots = useMemo(() => daySlots(settings), [settings]);
  const wide = useLayoutQuery(640);
  // Saturday shows only when the office is open on Saturdays (Settings → Days open).
  const days = useMemo(() => openDays(settings), [settings]);
  const [chosenMobileDay, setMobileDay] = useState<Day>("mon");
  // If the office stops opening on the day picked on a phone (Saturday), fall back to Monday.
  const mobileDay = days.includes(chosenMobileDay) ? chosenMobileDay : days[0];
  const visibleDays: Day[] = wide ? days : [mobileDay];

  const [active, setActive] = useState({ row: 0, col: 0 });
  const [info, setInfo] = useState<{ day: Day; start: number } | null>(null);
  const anchor = useRef<Anchor | null>(null);
  // Mouse drag-to-fill: where the press started and how it should act (add or clear), plus a live preview.
  const dragStart = useRef<{ day: Day; start: number; assign: boolean } | null>(null);
  const dragLast = useRef<{ day: Day; start: number } | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ day: Day; from: number; to: number; assign: boolean } | null>(null);
  // A student card being dragged over the grid: the stretch (one minimum-length shift) it would fill if dropped here.
  const [dropRange, setDropRange] = useState<{ day: Day; from: number; to: number } | null>(null);
  // The pop-up that asks "when do they work?" after a card or shift is dropped (null when it is closed).
  const [placing, setPlacing] = useState<{ studentId: string; day: Day; rows: TimeRow[]; moving: { day: Day; from: number; to: number } | null } | null>(null);
  const onRangeRef = useRef(onRange);
  onRangeRef.current = onRange;
  const cells = useRef(new Map<string, HTMLButtonElement>());

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  // Slots holding a rule-breaking shift, so the cell can show a warning icon (not just a color).
  const problemSlots = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) {
      if (issue.day && issue.start != null && issue.end != null) {
        for (let m = issue.start; m < issue.end; m += settings.slotMinutes) set.add(`${issue.studentId}|${issue.day}|${m}`);
      }
    }
    return set;
  }, [issues, settings.slotMinutes]);

  // Everything a cell needs, worked out once per data change (not on every hover).
  const model = useMemo(() => {
    const out = new Map<string, CellModel>();
    for (const day of days) {
      for (const start of slots) {
        const staffIds = staffAt(day, start, assignments);
        const names = staffIds.map((id) => studentById.get(id)?.name ?? "Unknown");
        const closed = isDevotional(day, start, settings);
        const required = requiredStaff(settings, day, start);
        const need = closed ? 0 : required - staffIds.length;
        const mine = selectedStudent ? isAssigned(selectedStudent.id, day, start, assignments) : false;
        const violation = selectedStudent && !mine ? canAssign(selectedStudent, day, start, assignments, settings) : null;
        const hardBlocked = Boolean(
          violation && (violation.code === "class_conflict" ||
            violation.code === "unavailable" ||
            violation.code === "after_cutoff" ||
            violation.code === "break_conflict" ||
          violation.code === "devotional"),
        );

        let label = `${DAY_LONG[day]} ${formatMinutes(start)} to ${formatMinutes(start + settings.slotMinutes)}.`;
        label += names.length ? ` ${endSentence(`Working: ${names.join(", ")}`)}` : " Nobody is working.";
        if (closed) label += " Tuesday devotional. Nobody works now.";
        else label += need > 0 ? ` Needs ${need} more. ${describeGap(students, assignments, settings, day, start)}` : " Enough people.";
        if (!closed && required > 1) label += ` This time needs ${required} people.`;
        if (selectedStudent) {
          if (mine) label += ` ${selectedStudent.name} is working here. Press to remove.`;
          else label += violation ? ` ${selectedStudent.name} ${violation.message}.` : ` Press to add ${selectedStudent.name}.`;
        }
        out.set(`${day}|${start}`, { staffIds, need, required: closed ? 0 : required, requiredStart: false, crowded: staffIds.length > MAX_NAMES_SHOWN, crowdedStart: false, closed, mine, hardBlocked, label, gapStart: false, closedStart: false, blockedWhy: hardBlocked && violation ? (BLOCKED_WORDS[violation.code] ?? "Cannot work") : "", blockedStart: false, continuing: new Set() });
      }
    }
    // Calmer to read: a shift is drawn as one block (initials once, then a thin bar), and a gap says "Need N" once.
    for (const day of days) {
      slots.forEach((start, i) => {
        const here = out.get(`${day}|${start}`)!;
        const above = i > 0 ? out.get(`${day}|${slots[i - 1]}`) : undefined;
        here.gapStart = here.need > 0 && above?.need !== here.need;
        here.closedStart = here.closed && !above?.closed;
        here.requiredStart = here.required > 1 && above?.required !== here.required;
        here.crowdedStart = here.crowded && !(above?.crowded && above.staffIds.length === here.staffIds.length);
        here.blockedStart = here.blockedWhy !== "" && above?.blockedWhy !== here.blockedWhy;
        for (const id of here.staffIds) if (above?.staffIds.includes(id)) here.continuing.add(id);
      });
    }
    return out;
  }, [slots, assignments, students, studentById, settings, selectedStudent]);

  const row = Math.min(active.row, Math.max(0, slots.length - 1));
  const col = Math.min(active.col, Math.max(0, visibleDays.length - 1));

  useEffect(() => {
    anchor.current = null;
  }, [selectedStudent?.id]);

  // Moves keyboard focus to a box, keeping the row and column inside the grid's edges.
  function focusCell(r: number, c: number) {
    const rr = Math.max(0, Math.min(slots.length - 1, r));
    const cc = Math.max(0, Math.min(visibleDays.length - 1, c));
    setActive({ row: rr, col: cc });
    cells.current.get(`${cc}-${rr}`)?.focus();
  }

  // Arrow keys, Home and End move between boxes, like in a spreadsheet.
  function onCellKeyDown(e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) {
    const move: Record<string, [number, number]> = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
      Home: [r, 0],
      End: [r, visibleDays.length - 1],
      PageUp: [r - 8, c],
      PageDown: [r + 8, c],
    };
    const target = move[e.key];
    if (target) {
      e.preventDefault();
      focusCell(target[0], target[1]);
    }
  }

  // Mouse pressed on a box: remember where the drag started and whether it adds or removes shifts.
  function beginDrag(e: PointerEvent<HTMLButtonElement>, day: Day, start: number) {
    // Mouse and pen only. Touch keeps scrolling the page, and the keyboard has its own range keys.
    if (e.button !== 0 || e.pointerType === "touch" || !selectedStudent) return;
    const mine = model.get(`${day}|${start}`)?.mine ?? false;
    dragStart.current = { day, start, assign: !mine };
    dragLast.current = { day, start };
  }

  // Mouse moved over another box on the same day while dragging: stretch the highlighted range to it.
  function extendDrag(day: Day, start: number) {
    const from = dragStart.current;
    if (!from || from.day !== day) return;
    dragLast.current = { day, start };
    if (start !== from.start) setDrag({ day, from: from.start, to: start, assign: from.assign });
  }

  // A drag can end anywhere, even outside the grid, so it is finished from the window.
  useEffect(() => {
    function finish() {
      const from = dragStart.current;
      const last = dragLast.current;
      dragStart.current = null;
      dragLast.current = null;
      setDrag(null);
      if (!from || !last || last.day !== from.day || last.start === from.start) return;
      // The mouse-up is followed by a click; that click was the end of the drag, so it must not toggle a box.
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      onRangeRef.current(from.day, from.start, last.start, from.assign);
    }
    function cancel() {
      dragStart.current = null;
      dragLast.current = null;
      setDrag(null);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") cancel();
    }
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // The stretch a drop on this box starts out as: begins here and lasts the shortest shift, stopping at closing time.
  function dropRangeAt(day: Day, start: number, minutes = DEFAULT_DROP_MINUTES) {
    const lastSlot = slots[slots.length - 1];
    return { day, from: start, to: Math.min(start + minutes - settings.slotMinutes, lastSlot) };
  }

  // The whole shift a student has around one box: walks up and down while the next half hour is also theirs.
  function shiftAround(studentId: string, day: Day, slot: number) {
    let from = slot;
    let to = slot;
    while (isAssigned(studentId, day, from - settings.slotMinutes, assignments)) from -= settings.slotMinutes;
    while (isAssigned(studentId, day, to + settings.slotMinutes, assignments)) to += settings.slotMinutes;
    return { day, from, to };
  }

  // True if this box is inside the stretch a dropped student card would fill (so it can be outlined).
  const inDrop = (day: Day, slot: number) => dropRange !== null && dropRange.day === day && slot >= dropRange.from && slot <= dropRange.to;

  // True if this box is inside the range currently being dragged (so it can be highlighted).
  const inDrag = (day: Day, slot: number) =>
    drag !== null && drag.day === day && slot >= Math.min(drag.from, drag.to) && slot <= Math.max(drag.from, drag.to);

  // A box was clicked or pressed with Enter/Space. With Shift held, fill from the last box to this one.
  function activate(day: Day, start: number, shift: boolean) {
    if (!selectedStudent) {
      onToggle(day, start); // the store explains "pick a student first"
      return;
    }
    const cell = model.get(`${day}|${start}`);
    if (shift && anchor.current && anchor.current.day === day && anchor.current.start !== start) {
      onRange(day, anchor.current.start, start, anchor.current.assign);
      return;
    }
    const mine = cell?.mine ?? false;
    const allowed = mine || canAssign(selectedStudent, day, start, assignments, settings) === null;
    onToggle(day, start);
    // Remember what this click meant (add or clear) so Shift+click can extend it — only if it actually worked.
    anchor.current = allowed ? { day, start, assign: !mine } : null;
  }

  const selectedHours = selectedStudent ? assignedHours(selectedStudent.id, assignments, settings) : 0;
  const infoCell = info ? model.get(`${info.day}|${info.start}`) : null;

  return (
    <section aria-labelledby="grid-heading" className="flex h-full min-h-0 flex-col gap-2 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="grid-heading" className="font-display text-xl font-semibold">
          {isOnBreak(settings) ? "Break schedule" : "Semester schedule"}
          <HelpTip label="Weekly schedule">
            Each box is 30 minutes. Pick a student on the left, then click a box to give them that half hour. Click again to take
            it away. To fill a stretch, drag down a column or hold Shift and click. A blue box means the picked student works
            that box, and a ⚠ means a rule is broken there. Shifts must be at least 2 hours. The semester and break schedules
            are kept separately: the Semester / Break switch at the top chooses which one you see and change.
          </HelpTip>
        </h2>
        <p className="text-base" aria-live="polite">
          {selectedStudent ? (
            <>
              Scheduling <strong>{selectedStudent.name}</strong>{" "}
              <span className="text-muted">
                ({selectedHours} of {studentLimit(selectedStudent, settings)} hours)
              </span>
            </>
          ) : (
            <span className="font-medium">Drag a student from the left onto a time, or pick a student and click the times they work.</span>
          )}
        </p>
      </div>

      {/* Only the three things a manager looks for; the rest is explained behind the "?" above. */}
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-base" aria-label="What the boxes mean">
        <li className="flex items-center gap-2">
          <span className="h-5 w-5 rounded bg-panel ring-1 ring-inset ring-line" aria-hidden /> Enough people
        </li>
        <li className="flex items-center gap-2">
          <span className="h-5 w-5 rounded border-l-4 border-gap bg-gap-bg" aria-hidden /> <span className="font-semibold text-gap">Needs someone</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-5 w-5 rounded bg-line/50" aria-hidden /> Picked student can&apos;t work
        </li>
      </ul>

      {!wide && (
        <div role="group" aria-label="Choose a day" className="flex gap-1">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === mobileDay}
              onClick={() => setMobileDay(d)}
              className={clsx(
                "flex-1 rounded-lg border px-2 py-2 text-sm font-medium",
                d === mobileDay ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel",
              )}
            >
              {DAY_LABEL[d]}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto soft-shadow rounded-xl border border-line bg-panel">
        <table role="grid" aria-label="Weekly schedule. Use the arrow keys to move between boxes." className="w-full min-w-[280px] select-none border-separate border-spacing-0">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-20 w-20 bg-panel p-1 text-right text-sm font-normal text-muted">
                <span className="sr-only">Time</span>
              </th>
              {visibleDays.map((day) => (
                <th key={day} scope="col" className="sticky top-0 z-10 border-b border-line bg-panel px-2 py-2.5 text-left text-base font-bold text-ink">
                  <span aria-hidden>{DAY_LABEL[day]}</span>
                  <span className="sr-only">{DAY_LONG[day]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            onMouseLeave={() => setInfo(null)}
            onDragLeave={(e) => {
              // Leaving the table altogether (not just moving between two boxes) clears the outline.
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropRange(null);
            }}
          >
            {slots.map((slot, r) => (
              <tr key={slot}>
                <th
                  scope="row"
                  className={clsx(
                    "sticky left-0 z-10 whitespace-nowrap bg-panel p-1 pr-2 text-right align-top text-sm",
                    slot % 60 === 0 ? "border-t border-line/70 font-semibold text-ink" : "border-t border-line/15 font-normal text-muted",
                  )}
                >
                  {formatMinutes(slot)}
                </th>
                {visibleDays.map((day, c) => {
                  const cell = model.get(`${day}|${slot}`)!;
                  const isActive = r === row && c === col;
                  return (
                    <td
                      key={day}
                      role="gridcell"
                      className={clsx("px-[3px] py-0 align-middle", slot % 60 === 0 ? "border-t border-line/60" : "border-t border-line/15")}
                    >
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) cells.current.set(`${c}-${r}`, el);
                          else cells.current.delete(`${c}-${r}`);
                        }}
                        tabIndex={isActive ? 0 : -1}
                        aria-label={cell.label}
                        aria-pressed={selectedStudent ? cell.mine : undefined}
                        aria-disabled={cell.hardBlocked ? true : undefined}
                        onFocus={() => {
                          setActive({ row: r, col: c });
                          setInfo({ day, start: slot });
                        }}
                        onMouseEnter={() => setInfo({ day, start: slot })}
                        onDragOver={(e) => {
                          if (!onPlaceShifts || !isStudentDrag(e)) return;
                          e.preventDefault(); // this is what tells the browser "yes, dropping here is allowed"
                          e.dataTransfer.dropEffect = "copy";
                          if (dropRange?.day !== day || dropRange.from !== slot) setDropRange(dropRangeAt(day, slot));
                        }}
                        onDrop={(e) => {
                          const studentId = droppedStudentId(e);
                          if (!onPlaceShifts || !studentId) return;
                          e.preventDefault();
                          setDropRange(null);
                          // A whole shift dragged from the grid is MOVED (same length, old one removed on confirm);
                          // a student card starts as the shortest shift. Either way the pop-up lets the manager fix the times.
                          const moved = droppedShift(e);
                          const length = moved ? moved.to - moved.from + settings.slotMinutes : DEFAULT_DROP_MINUTES;
                          const target = dropRangeAt(day, slot, length);
                          setPlacing({
                            studentId,
                            day,
                            rows: [{ from: target.from, to: target.to + settings.slotMinutes }],
                            moving: moved ? { day: moved.day as Day, from: moved.from, to: moved.to } : null,
                          });
                        }}
                        onPointerDown={(e) => {
                          // Picking up a shift to move it is not the click-and-drag "fill" gesture.
                          if ((e.target as HTMLElement).closest("[draggable=true]")) return;
                          beginDrag(e, day, slot);
                        }}
                        onPointerEnter={() => extendDrag(day, slot)}
                        onKeyDown={(e) => onCellKeyDown(e, r, c)}
                        onClick={(e: MouseEvent<HTMLButtonElement>) => {
                          if (suppressClick.current) return; // this click was the end of a drag, which already did the work
                          activate(day, slot, e.shiftKey);
                        }}
                        className={clsx(
                          "relative flex h-11 w-full min-w-[72px] items-center gap-1 overflow-hidden rounded-md px-1 text-left transition duration-100 ease-out",
                          cell.mine ? "bg-accent/25" : cell.closed || cell.blockedWhy ? "bg-line/40" : cell.need > 0 ? "border-l-4 border-gap bg-gap-bg" : "bg-transparent",
                          inDrop(day, slot) && "outline outline-2 -outline-offset-2 outline-accent",
                          inDrag(day, slot) &&
                            (drag?.assign
                              ? "bg-accent/25 outline outline-2 -outline-offset-2 outline-accent"
                              : "outline outline-2 -outline-offset-2 outline-dashed outline-muted"),
                          cell.hardBlocked ? "cursor-not-allowed" : "hover:bg-line/30",
                        )}
                      >
                        {cell.closedStart && !cell.staffIds.length && (
                          <span className="relative text-sm font-semibold text-muted" aria-hidden>
                            Devotional
                          </span>
                        )}
                        {cell.blockedStart && !cell.closed && !cell.staffIds.length && (
                          <span className="relative text-sm font-medium text-muted" aria-hidden>
                            {cell.blockedWhy}
                          </span>
                        )}
                        {cell.crowded &&
                          (cell.crowdedStart ? (
                            <span className="relative inline-flex h-8 items-center gap-1 rounded-md bg-accent px-2 text-sm font-bold text-accent-ink" aria-hidden>
                              {cell.staffIds.length} working
                              {cell.staffIds.some((id) => problemSlots.has(`${id}|${day}|${slot}`)) && <AlertTriangle className="h-4 w-4 shrink-0" />}
                            </span>
                          ) : (
                            <span className="relative h-full w-2 shrink-0 rounded-full bg-accent/70" aria-hidden />
                          ))}
                        {!cell.crowded && cell.staffIds.map((id) => {
                          const s = studentById.get(id);
                          if (!s) return null;
                          const broken = problemSlots.has(`${id}|${day}|${slot}`);
                          // Both the name tag and the thin bar under it can be picked up to move that whole shift.
                          const pickUp = onPlaceShifts
                            ? {
                                draggable: true,
                                title: `Drag ${s.name}'s shift to another time or day`,
                                onDragStart: (e: DragEvent<HTMLSpanElement>) => startShiftDrag(e, id, shiftAround(id, day, slot)),
                              }
                            : {};
                          if (cell.continuing.has(id) && !broken) {
                            return <span key={id} {...pickUp} className="relative h-full w-2 shrink-0 cursor-grab rounded-full opacity-90" style={{ backgroundColor: s.color }} aria-hidden />;
                          }
                          return (
                            <span
                              key={id}
                              {...pickUp}
                              className="relative inline-flex h-8 min-w-8 cursor-grab max-w-full items-center justify-center gap-1 truncate rounded-md px-2 text-sm font-bold text-white"
                              style={{ backgroundColor: s.color }}
                              aria-hidden
                            >
                              {shortName(s.name, cell.staffIds.length)}
                              {broken && <AlertTriangle className="h-4 w-4 shrink-0" />}
                            </span>
                          );
                        })}
                        {cell.requiredStart && !cell.gapStart && (
                          <span className="relative ml-auto pr-1 text-sm font-semibold text-muted" aria-hidden>
                            Needs {cell.required}
                          </span>
                        )}
                        {cell.gapStart && (
                          <span className="relative ml-auto pr-1 text-sm font-bold text-gap" aria-hidden>
                            Need {cell.need}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sighted helper text. Screen readers already hear the same words from the focused box. */}
      <p aria-hidden className="min-h-12 rounded-lg bg-bg px-3 py-2 text-base leading-snug">
        {dropRange
          ? `Let go to choose their times, starting at ${formatMinutes(dropRange.from)}.`
          : infoCell
            ? infoCell.label
            : "Point at a box to see who is working."}
      </p>

      {placing && onPlaceShifts && (
        <PlaceShiftDialog
          studentName={studentById.get(placing.studentId)?.name ?? "this student"}
          mode={placing.moving ? "move" : "add"}
          day={placing.day}
          days={days}
          rows={placing.rows}
          slots={slots}
          slotMinutes={settings.slotMinutes}
          onCancel={() => setPlacing(null)}
          others={students.filter((s) => s.id !== placing.studentId).map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          currentNeed={requiredStaff(settings, placing.day, placing.rows[0].from)}
          onConfirm={(day, rows, extra) => {
            // The dialog's end time is when they stop; the store wants the last half hour they work.
            const ranges = rows.map((row) => ({ day, from: row.from, to: row.to - settings.slotMinutes }));
            onPlaceShifts(placing.studentId, ranges, { remove: placing.moving ?? undefined, ...extra });
            setPlacing(null);
          }}
        />
      )}
    </section>
  );
}
