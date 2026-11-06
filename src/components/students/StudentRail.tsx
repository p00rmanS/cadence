import { useMemo, useState } from "react";
import { Maximize2, Minimize2, Plus, Search, Undo2, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { EmptyMark } from "../ui/EmptyMark";
import { StudentCard } from "./StudentCard";
import { RosterLegend, RosterRow } from "./RosterRow";
import { LEFT_REASON_LABEL } from "./LeaveStudentDialog";
import { buildRoster, rosterCounts } from "../../features/scheduling/rosterView";
import type { RosterFilter, RosterSort } from "../../features/scheduling/rosterView";
import { summarizeStudent } from "../../features/scheduling/selectors";
import { studentLimit } from "../../features/scheduling/term";
import type { FormerStudent, ScheduleIssue, ScheduleSettings, ShiftBlock, Student } from "../../features/scheduling/types";

/**
 * The left-hand column: search box, "Add student"/"Add several at once" entry points, and the scrolling list of students.
 * It has two looks. The small one is a short card per student. The roster one (the expand button in its header) is
 * wider and shows, for each student, whether they are working, how many hours they still need, and when they are
 * free, with filters and sorting for a long list. Both look at the same stored students; nothing here changes them.
 * Students who have left sit in a "Former students" list at the bottom, where they can be brought back.
 */

/** The filter chips in the roster, with the words printed on them. */
const FILTERS: { value: RosterFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "needs", label: "Need hours" },
  { value: "unscheduled", label: "Not scheduled" },
  { value: "full", label: "At their hours" },
  { value: "graduating", label: "Graduating" },
];

