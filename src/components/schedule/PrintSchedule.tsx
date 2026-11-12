import { useMemo } from "react";
import { buildPrintedGrid } from "../../features/scheduling/printView";
import { summarizeByStudent } from "../../features/scheduling/summary";
import { formatMinutes } from "../../features/scheduling/selectors";
import { formatRange } from "../../features/scheduling/time";
import { isOnBreak, studentLimit } from "../../features/scheduling/term";
import { DAY_LABEL, DAY_LONG } from "../../features/scheduling/types";
import type { ScheduleSettings, ShiftBlock, Student } from "../../features/scheduling/types";

/**
 * The page that comes out of the printer. It is only on the screen while printing (the screen shows
 * the buttons and the grid instead). Page one is the whole week: one row per hour, one column per
 * day, every name spelled out, so it can be pinned to a wall and read by everyone. Page two lists each
 * person's hours and shifts, so a student can find their own. Plain black on white, no buttons, and
 * nothing that depends on color, so it prints well on any printer.
 */
export function PrintSchedule({ students, assignments, settings }: { students: Student[]; assignments: ShiftBlock[]; settings: ScheduleSettings }) {
  const grid = useMemo(() => buildPrintedGrid(students, assignments, settings), [students, assignments, settings]);
  const people = useMemo(() => summarizeByStudent(students, assignments, settings), [students, assignments, settings]);
  const title = isOnBreak(settings) ? "Break work schedule" : "Work schedule";
  const printedOn = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="print-area print-schedule-area hidden bg-white text-black print:block" data-testid="print-schedule">
      <header className="flex items-end justify-between border-b-2 border-black pb-2">
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="text-sm">Every name, every hour. {students.length} students.</p>
        </div>
        <p className="text-sm">Printed {printedOn}</p>
      </header>

      <table className="mt-3 w-full table-fixed border-collapse text-[11px] leading-snug">
        <thead>
          <tr>
            <th scope="col" className="w-16 border border-black bg-neutral-200 p-1 text-left">
              Time
            </th>
            {grid.days.map((day) => (
              <th key={day} scope="col" className="border border-black bg-neutral-200 p-1 text-left">
                {DAY_LONG[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.start} className="break-inside-avoid">
              <th scope="row" className="border border-black p-1 text-left align-top font-semibold">
                {formatMinutes(row.start)}
              </th>
              {grid.days.map((day) => {
                const cell = row.cells[day];
                return (
                  <td key={day} className="border border-black p-1 align-top">
                    {cell.closed ? (
                      <span className="font-semibold">Devotional</span>
                    ) : (
                      <>
                        {cell.people.map((person) => (
                          <div key={person.id}>
                            {person.name}
                            {person.half ? " ½" : ""}
                          </div>
                        ))}
                        {cell.needMore > 0 && <div className="font-bold">Needs {cell.needMore} more</div>}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px]">½ means that person works only part of that hour.</p>

      <section className="mt-5 break-before-page">
        <h2 className="mb-2 font-display text-xl font-bold">Hours and shifts, by person</h2>
        <table className="w-full table-fixed border-collapse text-[11px] leading-snug">
          <thead>
            <tr>
              <th scope="col" className="w-36 border border-black bg-neutral-200 p-1 text-left">
                Name
              </th>
              <th scope="col" className="w-20 border border-black bg-neutral-200 p-1 text-left">
                Hours
              </th>
              <th scope="col" className="border border-black bg-neutral-200 p-1 text-left">
                Shifts
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map(({ student, hours, shifts }) => (
              <tr key={student.id} className="break-inside-avoid">
                <th scope="row" className="border border-black p-1 text-left align-top font-semibold">
                  {student.name}
                </th>
                <td className="border border-black p-1 align-top">
                  {hours} of {studentLimit(student, settings)}
                </td>
                <td className="border border-black p-1 align-top">
                  {shifts.length ? shifts.map((s) => `${DAY_LABEL[s.day]} ${formatRange(s.start, s.end)}`).join("  ·  ") : "No shifts yet"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
