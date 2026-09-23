import type { LucideIcon } from "lucide-react";
import { clsx } from "../../lib/clsx";

/**
 * A row of buttons acting like one control, only one selected at a time (used for office hours,
 * staff-needed, and the theme switch). Generic in `T` so it works for both string and number
 * choices. Pass `icon` on an option to render it icon-only (the text `label` becomes the
 * accessible name via `aria-label`/a visually-hidden span instead of visible text) — a quieter,
 * more compact look for controls that don't need to shout, like the theme switch.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line bg-panel" role="group" aria-label={label}>
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={opt.value === value}
            title={Icon ? opt.label : undefined}
            onClick={() => onChange(opt.value)}
            className={clsx(
              "text-sm font-medium transition-colors",
              Icon ? "p-1.5" : "px-3 py-1.5",
              opt.value === value ? "bg-accent text-accent-ink" : "text-ink hover:bg-line/30",
            )}
          >
            {Icon ? <Icon className="h-4 w-4" aria-hidden /> : opt.label}
            {Icon && <span className="sr-only">{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
