import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Clock, GraduationCap, GripVertical, Pencil, Trash2, UserMinus } from "lucide-react";
import { clsx } from "../../lib/clsx";
import { startStudentDrag } from "../../lib/studentDrag";
import { Avatar } from "../ui/Avatar";
import { describeStretches, weekMap } from "../../features/scheduling/rosterView";
import type { RosterEntry } from "../../features/scheduling/rosterView";
import { DAY_LABEL } from "../../features/scheduling/types";
import type { ScheduleSettings, ShiftBlock } from "../../features/scheduling/types";

/**
 * One student in the big roster view. It answers the manager's questions at a glance: is this student
 * already working, do they still need hours, and when are they free or not free? The little week strip
 * is for looking; the words under it say the same thing for screen readers and for anyone who prefers
 * reading. The whole row can be dragged onto the schedule, exactly like the small card.
 */

/** The colors of the week strip, each paired with words in the legend and in the lines of text, so color is never the only clue. */
const STRIP_COLOR = { scheduled: "bg-accent", free: "bg-ok/50", busy: "bg-line" } as const;

/** The status words with an icon and a color, so "needs hours" and "full" differ by more than color. */
function statusLook(status: RosterEntry["status"]) {
  switch (status) {
    case "over":
      return { icon: AlertTriangle, cls: "text-warn" };
    case "full":
      return { icon: CheckCircle2, cls: "text-ok" };
    case "unscheduled":
      return { icon: Clock, cls: "text-gap" };
    default:
      return { icon: Clock, cls: "text-warn" };
  }
}

/** The legend printed once above the list, explaining the three colors of every week strip. */
export function RosterLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted" aria-hidden>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-full bg-accent" /> Working
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-full bg-ok/50" /> Free
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-full bg-line" /> Can&apos;t work
      </span>
    </p>
  );
}

/** A student's row in the roster: name, status, hours, the week strip, and the free and working times in words. */
export function RosterRow({
  entry,
  assignments,
  settings,
  selected,
  issueCount,
  onSelect,
  onEdit,
  onLeaving,
  onRemove,
}: {
  entry: RosterEntry;
  assignments: ShiftBlock[];
  settings: ScheduleSettings;
  selected: boolean;
  issueCount: number;
  onSelect: () => void;
  onEdit: () => void;
  onLeaving: () => void;
  onRemove: () => void;
}) {
  const { student, hours, limit, status, label } = entry;
  const week = useMemo(() => weekMap(student, assignments, settings), [student, assignments, settings]);
  const working = describeStretches(week, "scheduled", settings.slotMinutes);
  const free = describeStretches(week, "free", settings.slotMinutes);
  const look = statusLook(status);
  const StatusIcon = look.icon;
  const pct = limit > 0 ? Math.min(100, Math.round((hours / limit) * 100)) : 0;

  return (
    <li
      draggable
      onDragStart={(e) => startStudentDrag(e, student.id)}
      title="Drag onto a time in the schedule, or click the name to pick"
      className={clsx(
        "mb-2 cursor-grab rounded-xl border border-line border-l-4 bg-panel p-3 active:cursor-grabbing",
        selected && "ring-2 ring-accent",
      )}
      style={{ borderLeftColor: student.color }}
    >
      <button type="button" aria-pressed={selected} onClick={onSelect} className="block w-full rounded text-left">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <Avatar name={student.name} color={student.color} avatar={student.avatar} />
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{student.name}</span>
          {student.graduating && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden /> Graduating
            </span>
          )}
          {selected && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-ink">Selected</span>}
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
          <span className={clsx("inline-flex items-center gap-1 font-semibold", look.cls)}>
            <StatusIcon className="h-4 w-4" aria-hidden />
            {label}
          </span>
          <span className="text-muted">
            {hours} of {limit} hours
          </span>
          {issueCount > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-gap">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {issueCount} {issueCount === 1 ? "problem" : "problems"}
            </span>
          )}
        </p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className={clsx("h-full", status === "over" ? "bg-warn" : status === "full" ? "bg-ok" : "bg-accent")} style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-2 flex flex-col gap-0.5" aria-hidden>
          {week.map((map) => (
            <div key={map.day} className="flex items-center gap-1.5">
              <span className="w-8 shrink-0 text-xs text-muted">{DAY_LABEL[map.day]}</span>
              <div className="flex h-2 min-w-0 flex-1 gap-px overflow-hidden rounded-full">
                {map.slots.map((slot) => (
                  <span key={slot.start} className={clsx("h-full flex-1", STRIP_COLOR[slot.state])} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-sm">
          <span className="font-semibold">Working: </span>
          {working || "not scheduled yet"}
        </p>
      </button>

      <details className="mt-1 text-sm">
        <summary className="cursor-pointer rounded py-1 font-medium text-accent">Free times</summary>
        <p className="pb-1 text-muted">{free || "No free times left this week."}</p>
      </details>

      <div className="mt-1 flex items-center justify-end gap-0.5">
        <span className="mr-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-muted">
          <GripVertical className="h-4 w-4" aria-hidden /> Drag me
        </span>
        <button type="button" onClick={onEdit} aria-label={`Edit ${student.name}`} title="Edit" className="rounded-md p-2 text-muted hover:bg-line/40 hover:text-ink">
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onLeaving}
          aria-label={`Mark ${student.name} as leaving or graduating`}
          title="Left or graduating"
          className="rounded-md p-2 text-muted hover:bg-line/40 hover:text-ink"
        >
          <UserMinus className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${student.name}`} title="Remove (added by mistake)" className="rounded-md p-2 text-muted hover:bg-gap-bg hover:text-gap">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
