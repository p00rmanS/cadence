import { useRef, useState } from "react";
import { ImageUp, Wand2 } from "lucide-react";
import { Button } from "../ui/Button";
import { HelpTip } from "../help/HelpTip";
import { extractSchedule, isRemoteExtractionAvailable } from "../../features/import/schedule-extractor";
import type { ExtractionOutcome } from "../../features/import/schedule-extractor";

const EXAMPLE = "MWF 9:00-9:50\nTTh 1:00pm-2:15pm";

/**
 * Where class times go. Typing or pasting is checked instantly by the parent (no button
 * needed). A screenshot can only be read when a server-side reader is configured; if it
 * isn't, we say so plainly instead of showing a button that does nothing.
 */
export function ImportPanel({
  classText,
  onClassTextChange,
  onExtracted,
}: {
  classText: string;
  onClassTextChange: (text: string) => void;
  onExtracted: (outcome: ExtractionOutcome) => void;
}) {
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const remoteAvailable = isRemoteExtractionAvailable();

  async function readScreenshot() {
    if (!image) return;
    setBusy(true);
    setStatus("Reading the screenshot… this can take a little while.");
    try {
      const outcome = await extractSchedule({ text: classText, image });
      onExtracted(outcome);
      setStatus(outcome.error ?? (outcome.ai ? "Done. Please check what it found below before saving." : null));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <label htmlFor="class-text" className="text-sm font-medium">
          When does this student have class?
        </label>
        <HelpTip label="Class times">
          Type or paste one class per line. The days go first, then the start and end time, like <b>MWF 9:00-9:50</b>. M=Mon, T=Tue,
          W=Wed, Th=Thu, F=Fri. You can paste the Meeting Patterns column straight from Workday.
        </HelpTip>
      </div>
      <p className="text-xs text-muted">
        One class per line. Examples: <code>MWF 9:00-9:50</code> or <code>Tuesday/Thursday 8:00 AM - 9:15 AM</code>.
      </p>
      <textarea
        id="class-text"
        value={classText}
        onChange={(e) => onClassTextChange(e.target.value)}
        placeholder={"MWF 9:00-9:50\nTTh 1:00pm-2:15pm"}
        rows={4}
        maxLength={5000}
        className="w-full rounded-lg border border-line bg-bg p-2 font-mono text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        {!classText.trim() && (
          <Button variant="ghost" onClick={() => onClassTextChange(EXAMPLE)}>
            <Wand2 className="h-4 w-4" aria-hidden /> Fill in an example
          </Button>
        )}
        {remoteAvailable ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <ImageUp className="h-4 w-4" aria-hidden /> {image ? image.name : "Use a screenshot instead"}
            </Button>
            {image && (
              <Button variant="primary" onClick={readScreenshot} disabled={busy}>
                {busy ? "Reading…" : "Read the screenshot"}
              </Button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted">Reading screenshots isn&apos;t set up here. Typing or pasting always works.</p>
        )}
      </div>
      {status && (
        <p role="status" className="text-xs text-muted">
          {status}
        </p>
      )}
    </div>
  );
}
