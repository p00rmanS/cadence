import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { clsx } from "../../lib/clsx";

/**
 * A small "?" that explains a word or number in plain language. Click or press Enter to
 * open, Escape or clicking elsewhere to close. Works with keyboard and screen readers
 * (the explanation is linked with aria-describedby only while it is open).
 */
export function HelpTip({
  label,
  children,
  align = "left",
  ariaLabel,
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
  /** Overrides the default `What does "${label}" mean?` phrasing — for a HelpTip explaining a fuller thought (like the guidance banner's "more about this") rather than defining one term. */
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={ariaLabel ?? `What does “${label}” mean?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-0.5 text-muted hover:text-ink"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className={clsx(
            "absolute top-full z-30 mt-1 w-64 rounded-lg border border-line bg-panel p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