export function StudentRail({
  students,
  formerStudents,
  assignments,
  settings,
  issues,
  selectedStudentId,
  wide,
  canToggleWide,
  onToggleWide,
  onSelect,
  onEdit,
  onRemove,
  onLeaving,
  onRestore,
  onForget,
  onAddNew,
  onAddMany,
  onImportLink,
}: {
  students: Student[];
  formerStudents: FormerStudent[];
  assignments: ShiftBlock[];
  settings: ScheduleSettings;
  issues: ScheduleIssue[];
  selectedStudentId: string | null;
  /** True when the roster look (wide, with free times and filters) is on. */
  wide: boolean;
  /** False on screens where the student list is too narrow for the roster look, so its button is not offered. */
  canToggleWide: boolean;
  onToggleWide: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  /** Opens the window for a student who is leaving or graduating. */
  onLeaving: (id: string) => void;
  onRestore: (id: string) => void;
  onForget: (id: string) => void;
  onAddNew: () => void;
  onAddMany: () => void;
  /** Opens the "Student links" window (ask students for their details, or add one from a link they sent). */
  onImportLink: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [sort, setSort] = useState<RosterSort>("name");

  // The small list only has search and name order; the filters and sorting belong to the roster look.
  const activeFilter = wide ? filter : "all";
  const activeSort = wide ? sort : "name";
  const roster = useMemo(
    () => buildRoster(students, assignments, settings, { query, filter: activeFilter, sort: activeSort }),
    [students, assignments, settings, query, activeFilter, activeSort],
  );
  const counts = useMemo(() => rosterCounts(students, assignments, settings), [students, assignments, settings]);
  const issueCountOf = (id: string) => issues.filter((i) => i.studentId === id && !i.overridden).length;

  return (
    <section aria-labelledby="students-heading" className="flex h-full min-h-0 flex-col gap-3 bg-panel p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="students-heading" className="whitespace-nowrap font-display text-lg font-semibold">
          Students
          {students.length > 0 && <span className="ml-1.5 text-base font-normal text-muted">({students.length})</span>}
        </h2>
        <div className="flex items-center gap-1.5">
          {canToggleWide && (
            <Button
              variant="secondary"
              className="px-2"
              aria-pressed={wide}
              aria-label={wide ? "Back to the small student list" : "Open the roster: who is free, who needs hours"}
              title={wide ? "Back to the small list" : "Roster: who is free, who needs hours"}
              onClick={onToggleWide}
            >
              {wide ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
              <span className="text-sm">{wide ? "Smaller" : "Roster"}</span>
            </Button>
          )}
          <Button variant="primary" className="shrink-0 whitespace-nowrap px-2.5" onClick={onAddNew}>
            <Plus className="h-4 w-4" aria-hidden /> Add student
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted">
        Drag a name onto a time, or click a name and then the times.{" "}
        <button type="button" onClick={onAddMany} className="font-medium text-accent underline underline-offset-2">
          Add several at once
        </button>
        {" · "}
        <button type="button" onClick={onImportLink} className="font-medium text-accent underline underline-offset-2">
          Student links
        </button>
      </p>

      {students.length > 5 && (
        <label className="relative block">
          <span className="sr-only">Search students by name</span>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-lg border border-line bg-bg py-2 pl-8 pr-2 text-sm"
          />
        </label>
      )}

      {wide && students.length > 0 && (
        <>
          <div role="group" aria-label="Show which students" className="flex flex-wrap gap-1.5">
            {FILTERS.filter((f) => f.value !== "graduating" || counts.graduating > 0 || filter === "graduating").map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${filter === f.value ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg hover:bg-line/30"}`}
              >
                {f.label} <span className={filter === f.value ? "" : "text-muted"}>{counts[f.value]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <RosterLegend />
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-muted">Order</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as RosterSort)} className="rounded-lg border border-line bg-bg px-2 py-1 text-sm font-medium">
                <option value="name">By name</option>
                <option value="needs">Most hours needed first</option>
              </select>
            </label>
          </div>
        </>
      )}

      <ul className="stagger min-h-0 flex-1 overflow-y-auto pr-0.5" aria-label="Student list">
        {roster.map((entry) =>
          wide ? (
            <RosterRow
              key={entry.student.id}
              entry={entry}
              assignments={assignments}
              settings={settings}
              selected={entry.student.id === selectedStudentId}
              issueCount={issueCountOf(entry.student.id)}
              onSelect={() => onSelect(entry.student.id)}
              onEdit={() => onEdit(entry.student.id)}
              onLeaving={() => onLeaving(entry.student.id)}
              onRemove={() => onRemove(entry.student.id)}
            />
          ) : (
            <StudentCard
              key={entry.student.id}
              summary={summarizeStudent(entry.student, assignments, settings)}
              targetHours={studentLimit(entry.student, settings)}
              limitHours={studentLimit(entry.student, settings)}
              selected={entry.student.id === selectedStudentId}
              issueCount={issueCountOf(entry.student.id)}
              onSelect={() => onSelect(entry.student.id)}
              onEdit={() => onEdit(entry.student.id)}
              onLeaving={() => onLeaving(entry.student.id)}
              onRemove={() => onRemove(entry.student.id)}
            />
          ),
        )}
        {!students.length && (
          <li className="rounded-xl border border-dashed border-line p-5 text-center">
            <EmptyMark className="mx-auto h-16 w-16" />
            <p className="mt-2 font-semibold">No students yet</p>
            <p className="mt-1 text-sm text-muted">Add a student and paste the times they have class. Syncro keeps them out of those times.</p>
            <Button variant="primary" className="mt-3" onClick={onAddNew}>
              <Plus className="h-4 w-4" aria-hidden /> Add your first student
            </Button>
          </li>
        )}
        {students.length > 0 && !roster.length && (
          <li className="text-sm text-muted">{query.trim() ? `No student has “${query}” in their name.` : "No student fits this filter right now."}</li>
        )}

        {formerStudents.length > 0 && (
          <li className="mt-3 list-none">
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-base font-semibold">Former students ({formerStudents.length})</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {formerStudents.map((former) => (
                  <li key={former.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{former.name}</span>
                      <span className="block text-sm text-muted">
                        {LEFT_REASON_LABEL[former.leftReason]}
                        {former.leftOn ? ` · ${former.leftOn}` : ""}
                      </span>
                    </span>
                    <span className="flex gap-1">
                      <Button variant="secondary" aria-label={`Bring back ${former.name}`} onClick={() => onRestore(former.id)}>
                        <Undo2 className="h-4 w-4" aria-hidden /> Bring back
                      </Button>
                      <Button variant="ghost" aria-label={`Delete ${former.name} for good`} title="Delete for good" onClick={() => onForget(former.id)}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        )}
      </ul>
    </section>
  );
}
