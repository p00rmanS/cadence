import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { formatMinutes } from "../../features/scheduling/selectors";
import { MAX_PEOPLE_AT_ONCE, PEOPLE_CHOICES } from "../../features/scheduling/constants";
import { DAY_LABEL, DAY_LONG } from "../../features/scheduling/types";
import type { Day, ScheduleSettings } from "../../features/scheduling/types";

/**
 * The pop-up behind "Busy times". The office has a standard number of people it needs at once, but some
 * hours (a lunch rush, a Monday morning) need more. Here the manager lists those hours: pick the days,
 * the times and how many people. They show on the grid as "Needs 2", and a box with fewer people turns
 * pink, so the manager can see what is short before filling it. The same list can also be set while
 * placing a student; this window is for when no one is being placed.
 */

export function BusyTimesDialog({
  settings,
  days,
  slots,
  onSet,
  onClose,
}: {
  settings: ScheduleSettings;
  days: Day[];
  /** Every half hour the office is open (the first is opening time). */
  slots: number[];
  /** Says "these hours on these days need N people" (N equal to the standard clears them). */
  onSet: (days: Day[], from: number, to: number, people: number) => void;
  onClose: () => void;
}) {
  const step = settings.slotMinutes;
  const [picked, setPicked] = useState<Day[]>(days.filter((d) => d !== "sat"));
  const [from, setFrom] = useState(slots.find((s) => s >= 11 * 60) ?? slots[0]);
  const [to, setTo] = useState(Math.min(from + 120, slots[slots.length - 1] + step));
  const [people, setPeople] = useState(Math.min(settings.minStaffPerSlot + 1, MAX_PEOPLE_AT_ONCE));

  // The same hours on several days are shown as one line ("Mon, Tue, Wed 11:00am to 1:00pm"), since a manager thinks of them as one rule.
  const groups: { days: Day[]; from: number; to: number; people: number }[] = [];
  for (const need of [...(settings.staffingNeeds ?? [])].sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day))) {
    const same = groups.find((g) => g.from === need.from && g.to === need.to && g.people === need.people);
    if (same) same.days.push(need.day);
    else groups.push({ days: [need.day], from: need.from, to: need.to, people: need.people });
  }
  groups.sort((a, b) => a.from - b.from || days.indexOf(a.days[0]) - days.indexOf(b.days[0]));
  const valid = picked.length > 0 && to > from;
  const selectClass = "rounded-lg border border-line bg-panel px-2 py-2 text-base font-semibold";

  return (
    <Modal
      title="Busy times"
      description={`Most of the week needs ${settings.minStaffPerSlot} ${settings.minStaffPerSlot === 1 ? "person" : "people"} at once. List the hours that need more.`}
      onClose={onClose}
      size="md"
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-5">
        <section aria-label="Busy times you have set">
          {groups.length === 0 ? (
            <p className="rounded-lg bg-bg px-3 py-2 text-base text-muted">None yet. Every hour needs {settings.minStaffPerSlot}.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {groups.map((group) => {
                const dayWords = group.days.map((d) => DAY_LONG[d]).join(", ");
                return (
                <li key={`${group.days.join("")}-${group.from}`} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-base">
                  <span>
                    <span className="font-semibold">{group.days.map((d) => DAY_LABEL[d]).join(", ")}</span> {formatMinutes(group.from)} to {formatMinutes(group.to)}:{" "}
                    <span className="font-semibold">{group.people} people</span>
                  </span>
                  <Button
                    variant="ghost"
                    aria-label={`Remove ${dayWords} ${formatMinutes(group.from)} to ${formatMinutes(group.to)}`}
                    title="Remove this busy time"
                    onClick={() => onSet(group.days, group.from, group.to, settings.minStaffPerSlot)}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Add a busy time" className="flex flex-col gap-3 rounded-xl border border-line p-3">
          <h3 className="text-base font-semibold">Add a busy time</h3>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Days</legend>
            {days.map((d) => {
              const on = picked.includes(d);
              return (
                <label key={d} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-base ${on ? "border-accent bg-accent/15 font-semibold" : "border-line bg-panel"}`}>
                  <input type="checkbox" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== d) : [...picked, d])} />
                  <span aria-hidden>{DAY_LABEL[d]}</span>
                  <span className="sr-only">{DAY_LONG[d]}</span>
                </label>
              );
            })}
          </fieldset>
          <div className="flex flex-wrap items-center gap-2 text-base">
            <label className="flex items-center gap-2">
              <span className="font-semibold">From</span>
              <select value={from} onChange={(e) => setFrom(Number(e.target.value))} aria-label="Busy time starts" className={selectClass}>
                {slots.map((m) => (
                  <option key={m} value={m}>
                    {formatMinutes(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="font-semibold">to</span>
              <select value={to} onChange={(e) => setTo(Number(e.target.value))} aria-label="Busy time ends" className={selectClass}>
                {slots.map((m) => (
                  <option key={m} value={m + step}>
                    {formatMinutes(m + step)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="font-semibold">needs</span>
              <select value={people} onChange={(e) => setPeople(Number(e.target.value))} aria-label="People needed" className={selectClass}>
                {PEOPLE_CHOICES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>{people === 1 ? "person" : "people"}</span>
            </label>
          </div>
          {to <= from && <p role="alert" className="text-sm font-semibold text-gap">The end must be after the start.</p>}
          <div>
            <Button variant="primary" disabled={!valid} onClick={() => onSet(picked, from, to, people)}>
              <Plus className="h-4 w-4" aria-hidden /> Add busy time
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
