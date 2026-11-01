import { useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { CopyField } from "./CopyField";
import { codeFromText, parseIntakeCode, studentPageLink } from "../../features/sharing/links";
import { DAY_LONG } from "../../features/scheduling/types";
import { studentLimitText } from "./summary";
import type { Student } from "../../features/scheduling/types";

/**
 * ============================================================================
 *  THE MANAGER'S "STUDENT LINKS" WINDOW
 * ============================================================================
 * Two jobs in one place, because they belong together:
 *  1. ASK students to send their details: a link to a page where a student types or screenshots their
 *     classes and gets a link of their own to send back. The manager copies this one link and shares it once.
 *  2. USE a link a student sent: paste it here (or just open it, which opens this window already filled in).
 *     It shows what the student sent, and "Review and add" opens the normal add-student form with everything
 *     filled in, so the manager still looks it over and presses Add themselves. Nothing is added by itself.
 * The link is checked before anything is shown (`features/sharing/links.ts`); a broken one only gets a
 * plain "that doesn't look right".
 */
export function ImportStudentDialog({
  initialText = "",
  existingNames,
  onReview,
  onClose,
}: {
  /** Link text to start with (when the manager opened a student's link directly). */
  initialText?: string;
  existingNames: string[];
  /** Called with the student's details when the manager chooses "Review and add". */
  onReview: (student: Student) => void;
  onClose: () => void;
}) {
  const [pasted, setPasted] = useState(initialText);
  const code = codeFromText(pasted);
  const result = useMemo(() => (code ? parseIntakeCode(code) : null), [code]);
  const student = result?.ok ? result.student : null;
  const alreadyThere = student ? existingNames.some((n) => n.trim().toLowerCase() === student.name.trim().toLowerCase()) : false;

  return (
    <Modal
      title="Student links"
      description="Let students send you their own details, instead of typing them in yourself."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" disabled={!student} onClick={() => student && onReview(student)}>
            Review and add
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="font-display text-base font-semibold">1. Ask your students for their details</h3>
          <p className="text-sm text-muted">
            Send this one link to your students. They open it, fill in their classes (or screenshot their schedule) and send you back a link of their own. Nothing is
            uploaded or stored anywhere: the details travel inside the link.
          </p>
          <CopyField label="Link for students" value={studentPageLink()} />
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-base font-semibold">2. Add a student from the link they sent</h3>
          <label htmlFor="student-link" className="block text-sm font-medium">
            Paste the link here
          </label>
          <textarea
            id="student-link"
            data-autofocus
            rows={3}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            aria-describedby="student-link-status"
            aria-invalid={Boolean(result && !result.ok)}
            placeholder="https://…/#/add/…"
            className="w-full rounded-lg border border-line bg-bg p-2 font-mono text-xs"
          />
          <div id="student-link-status" aria-live="polite">
            {!pasted.trim() && <p className="text-xs text-muted">Paste the whole link, even if it spans several lines.</p>}
            {pasted.trim() && !code && <p role="alert" className="text-xs text-gap">There is no student link in that text. Paste the whole link.</p>}
            {result && !result.ok && (
              <p role="alert" className="text-xs text-gap">
                {result.error}
              </p>
            )}
            {student && (
              <div className="rounded-xl border border-line bg-bg p-3 text-sm">
                <p className="font-semibold">{student.name} sent their details</p>
                <ul className="mt-1 list-inside list-disc text-muted">
                  <li>
                    {student.busy.filter((b) => b.source === "class").length} class {student.busy.filter((b) => b.source === "class").length === 1 ? "time" : "times"} read
                  </li>
                  {student.workDays && student.workDays.length > 0 && <li>Wants to work: {student.workDays.map((d) => DAY_LONG[d]).join(", ")}</li>}
                  {studentLimitText(student) && <li>{studentLimitText(student)}</li>}
                </ul>
                {alreadyThere && (
                  <p className="mt-2 text-xs text-warn">
                    You already have a student with this name. You can still review it, and change the name if it is a different person.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted">Nothing is added yet. &ldquo;Review and add&rdquo; opens the form so you can check everything first.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
