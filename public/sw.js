/*
 * Syncro's "service worker": a small helper script the browser keeps running next to the page. It is what
 * lets Syncro open with no internet once it has been used (and be installed as an app on a phone or computer).
 *
 * What it does, in plain words:
 *  - Pages (the app itself): ask the internet first, so a new version always arrives. If there is no internet,
 *    use the copy it saved last time.
 *  - Other files (code, pictures): show the saved copy right away and quietly refresh it for next time.
 *  - It never touches other websites, and it never saves anything you type: your schedule lives in the
 *    browser's own storage, not here.
 */

// Change this name to throw away every old saved copy at once.
const CACHE = "syncro-app-v1";

// Take over as soon as this version is installed.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(self.registration.scope))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

// Remove saved copies from older versions, then start handling pages right away.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only this site's own files. Anything else (and the large screenshot-reader files) go the normal way.
  if (url.origin !== self.location.origin || url.pathname.includes("/ocr/")) return;

  if (request.mode === "navigate") {
    // Pages: internet first, saved copy as the fallback when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((saved) => saved || caches.match(self.registration.scope))),
    );
    return;
  }

  // Everything else: saved copy now, refreshed in the background.
  event.respondWith(
    caches.match(request).then((saved) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => saved);
      return saved || fresh;
    }),
  );
});
