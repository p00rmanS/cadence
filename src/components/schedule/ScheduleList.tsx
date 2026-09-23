import { Clipboard, Printer } from "lucide-react";
import { Button } from "../ui/Button";
import { scheduleToText, shiftText, summarizeByDay, summarizeByStudent } from "../../features/scheduling/summary";
import { formatRange, hoursLabel } from "../../features/scheduling/time";
import { initials } from "../../features/scheduling/selectors";
import { DAY_LABEL, DAY_LONG } from "../../features/scheduling/types";
import type { ScheduleSettings, ShiftBlock, Student } from "../../features/scheduling/types";

function Chip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-[11px] font-bold text-white" style={{ backgroundColor: color }} aria-hidden>
      {initials(name)}
    </span>
  );
}

/**
 * The schedule as words instead of a grid: what to send to a student ("By student") or post
 * on a wall ("By day"). Both views can be copied as text or printed.
 */
export function ScheduleList({
  mode,
  students,
  assignments,
  settings,
  onNotify,
}: {
  mode: "student" | "day";
  students: Student[];
  assignments: ShiftBlock[];
  settings: ScheduleSettings;
  onNotify: (message: string) => void;
}) {
  const empty = !students.length || !assignments.length;

  async function copy() {
    const text = scheduleToText(students, assignments, settings, mode);
    try {
      await navigator.clipboard.writeText(text);
      onNotify("Copied. You can paste it into a message or email.");
    } catch {
      onNotify("Your browser wouldn't allow copying. Use Print instead, or the spreadsheet in Save & share.");
    }
  }

  return (
    <section aria-labelledby="list-heading" className="flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h2 id="list-heading" className="font-display text-base font-semibold">
          {mode === "student" ? "Everyone's shifts, by student" : "Who works when, by day"}
        </h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copy} disabled={empty}>
            <Clipboard className="h-4 w-4" aria-hidden /> Copy as text
          </Button>
          <Button variant="secondary" onClick={() => window.print()} disabled={empty}>
            <Printer className="h-4 w-4" aria-hidden /> Print
          </Button>
        </div>
      </div>

      <div className="print-area min-h-0 flex-1 overflow-y-auto">
        <h2 className="mb-2 hidden font-display text-xl font-bold print:block">Work schedule</h2>
        {empty ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            {!students.length ? "Add a student first." : "There are no shifts yet. Press “Fill schedule for me”, or click the grid to add some."}
          </p>
        ) : mode === "student" ? (
          <ul className="grid gap-3 xl:grid-cols-2 print:block print:columns-2">
            {summarizeByStudent(students, assignments, settings).map(({ student, hours, shifts }) => (
              <li key={student.id} className="break-inside-avoid rounded-xl border border-line bg-panel p-3 print:mb-3">
                <div className="flex items-center gap-2">
                  <Chip name={student.name} color={student.color} />
                  <h3 className="min-w-0 flex-1 truncate font-semibold">{student.name}</h3>
                  <span className="text-sm text-muted">{hoursLabel(hours)} a week</span>
                </div>
                {shifts.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {shifts.map((s) => (
                      <li key={`${s.day}-${s.start}`} className="flex gap-3">
                        <span className="w-10 shrink-0 font-semibold">{DAY_LABEL[s.day]}</span>
                        <span>{shiftText(s)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">No shifts yet.</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {summarizeByDay(students, assignments, settings).map(({ day, shifts }) => (
              <li key={day} className="break-inside-avoid rounded-xl border border-line bg-panel p-3">
                <h3 className="font-semibold">{DAY_LONG[day]}</h3>
                {shifts.length ? (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {shifts.map((s) => (
                      <li key={`${s.studentId}-${s.start}`} className="flex items-center gap-3">
                        <span className="w-40 shrink-0 tabular-nums">{formatRange(s.start, s.end)}</span>
                        <Chip name={s.name} color={s.color} />
                        <span>{s.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">Nobody scheduled.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
