import { useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { formatMinutes } from "../../features/scheduling/time";
import type { ScheduleSettings } from "../../features/scheduling/types";

/**
 * The "Rules" popup (opened from the header). Lets the manager change the two
 * office-wide settings that are meant to be edited occasionally, not per
 * student: the weekly hour cap and the closing time. Both are validated
 * live as the manager types/picks, and the Save button is disabled until
 * both are valid — see `hoursError` / `closeError` below.
 */
const CLOSE_OPTIONS = Array.from({ length: 19 }, (_, i) => 12 * 60 + i * 30); // 12:00pm .. 9:00pm

export function RulesDialog({
  settings,
  onSave,
  onClose,
}: {
  settings: ScheduleSettings;
  onSave: (s: Partial<ScheduleSettings>) => void;
  onClose: () => void;
}) {
  const [hours, setHours] = useState(String(settings.weeklyTargetHours));
  const [closeTime, setCloseTime] = useState(settings.closeTime);

  const parsed = Number(hours);
  const hoursError =
    hours.trim() === "" || Number.isNaN(parsed)
      ? "Type a number of hours, like 19."
      : parsed < 1 || parsed > 40
        ? "Choose between 1 and 40 hours."
        : Math.round(parsed * 2) / 2 !== parsed
          ? "Use whole or half hours, like 19 or 19.5."
          : null;
  const closeError = closeTime <= settings.openTime + 60 ? "The office must be open for at least an hour after it opens." : null;

  return (
    <Modal
      title="Rules"
      description="These apply to everyone. Changing them never deletes a shift."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={Boolean(hoursError || closeError)}
            onClick={() => {
              onSave({ weeklyTargetHours: parsed, closeTime });
              onClose();
            }}
          >
            Save rules
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="rule-hours" className="block text-sm font-medium">
            Most hours a student can work in a week
          </label>
          <p id="rule-hours-help" className="text-xs text-muted">
            ShiftFit warns you before a student goes over this. Check your own employer&apos;s policy for the right number.
          </p>
          <input
            id="rule-hours"
            data-autofocus
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            aria-describedby="rule-hours-help rule-hours-err"
            aria-invalid={Boolean(hoursError)}
            className="mt-1 w-28 rounded-lg border border-line bg-bg p-2 text-sm"
          />
          <span className="ml-2 text-sm text-muted">hours</span>
          {hoursError && (
            <p id="rule-hours-err" role="alert" className="mt-1 text-xs text-gap">
              {hoursError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="rule-close" className="block text-sm font-medium">
            The office closes at
          </label>
          <p className="text-xs text-muted">Shifts after this time stay saved and still count toward hours, but they are hidden from the grid.</p>
          <select
            id="rule-close"
            value={closeTime}
            onChange={(e) => setCloseTime(Number(e.target.value))}
            className="mt-1 rounded-lg border border-line bg-bg p-2 text-sm"
          >
            {CLOSE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {formatMinutes(m)}
              </option>
            ))}
          </select>
          {closeError && (
            <p role="alert" className="mt-1 text-xs text-gap">
              {closeError}
            </p>
          )}
        </div>

        <p className="rounded-lg bg-bg p-3 text-xs text-muted">
          Each box in the schedule is 30 minutes. That is fixed so shifts always line up.
        </p>
      </div>
    </Modal>
  );
}
