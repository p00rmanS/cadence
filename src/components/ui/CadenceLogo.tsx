/**
 * The Cadence mark: a "C" built from three shift blocks, with a light dot for the
 * steady beat of a weekly schedule. Drawn as a small inline SVG (not an image file)
 * so it stays sharp at any size. The browser-tab icon in `public/favicon.svg` is the
 * same drawing — change both together.
 */
export function CadenceLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="#1F6FB2" />
      <rect x="11" y="8.25" width="13.5" height="4.5" rx="2.25" fill="#fff" />
      <rect x="7.5" y="13.75" width="9" height="4.5" rx="2.25" fill="#fff" />
      <circle cx="21.25" cy="16" r="2.25" fill="#9CCBF2" />
      <rect x="11" y="19.25" width="13.5" height="4.5" rx="2.25" fill="#fff" />
    </svg>
  );
}
