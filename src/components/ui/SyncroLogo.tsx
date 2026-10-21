/**
 * The Syncro mark: Austin's blue "S" logo, shown as a picture file (`public/syncro-logo.png`,
 * a 256 px copy of the original `syncro-logo.jpeg`). It is also the browser-tab icon and the
 * picture on the loading splash in `index.html`, so replace the file to change all three.
 *
 * `BASE_URL` is the address the site is served from (for example "/" on your computer, or a
 * sub-folder on GitHub Pages). Starting the path with it keeps the picture from breaking there.
 *
 * The logo's background is pale, so it is drawn on a small rounded tile that looks right on both
 * the light and the dark theme. It is decoration only (the "Syncro" heading next to it names the
 * app), so it is hidden from screen readers.
 */
export function SyncroLogo({ className }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}syncro-logo.png`}
      alt=""
      aria-hidden
      className={`rounded-lg object-cover ${className ?? ""}`}
    />
  );
}
