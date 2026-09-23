import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ParseResult } from "../../features/scheduling/types";
import { DAY_LABEL } from "../../features/scheduling/types";
import { formatRange } from "../../features/scheduling/time";

/**
 * Shows exactly how each line was understood, updating as you type. Pasted text and
 * anything read from a screenshot is treated as untrusted, so nothing is saved until the
 * person has looked at this list.
 */
export function MeetingReview({ parse, title = "Here is what ShiftFit understood" }: { parse: ParseResult; title?: string }) {
  if (!parse.lines.length) return null;
  const good = parse.lines.filter((l) => l.ok).length;
  const bad = parse.lines.length - good;

  return (
    <div className="space-y-2 rounded-xl border border-line p-3" aria-live="polite">
      <h3 className="text-sm font-semibold">
        {title}{" "}
        <span className="font-normal text-muted">
          ({good} of {parse.lines.length} lines{bad ? `, ${bad} need fixing` : ""})
        </span>
      </h3>
      <ul className="space-y-2 text-sm">
        {parse.lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            {line.ok && !line.warning && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" role="img" aria-label="Understood" />}
            {line.ok && line.warning && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" role="img" aria-label="Please check" />}
            {!line.ok && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gap" role="img" aria-label="Could not read" />}
            <span className="min-w-0">
              <span className="block break-words font-mono text-xs">{line.raw}</span>
              {line.ok && line.days && line.start != null && line.end != null && (
                <span className="block text-xs text-muted">
                  {line.days.map((d) => DAY_LABEL[d]).join(", ")} · {formatRange(line.start, line.end)}
                </span>
              )}
              {line.warning && <span className="block text-xs text-muted">{line.warning}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
