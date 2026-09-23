import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { clsx } from "../../lib/clsx";

/**
 * The one button component used everywhere in the app, so every button looks
 * and behaves consistently. `variant` picks its color/emphasis (e.g. `primary`
 * for the main call-to-action, `danger` for a destructive action like Remove).
 * `forwardRef` lets a parent focus this button programmatically (used by
 * `ConfirmDialog` to focus Cancel first) even though `Button` isn't a plain
 * `<button>` element itself.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "border-accent bg-accent text-accent-ink hover:opacity-90",
        variant === "secondary" && "border-line bg-panel text-ink hover:bg-line/30",
        variant === "ghost" && "border-transparent bg-transparent text-ink hover:bg-line/30",
        variant === "danger" && "border-gap/50 bg-transparent text-gap hover:bg-gap-bg",
        variant === "danger-solid" && "border-gap bg-gap text-accent-ink hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
});
