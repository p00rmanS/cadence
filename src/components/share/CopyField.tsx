import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../ui/Button";
import { copyText } from "../../lib/clipboard";

/**
 * A read-only box showing a link, with a "Copy link" button beside it. Used wherever Syncro hands out a link:
 * the page students use to send their details, a student's own link, and a student's shifts. The button says
 * "Copied" for a moment so people know it worked; if the browser refuses to copy, the box can still be
 * selected by hand (it selects everything when clicked).
 */
export function CopyField({ label, value, copyLabel = "Copy link" }: { label: string; value: string; copyLabel?: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);

  async function copy() {
    const worked = await copyText(value);
    setCopied(worked);
    window.setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div>
      <label className="block text-sm font-medium">
        {label}
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 w-full rounded-lg border border-line bg-bg p-2 font-mono text-xs"
        />
      </label>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copied" : copyLabel}
        </Button>
        {copied === false && <span role="alert" className="text-xs text-gap">Your browser wouldn&apos;t copy it. Click the box above and copy it by hand.</span>}
      </div>
    </div>
  );
}

/**
 * A single "copy" button for a link that is made at the moment it is pressed (`text` is a function, so a
 * student's shifts are read from the schedule as it is NOW, never from an out-of-date copy). Says
 * "copied" afterwards, or that the browser refused.
 */
export function CopyButton({
  text,
  label,
  copiedLabel,
  ariaLabel,
  disabled = false,
}: {
  text: () => string;
  label: string;
  copiedLabel: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState<boolean | null>(null);

  async function copy() {
    const worked = await copyText(text());
    setCopied(worked);
    window.setTimeout(() => setCopied(null), 2500);
  }

  return (
    <Button variant="secondary" disabled={disabled} aria-label={copied ? copiedLabel : ariaLabel} onClick={() => void copy()}>
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? copiedLabel : copied === false ? "Couldn't copy" : label}
    </Button>
  );
}
