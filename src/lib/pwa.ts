import { useSyncExternalStore } from "react";

/**
 * ============================================================================
 *  INSTALLING SYNCRO AS AN APP
 * ============================================================================
 * Syncro can be installed on a computer, phone or tablet like a normal app: its own icon, its own
 * window with no browser bar, and it opens even with no internet. Three small pieces make that work:
 *  - `public/manifest.webmanifest` tells the browser the app's name, colors and icons.
 *  - `public/sw.js` (the "service worker") keeps a saved copy so it can open offline.
 *  - This file registers that worker and remembers the browser's "this can be installed" offer, so a
 *    button in Save & share can use it. Browsers that make the offer: Chrome and Edge. On iPhone and iPad
 *    there is no such offer, so the button is replaced by the steps to follow by hand.
 */

/** The browser's install offer: calling `prompt()` shows the "Install Syncro?" question. */
type InstallOffer = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let offer: InstallOffer | null = null;
const listeners = new Set<() => void>();

/** Tells every screen that is watching (the Save & share window) that the offer changed. */
function notify(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Starts listening for the browser's install offer. Called once when the page loads, because the browser
 * makes the offer early, long before anyone opens Save & share.
 */
export function listenForInstallOffer(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // keep the offer for our own button instead of the browser's small pop-up
    offer = event as InstallOffer;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    offer = null;
    notify();
  });
}

/**
 * Registers the offline helper. Only in the real website (not the practice server `npm run dev`, where a
 * saved copy would hide your latest edits), and only in browsers that support it.
 */
export function registerOfflineHelper(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      /* No helper just means no offline use; the app itself works the same. */
    });
  });
}

/** True when Syncro is already open as an installed app (its own window, no browser bar). */
export function isInstalledApp(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
}

/** Shows the browser's "Install Syncro?" question. Does nothing if the browser has made no offer. */
export async function installApp(): Promise<void> {
  if (!offer) return;
  const pending = offer;
  offer = null; // an offer can be used only once
  notify();
  await pending.prompt();
  await pending.userChoice;
}

/** For a screen: true while the browser is offering to install Syncro (re-checks itself when that changes). */
export function useInstallOffer(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => offer !== null,
    () => false,
  );
}
