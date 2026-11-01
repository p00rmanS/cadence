import { useMemo } from "react";
import { CalendarPlus, Printer } from "lucide-react";
import { Button } from "../ui/Button";
import { SyncroLogo } from "../ui/SyncroLogo";
import { buildStudentIcs, icsFileName, isSemesterConfigured } from "../../features/calendar/ics";
import { parseShiftsCode, hoursOfShifts } from "../../features/sharing/links";
import { formatRange, hoursLabel } from "../../features/scheduling/time";
import { DAYS, DAY_LONG } from "../../features/scheduling/types";
import { downloadTextFile } from "../../lib/download";
import type { ShiftBlock, Student } from "../../features/scheduling/types";

/**
 * ============================================================================
 *  THE STUDENT'S "YOUR SHIFTS" PAGE
 * ============================================================================
 * A manager copies a student's shift link from Save & share and gives it to that student. Opening it shows
 * just that student's week in plain words (day by day, with the total hours), and two buttons: "Add to my
 * calendar" (a calendar file for their phone or computer, once the manager has saved the semester dates) and
 * "Print". The shifts are read from the link itself and checked first (`features/sharing/links.ts`); nothing
 * comes from a server, and the student sees only their own shifts, never anyone else's.
 */

/** The 30-minute boxes of a list of shifts, in the form the calendar-file maker wants. */
function shiftsToBlocks(shifts: { day: ShiftBlock["day"]; start: number; end: number }[]): ShiftBlock[] {
  const blocks: ShiftBlock[] = [];
  for (const shift of shifts) {
    for (let start = shift.start; start < shift.end; start += 30) blocks.push({ id: `me-${shift.day}-${start}`, studentId: "me", day: shift.day, start, source: "manual" });
  }
  return blocks;
}

export function ShiftViewPage({ code }: { code: string }) {
  const result = useMemo(() => parseShiftsCode(code), [code]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="no-print flex items-center gap-3">
        <SyncroLogo className="h-12 w-12 shrink-0" />
        <div>
          <p className="font-display text-xl font-bold leading-none">Syncro</p>
          <p className="text-sm text-muted">Your work shifts</p>
        </div>
      </header>

      {!result.ok && (
        <section className="space-y-2" role="alert">
          <h1 className="font-display text-2xl font-bold">We couldn&apos;t open this link</h1>
          <p className="text-base">{result.error}</p>
        </section>
      )}

      {result.ok && <Shifts shared={result.shared} />}
    </main>
  );
}

/** The shifts themselves, once the link has been checked. */
function Shifts({ shared }: { shared: Extract<ReturnType<typeof parseShiftsCode>, { ok: true }>["shared"] }) {
  const total = hoursOfShifts(shared.shifts);
  const days = DAYS.map((day) => ({ day, shifts: shared.shifts.filter((s) => s.day === day).sort((a, b) => a.start - b.start) })).filter((d) => d.shifts.length > 0);
  const semester = shared.semester;
  const calendarReady = isSemesterConfigured(semester);

  function addToCalendar() {
    if (!semester || !calendarReady) return;
    const me: Student = {
      id: "me",
      name: shared.name,
      color: "#1F6FB2",
      preference: "any",
      daysPerWeek: 5,
      classText: "",
      blockedText: "",
      busy: [],
      latestEnd: 24 * 60,
      breaks: [],
      needsOpeningShift: false,
    };
    downloadTextFile(icsFileName(me), buildStudentIcs(me, shiftsToBlocks(shared.shifts), semester, 30), "text/calendar");
  }

  return (
    <section className="print-area space-y-5" aria-labelledby="shifts-heading">
      <div>
        <h1 id="shifts-heading" className="font-display text-2xl font-bold">
          {shared.name}&apos;s shifts
        </h1>
        <p className="mt-1 text-base text-muted">
          {shared.term === "break" ? "Break schedule" : "Semester schedule"}
          {semester && isSemesterConfigured(semester) ? ` · ${semester.startDate} to ${semester.endDate}` : ""}
        </p>
        <p className="mt-2 text-lg">
          <strong>{hoursLabel(total)}</strong> a week
        </p>
      </div>

      {days.length === 0 && <p className="text-base">You don&apos;t have any shifts yet. Your manager hasn&apos;t scheduled you, or is still working on it.</p>}

      <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
        {days.map(({ day, shifts }) => (
          <li key={day} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
            <span className="font-display text-lg font-semibold">{DAY_LONG[day]}</span>
            <span className="text-base">{shifts.map((s) => formatRange(s.start, s.end)).join(" and ")}</span>
          </li>
        ))}
      </ul>

      <div className="no-print flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={!calendarReady || days.length === 0} onClick={addToCalendar} className="px-4 py-2.5 text-base">
          <CalendarPlus className="h-5 w-5" aria-hidden /> Add to my calendar
        </Button>
        <Button variant="secondary" onClick={() => window.print()} className="px-4 py-2.5 text-base">
          <Printer className="h-5 w-5" aria-hidden /> Print
        </Button>
      </div>
      {!calendarReady && days.length > 0 && (
        <p className="no-print text-sm text-muted">Your manager hasn&apos;t saved the semester dates yet, so the calendar file isn&apos;t ready. Ask them to send the link again once they have.</p>
      )}
      <p className="no-print text-sm text-muted">Shifts can change. If something doesn&apos;t look right, ask your manager. This page is read from your link and stays on your device.</p>
    </section>
  );
}
