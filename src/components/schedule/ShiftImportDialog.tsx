import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Wand2, XCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { HelpTip } from "../help/HelpTip";
import { parseShiftText } from "../../features/scheduling/shift-import";
import type { Day, Student } from "../../features/scheduling/types";

const EXAMPLE = "Noa K.: MWF 9:00am-1:00pm\nKai P.: Tuesday/Thursday 8:00am-12:00pm; F 1:00pm-5:00pm";

/**
 * Turns a schedule someone already wrote as text into real shifts. Paste one student per line
 * ("Name: MWF 9:00am-1:00pm"); every line is checked and previewed first, and nothing is placed
 * until the manager presses Add. Students must already be in ShiftFit. When the shifts are
 * placed, any half hour that breaks a rule is skipped and reported, and the whole paste is one
 * Undo step (see `IMPORT_SHIFTS` in `useShiftFitStore.ts`).
 */
export function ShiftImportDialog({
  students,
  slotMinutes,
  onAdd,
  onClose,
}: {
  students: Student[];
  slotMinutes: number;
  onAdd: (entries: { studentId: string; day: Day; start: number; end: number }[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseShiftText(text, students, slotMinutes), [text, students, slotMinutes]);
  const bad = parsed.rows.length - parsed.valid.length;

  return (
    <Modal
      title="Paste shifts you already have"
      description="Paste a schedule written as text. ShiftFit checks every line before adding anything."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={parsed.shiftCount === 0}
            onClick={() =>
              onAdd(
                parsed.valid.flatMap((r) => r.shifts.map((s) => ({ studentId: r.studentId as string, day: s.day, start: s.start, end: s.end }))),
              )
            }
          >
            {parsed.shiftCount ? `Add ${parsed.shiftCount} ${parsed.shiftCount === 1 ? "shift" : "shifts"}` : "Add shifts"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1">
            <label htmlFor="shift-text" className="text-sm font-medium">
              One student per line
            </label>
            <HelpTip label="How to write the list">
              Type the student&apos;s name, a colon, then their shift days and times. Separate several shifts with a semicolon. The student must already be
              added to ShiftFit. Shifts that break a rule (like overlapping a class) are skipped, and you&apos;ll be told which.
            </HelpTip>
          </div>
          <p className="text-xs text-muted">
            Example: <code>Noa K.: MWF 9:00am-1:00pm</code>
          </p>
          <textarea
            id="shift-text"
            data-autofocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={100_000}
            placeholder={EXAMPLE}
            className="mt-1 w-full rounded-lg border border-line bg-bg p-2 font-mono text-sm"
          />
          {!text.trim() && (
            <Button variant="ghost" className="mt-1" onClick={() => setText(EXAMPLE)}>
              <Wand2 className="h-4 w-4" aria-hidden /> Fill in an example
            </Button>
          )}
        </div>

        {parsed.rows.length > 0 && (
          <div className="space-y-2 rounded-xl border border-line p-3" aria-live="polite">
            <h3 className="text-sm font-semibold">
              Here is what ShiftFit understood{" "}
              <span className="font-normal text-muted">
                ({parsed.valid.length} of {parsed.rows.length} lines{bad ? `, ${bad} will be skipped` : ""})
              </span>
            </h3>
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
              {parsed.rows.map((row) => (
                <li key={row.line} className="flex items-start gap-2">
                  {row.ok && row.warnings.length === 0 && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" role="img" aria-label="Understood" />}
                  {row.ok && row.warnings.length > 0 && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" role="img" aria-label="Please check" />}
                  {!row.ok && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gap" role="img" aria-label="Could not read" />}
                  <span className="min-w-0">
                    <span className="block break-words">
                      <span className="font-semibold">{row.name || "(no name)"}</span>
                      <span className="text-muted">
                        {" "}
                        · line {row.line}
                        {row.ok ? ` · ${row.shifts.length} ${row.shifts.length === 1 ? "shift" : "shifts"}` : ""}
                      </span>
                    </span>
                    {[...row.errors, ...row.warnings].map((m, i) => (
                      <span key={i} className="block break-words text-xs text-muted">
                        {m}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="rounded-lg bg-bg p-3 text-xs text-muted">
          These are added as shifts you placed by hand, so &quot;Rebuild automatic shifts&quot; will never remove them.
        </p>
      </div>
    </Modal>
  );
}
