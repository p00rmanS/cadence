import { useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { DAY_LONG } from "../../features/scheduling/types";
import type { Day } from "../../features/scheduling/types";

/**
 * The pop-up behind "Copy a day". Many students work the same hours every Monday, Wednesday and Friday,
 * so instead of placing each shift three times the manager builds one day and copies it to the others.
 * This window only asks which day to copy and where to; the store places the shifts and still applies
 * every rule (a class on Wednesday, the weekly hours, the days a student works), skipping what does not fit.
 */
export function CopyDayDialog({
  days,
  defaultFrom,
  onConfirm,
  onCancel,
}: {
  /** The days the office is open. */
  days: Day[];
  /** The day to start from (the first one that has shifts). */
  defaultFrom: Day;
  onConfirm: (from: Day, to: Day[]) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState<Day>(defaultFrom);
  const [to, setTo] = useState<Day[]>([]);
  const targets = to.filter((day) => day !== from);

  return (
    <Modal
      title="Copy a day"
      description="Copy everyone's shifts from one day onto other days. Shifts already there stay."
      onClose={onCancel}
      size="md"
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={targets.length === 0} onClick={() => onConfirm(from, targets)}>
            Copy
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-semibold">Copy from</span>
          <select value={from} onChange={(e) => setFrom(e.target.value as Day)} className="rounded-lg border border-line bg-panel px-2 py-2 text-base font-semibold">
            {days.map((d) => (
              <option key={d} value={d}>
                {DAY_LONG[d]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-base font-semibold">Copy onto</legend>
          <div className="flex flex-wrap gap-2">
            {days
              .filter((d) => d !== from)
              .map((d) => {
                const on = to.includes(d);
                return (
                  <label
                    key={d}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-base ${on ? "border-accent bg-accent/15 font-semibold" : "border-line bg-panel"}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => setTo(on ? to.filter((x) => x !== d) : [...to, d])} />
                    {DAY_LONG[d]}
                  </label>
                );
              })}
          </div>
        </fieldset>

        <p className="text-sm text-muted">
          Anything that breaks a rule (a class that day, the weekly hours, the days a student works) is skipped, and you are told how much. One Undo takes the whole copy back.
        </p>
      </div>
    </Modal>
  );
}
