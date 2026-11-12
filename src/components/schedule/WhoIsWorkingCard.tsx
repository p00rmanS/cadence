import { createPortal } from "react-dom";
import { Avatar } from "../ui/Avatar";

/**
 * The little card that pops up when the manager points at a box on the schedule. It answers the
 * question "who is working this hour?" with each person's picture (or initials), full name, the
 * exact times of their shift that day, and how many hours they have so far this week. It is only a
 * picture of information the grid already has: it changes nothing, and it never takes the mouse
 * (`pointer-events-none`), so it can never get in the way of clicking or dragging. Screen readers
 * hear the same facts from the box's own spoken label, so this card is hidden from them.
 */

/** One person in the card. `shift` is already written out, for example "7:00am–11:00am". */
export type WorkingPerson = {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  shift: string;
  /** Hours they are scheduled for this week so far. */
  hours: number;
  /** The most hours they should work in a week. */
  limit: number;
};

/** How wide the card is: one column for a few people, two columns when many people work the box. */
const NARROW_WIDTH = 260;
const WIDE_WIDTH = 500;
/** More people than this are shown in two columns. */
const TWO_COLUMNS_FROM = 6;
/** The card never lists more than this many people; the rest are counted ("and 4 more"). */
const MAX_LISTED = 16;
/** The gap, in pixels, between the card and the box it points at, and from the screen's edges. */
const GAP = 8;
/** A rough height for each row of people, used to keep the card on the screen. */
const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 64;

/** The card itself. `anchor` is the screen position of the box it belongs to. */
export function WhoIsWorkingCard({
  title,
  summary,
  people,
  anchor,
}: {
  /** For example "Monday, 7:00am–8:00am". */
  title: string;
  /** For example "7 working · Enough people". */
  summary: string;
  people: WorkingPerson[];
  anchor: { left: number; right: number; top: number };
}) {
  const shown = people.slice(0, MAX_LISTED);
  const hidden = people.length - shown.length;
  const columns = people.length > TWO_COLUMNS_FROM ? 2 : 1;
  const width = Math.min(columns === 2 ? WIDE_WIDTH : NARROW_WIDTH, window.innerWidth - GAP * 2);
  const rows = Math.ceil(shown.length / columns);
  const height = HEADER_HEIGHT + rows * ROW_HEIGHT + (hidden > 0 ? 24 : 0);

  // Prefer the right-hand side of the box; if there is no room, go on its left; never leave the screen.
  let left = anchor.right + GAP;
  if (left + width > window.innerWidth - GAP) left = anchor.left - width - GAP;
  left = Math.max(GAP, Math.min(left, window.innerWidth - width - GAP));
  const top = Math.max(GAP, Math.min(anchor.top, window.innerHeight - height - GAP));

  return createPortal(
    <div
      aria-hidden
      className="soft-shadow pointer-events-none fixed z-50 rounded-xl border border-line bg-panel p-3 text-ink"
      style={{ left, top, width }}
      data-testid="who-is-working-card"
    >
      <p className="font-display text-base font-bold leading-tight">{title}</p>
      <p className="mb-2 text-sm text-muted">{summary}</p>
      <ul className={columns === 2 ? "grid grid-cols-2 gap-x-3 gap-y-1.5" : "flex flex-col gap-1.5"}>
        {shown.map((person) => (
          <li key={person.id} className="flex min-w-0 items-center gap-2">
            <Avatar name={person.name} color={person.color} avatar={person.avatar} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">{person.name}</span>
              <span className="block truncate text-xs leading-tight text-muted">{person.shift}</span>
              <span className="block truncate text-xs leading-tight text-muted">
                {person.hours} of {person.limit} hrs this week
              </span>
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="mt-1.5 text-sm font-medium text-muted">and {hidden} more</p>}
    </div>,
    document.body,
  );
}
