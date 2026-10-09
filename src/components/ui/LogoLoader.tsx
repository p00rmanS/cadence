import { clsx } from "../../lib/clsx";

/**
 * A small animated Cadence logo for "please wait" moments (reading a screenshot, sending to the
 * calendar, checking a passcode). It is the same drawing as the splash screen and `CadenceLogo`:
 * the three white bars take turns brightening, and the light dot beats steadily. It is purely
 * decoration (hidden from screen readers), so always put the words ("Reading…") next to it; the
 * button or message around it is what tells a screen reader what is happening. The animation
 * stops by itself for people who asked their device for less motion (see `app.css`).
 */
export function LogoLoader({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={clsx("logo-loader", className)} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.18" />
      <rect className="logo-loader-bar logo-loader-bar-1" x="11" y="8.25" width="13.5" height="4.5" rx="2.25" fill="currentColor" />
      <rect className="logo-loader-bar logo-loader-bar-2" x="7.5" y="13.75" width="9" height="4.5" rx="2.25" fill="currentColor" />
      <circle className="logo-loader-beat" cx="21.25" cy="16" r="2.25" fill="currentColor" />
      <rect className="logo-loader-bar logo-loader-bar-3" x="11" y="19.25" width="13.5" height="4.5" rx="2.25" fill="currentColor" />
    </svg>
  );
}
