import { useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import type { LeftReason, Student } from "../../features/scheduling/types";

/**
 * The window that opens from "Left or graduating" on a student. Real life is more than "delete": a student
 * may be graduating at the end of the semester (still working, but the manager wants to plan ahead), or may
 * have already left (graduated, resigned, found another job). A student who has left moves to the Former
 * students list with their shifts taken off, so the gaps show up pink and the record is kept. Deleting
 * someone added by mistake is the separate Remove button.
 */

/** The reasons shown to the manager, in the words they would use. */
export const LEFT_REASON_LABEL: Record<LeftReason, string> = {
  graduated: "Graduated",
  resigned: "Resigned",
  "other-job": "Found another job",
  other: "Another reason",
};

type Choice = "graduating" | "left";

export function LeaveStudentDialog({
  student,
  shiftHours,
  onGraduating,
  onLeft,
  onCancel,
}: {
  student: Student;
  /** How many hours of shifts they have now, so the manager knows what will open up. */
  shiftHours: number;
  /** Mark (true) or unmark (false) them as graduating at the end of the semester. */
  onGraduating: (graduating: boolean) => void;
  /** They have left: move them to Former students for this reason. */
  onLeft: (reason: LeftReason) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<Choice>(student.graduating ? "left" : "graduating");
  const [reason, setReason] = useState<LeftReason>("graduated");

  function confirm() {
    if (choice === "graduating") onGraduating(!student.graduating);
    else onLeft(reason);
  }

  const optionClass = (on: boolean) => `flex cursor-pointer gap-3 rounded-xl border p-3 text-base ${on ? "border-accent bg-accent/10" : "border-line bg-panel"}`;

  return (
    <Modal
      title={`${student.name} is leaving`}
      description="Pick what is true today. You can bring a former student back later."
      onClose={onCancel}
      size="md"
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={confirm}>
            {choice === "left" ? "Move to former students" : student.graduating ? "Unmark graduating" : "Mark as graduating"}
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">What happened</legend>
        <label className={optionClass(choice === "graduating")}>
          <input type="radio" name="leave-choice" className="mt-1" checked={choice === "graduating"} onChange={() => setChoice("graduating")} />
          <span>
            <span className="block font-semibold">{student.graduating ? "Not graduating after all" : "Graduating at the end of the semester"}</span>
            <span className="block text-sm text-muted">
              {student.graduating
                ? "Takes off the Graduating tag. Nothing else changes."
                : "They keep working until then. A Graduating tag helps you plan who will replace them."}
            </span>
          </span>
        </label>

        <label className={optionClass(choice === "left")}>
          <input type="radio" name="leave-choice" className="mt-1" checked={choice === "left"} onChange={() => setChoice("left")} />
          <span className="flex-1">
            <span className="block font-semibold">They have left</span>
            <span className="block text-sm text-muted">
              {shiftHours > 0
                ? `Their ${shiftHours} hours of shifts come off the schedule, so those times turn pink for you to fill. `
                : "They have no shifts to take off. "}
              They move to Former students, where you can bring them back.
            </span>
            {choice === "left" && (
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-medium">Why?</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as LeftReason)}
                  aria-label="Why did they leave"
                  className="rounded-lg border border-line bg-panel px-2 py-1.5 text-base font-semibold"
                >
                  {(Object.keys(LEFT_REASON_LABEL) as LeftReason[]).map((r) => (
                    <option key={r} value={r}>
                      {LEFT_REASON_LABEL[r]}
                    </option>
                  ))}
                </select>
              </span>
            )}
          </span>
        </label>
      </fieldset>
    </Modal>
  );
}
