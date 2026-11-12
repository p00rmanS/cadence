import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { CalendarRange, Copy, LayoutGrid, PanelRight, Printer, Users, UsersRound } from "lucide-react";
import { ScheduleGrid } from "./ScheduleGrid";
import { ScheduleList } from "./ScheduleList";
import { BusyTimesDialog } from "./BusyTimesDialog";
import { CopyDayDialog } from "./CopyDayDialog";
import { PrintSchedule } from "./PrintSchedule";
import { daySlots } from "../../features/scheduling/availability";
import { openDays } from "../../features/scheduling/days";
import { clsx } from "../../lib/clsx";
import type { Day, ScheduleIssue, ScheduleSettings, ShiftBlock, Student } from "../../features/scheduling/types";

type View = "grid" | "student" | "day";

/** How long to wait, after pressing Print, before opening the browser's print window (so the clean page has been drawn). */
const PRINT_DELAY_MS = 60;

const VIEWS: { id: View; label: string; icon: typeof LayoutGrid; hint: string }[] = [
  { id: "grid", label: "Grid", icon: LayoutGrid, hint: "Build and edit the schedule" },
  { id: "student", label: "By student", icon: Users, hint: "See each person's shifts" },
  { id: "day", label: "By day", icon: CalendarRange, hint: "See who works each day" },
];

/**
 * Three ways to look at the same schedule. The grid is for building it; the two word views
 * are for reading it, sending it to someone, or printing it.
 */
export function SchedulePanel(props: {
  settings: ScheduleSettings;
  students: Student[];
  assignments: ShiftBlock[];
  issues: ScheduleIssue[];
  selectedStudent: Student | null;
  onToggle: (day: Day, start: number) => void;
  onRange: (day: Day, from: number, to: number, assign: boolean) => void;
  onNotify: (message: string) => void;
  onPlaceShifts?: (
    studentId: string,
    ranges: { day: Day; from: number; to: number }[],
    options: { remove?: { day: Day; from: number; to: number }; alsoStudentIds?: string[]; needPeople?: number },
  ) => void;
  /** Copy every student's shifts from one day onto other days. */
  onCopyDay?: (from: Day, to: Day[]) => void;
  /** Say that some hours on some days need a different number of people. */
  onSetStaffing?: (days: Day[], from: number, to: number, people: number) => void;
  /** The side column with the schedule's health (shown or hidden), and how to flip it. Both optional. */
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
}) {
  const [view, setView] = useState<View>("grid");
  const [tool, setTool] = useState<"copy" | "busy" | null>(null);
  const days = openDays(props.settings);
  const firstDayWithShifts = days.find((d) => props.assignments.some((a) => a.day === d)) ?? days[0];
  const refs = useRef<Record<View, HTMLButtonElement | null>>({ grid: null, student: null, day: null });
  // True from pressing "Print schedule" until the print window closes: the clean printed page exists only then.
  const [printing, setPrinting] = useState(false);

  // Shows the clean page, opens the browser's print window, and removes the page again when printing is over or cancelled.
  useEffect(() => {
    if (!printing) return;
    // This class hides every other printable area (the By student / By day lists) so only the clean page prints.
    document.documentElement.classList.add("printing-schedule");
    const finish = () => setPrinting(false);
    window.addEventListener("afterprint", finish);
    // A moment later, so the page is on screen before the print window takes its picture of it.
    const timer = window.setTimeout(() => window.print(), PRINT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
      document.documentElement.classList.remove("printing-schedule");
    };
  }, [printing]);

  // Left/right arrow keys move between the view tabs (Grid, By student, By day).
  function onKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length;
    setView(VIEWS[next].id);
    refs.current[VIEWS[next].id]?.focus();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="no-print flex items-end border-b border-line px-3 pt-3 sm:px-4">
        <div role="tablist" aria-label="Schedule views" className="flex gap-1">
          {VIEWS.map(({ id, label, icon: Icon, hint }, i) => (
            <button
              key={id}
              ref={(el) => {
                refs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`view-tab-${id}`}
              aria-selected={view === id}
              aria-controls="schedule-view"
              tabIndex={view === id ? 0 : -1}
              title={hint}
              onClick={() => setView(id)}
              onKeyDown={(e) => onKey(e, i)}
              className={clsx(
                "-mb-px flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-sm font-medium",
                view === id ? "border-line bg-panel text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <div className="mb-1 ml-auto flex items-center gap-1">
          {view === "grid" && props.onCopyDay && (
            <button
              type="button"
              onClick={() => setTool("copy")}
              aria-label="Copy a day"
              title="Copy a day: copy one day's shifts onto other days"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-line/40 sm:inline-flex"
            >
              <Copy className="h-4 w-4" aria-hidden /> <span className="wide:hidden xwide:inline">Copy a day</span>
            </button>
          )}
          {view === "grid" && props.onSetStaffing && (
            <button
              type="button"
              onClick={() => setTool("busy")}
              aria-label="Busy times"
              title="Busy times: say which hours need more people"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-line/40 sm:inline-flex"
            >
              <UsersRound className="h-4 w-4" aria-hidden /> <span className="wide:hidden xwide:inline">Busy times</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setPrinting(true)}
            disabled={!props.students.length || !props.assignments.length}
            aria-label="Print schedule"
            title={props.assignments.length ? "Print a clean page of the whole week with every name" : "Add some shifts first"}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-line/40 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" aria-hidden /> <span className="hidden wide:hidden sm:inline xwide:inline">Print</span>
          </button>
          {props.onToggleDetails && (
            // Only on wide screens: on a phone the "Health" tab at the bottom does this job.
            <button
              type="button"
              aria-expanded={props.detailsOpen ?? false}
              aria-controls="schedule-details"
              onClick={props.onToggleDetails}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-line/40 wide:inline-flex"
            >
              <PanelRight className="h-4 w-4" aria-hidden /> {props.detailsOpen ? "Hide details" : "Show details"}
            </button>
          )}
        </div>
      </div>
      <div key={view} id="schedule-view" role="tabpanel" aria-labelledby={`view-tab-${view}`} className="anim-fade-quick min-h-0 flex-1">
        {view === "grid" ? (
          <ScheduleGrid
            settings={props.settings}
            students={props.students}
            assignments={props.assignments}
            issues={props.issues}
            selectedStudent={props.selectedStudent}
            onToggle={props.onToggle}
            onRange={props.onRange}
            onPlaceShifts={props.onPlaceShifts}
          />
        ) : (
          <ScheduleList mode={view} students={props.students} assignments={props.assignments} settings={props.settings} onNotify={props.onNotify} />
        )}
      </div>
      {printing && <PrintSchedule students={props.students} assignments={props.assignments} settings={props.settings} />}
      {tool === "copy" && props.onCopyDay && (
        <CopyDayDialog
          days={days}
          defaultFrom={firstDayWithShifts}
          onCancel={() => setTool(null)}
          onConfirm={(from, to) => {
            props.onCopyDay?.(from, to);
            setTool(null);
          }}
        />
      )}
      {tool === "busy" && props.onSetStaffing && (
        <BusyTimesDialog settings={props.settings} days={days} slots={daySlots(props.settings)} onSet={props.onSetStaffing} onClose={() => setTool(null)} />
      )}
    </div>
  );
}
