import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";

/**
 * The real entry point: the one line that tells the browser "render the
 * Cadence app (`App`, from `src/app/App.tsx`) into the `<div id="root">` in
 * `index.html`". Nothing else in the app is reachable except through `App`.
 */
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/bricolage-grotesque/latin-500.css";
import "@fontsource/bricolage-grotesque/latin-700.css";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

/**
 * Hides the splash screen (the animated logo in `index.html`). It stays up for at least
 * SPLASH_MIN_MS in total, so the logo animation can finish instead of flashing by, then fades out
 * and is removed from the page so screen readers and keyboards never meet it.
 */
const SPLASH_MIN_MS = 1500;
/** Matches the fade-out time in the splash's CSS (`transition: opacity 0.45s`). */
const SPLASH_FADE_MS = 450;

function hideSplash(): void {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const wait = Math.max(0, SPLASH_MIN_MS - performance.now());
  window.setTimeout(() => {
    splash.classList.add("splash-done");
    window.setTimeout(() => splash.remove(), SPLASH_FADE_MS);
  }, wait);
}

hideSplash();
