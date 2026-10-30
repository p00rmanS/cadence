/**
 * Switches on the offline helper (`sw.js`, built from `serviceWorker.ts`) in the published website.
 * It is skipped while developing (`npm run dev`), where a saved copy of old files would only get in
 * the way of seeing changes, and in browsers that don't support service workers (the app then works
 * exactly as before, just not offline).
 */

/** Where the app is running: is it the built site, and which folder is it served from (e.g. "/cadence/")? */
export type ServiceWorkerEnvironment = { production: boolean; baseUrl: string };

/** Registers `sw.js` for this app's folder only, once the page has finished loading. Never throws. */
export function registerServiceWorker(
  environment: ServiceWorkerEnvironment = { production: import.meta.env.PROD, baseUrl: import.meta.env.BASE_URL },
): boolean {
  if (!environment.production || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  // Waiting for "load" keeps the first visit fast: the helper downloads its copies after the page is shown.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${environment.baseUrl}sw.js`, { scope: environment.baseUrl }).catch(() => {
      /* Not available (private mode, blocked): the app still works, just not offline. */
    });
  });
  return true;
}
