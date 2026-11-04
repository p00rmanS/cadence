import { useMemo, useState } from "react";
import { Mail, Pencil, ShieldCheck } from "lucide-react";
import { Button } from "../ui/Button";
import { SyncroLogo } from "../ui/SyncroLogo";
import { StudentFormSheet } from "../students/StudentFormSheet";
import { CopyField } from "./CopyField";
import { studentLimitText } from "./summary";
import { DEFAULT_SETTINGS } from "../../features/scheduling/constants";
import { buildIntakeCode, parseIntakeCode, studentLink } from "../../features/sharing/links";
import { DAY_LONG } from "../../features/scheduling/types";
import type { NewStudentInput } from "../../hooks/useShiftFitStore";

/**
 * ============================================================================
 *  THE STUDENT'S PAGE: "SEND YOUR DETAILS TO YOUR MANAGER"
 * ============================================================================
 * A student opens this page from a link their manager gave them. They fill in the same short form the manager
 * would (their name, class times, and when they want to work), or screenshot their class schedule; then they get
 * a link of their own to send back. The manager opens it and checks it before adding the student.
 * Nothing is uploaded or saved on any server: the details are written into the link itself (see
 * `features/sharing/links.ts`), and the page says so in plain words. The student never sees the manager's
 * schedule or anyone else's information.
 */

/** The office settings the student's form is built with: Monday to Saturday shown, since the manager can sort out which days are open. */
const STUDENT_PAGE_SETTINGS = { ...DEFAULT_SETTINGS, openDays: "mon-sat" as const };

export function StudentIntakePage() {
  const [input, setInput] = useState<NewStudentInput | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // The link is made from the details, then opened again with the same checker the manager will use, so the
  // student sees exactly what the manager will see (and a problem is caught here, not on the manager's side).
  const made = useMemo(() => {
    if (!input) return null;
    const code = buildIntakeCode(input);
    const checked = parseIntakeCode(code);
    return checked.ok ? { link: studentLink(code), student: checked.student } : { link: "", student: null };
  }, [input]);

  const emailLink = made?.link
    ? `mailto:?subject=${encodeURIComponent("My details for the work schedule")}&body=${encodeURIComponent(
        `Hi! Here are my class times and when I can work. Open this link to add me:\n\n${made.link}\n`,
      )}`
    : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3">
        <SyncroLogo className="h-12 w-12 shrink-0" />
        <div>
          <p className="font-display text-xl font-bold leading-none">Syncro</p>
          <p className="text-sm text-muted">Work schedules that fit around classes</p>
        </div>
      </header>

      <section className="space-y-3">
        <h1 className="font-display text-2xl font-bold">Send your details to your manager</h1>
        <p className="text-base">
          Your manager builds the work schedule around your classes. Tell them when you have class and when you want to work, and they won&apos;t have to ask you for it.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-base">
          <li>Fill in your name and class times. You can type them, paste them, or use a screenshot of your schedule.</li>
          <li>Say which days and hours you want to work.</li>
          <li>Copy the link we make and send it to your manager.</li>
        </ol>
      </section>

      {!made && (
        <div>
          <Button variant="primary" className="px-5 py-3 text-base" onClick={() => setFormOpen(true)}>
            Fill in my details
          </Button>
        </div>
      )}

      {made && !made.student && (
        <p role="alert" className="rounded-xl border border-gap/40 bg-gap-bg p-3 text-sm">
          Something about those details couldn&apos;t be used. Please check your name and times and try again.
        </p>
      )}

      {made?.student && (
        <section aria-labelledby="your-link" className="space-y-4 rounded-2xl border border-line bg-panel p-4 shadow-sm">
          <h2 id="your-link" className="font-display text-lg font-semibold">
            Your link is ready, {made.student.name}
          </h2>
          <ul className="list-inside list-disc text-sm text-muted">
            <li>
              {made.student.busy.filter((b) => b.source === "class").length} class {made.student.busy.filter((b) => b.source === "class").length === 1 ? "time" : "times"} included
            </li>
            {made.student.workDays && made.student.workDays.length > 0 && <li>You want to work: {made.student.workDays.map((d) => DAY_LONG[d]).join(", ")}</li>}
            {studentLimitText(made.student) && <li>{studentLimitText(made.student)}</li>}
          </ul>
          <CopyField label="Send this link to your manager" value={made.link} />
          <div className="flex flex-wrap gap-2">
            {emailLink && (
              <a
                href={emailLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-ink hover:bg-line/30"
              >
                <Mail className="h-4 w-4" aria-hidden /> Email it
              </a>
            )}
            <Button variant="secondary" onClick={() => setFormOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden /> Change my details
            </Button>
          </div>
        </section>
      )}

      <aside className="flex gap-3 rounded-xl bg-bg p-3 text-sm text-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden />
        <p>
          <strong className="text-ink">Your details stay with you.</strong> Nothing is uploaded or saved on a server. They are written inside the link, which only works for
          whoever you send it to. Anyone who gets the link can read it, so send it only to your manager.
        </p>
      </aside>

      {formOpen && (
        <StudentFormSheet
          student={null}
          prefill={made?.student ?? null}
          title="Your details"
          saveLabel="Make my link"
          hidePhoto
          settings={STUDENT_PAGE_SETTINGS}
          existingNames={[]}
          onClose={() => setFormOpen(false)}
          onSave={(next) => {
            setInput(next);
            setFormOpen(false);
          }}
        />
      )}
    </main>
  );
}
