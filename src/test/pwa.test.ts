// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CACHE_PREFIX, READER_CACHE, buildServiceWorker } from "../pwa/serviceWorker";
import { registerServiceWorker } from "../pwa/registerServiceWorker";

/**
 * Tests for the installable, offline-capable app (`src/pwa/`). The generated `sw.js` is RUN here in a
 * pretend service-worker world (a fake `self`, `caches` and `fetch`), so the tests check what it really
 * does: which requests it answers, from where, and what it leaves alone.
 */

const SCOPE = "https://p00rmans.github.io/cadence/";
const FILES = ["index.html", "assets/index-abc123.js", "manifest.webmanifest"];

type Handler = (event: Record<string, unknown>) => void;

/** A pretend browser cache: boxes by name, each mapping an address to the saved text. */
function fakeCaches(initial: Record<string, Record<string, string>> = {}) {
  const boxes = new Map(Object.entries(initial).map(([name, entries]) => [name, new Map(Object.entries(entries))]));
  return {
    boxes,
    open: async (name: string) => {
      if (!boxes.has(name)) boxes.set(name, new Map());
      const box = boxes.get(name)!;
      return {
        addAll: async (urls: string[]) => urls.forEach((url) => box.set(url, `saved:${url}`)),
        match: async (request: { url: string }) => box.get(request.url),
        put: async (request: { url: string }, response: unknown) => void box.set(request.url, response as string),
      };
    },
    keys: async () => [...boxes.keys()],
    delete: async (name: string) => boxes.delete(name),
    // Like a real browser, a request carrying an Origin note doesn't match a file saved without one
    // ("Vary: Origin"), unless the search is told to ignore that (`ignoreVary`).
    match: async (request: string | { url: string; withOriginNote?: boolean }, options: { ignoreVary?: boolean } = {}) => {
      const url = typeof request === "string" ? request : request.url;
      if (typeof request !== "string" && request.withOriginNote && !options.ignoreVary) return undefined;
      for (const box of boxes.values()) if (box.has(url)) return box.get(url);
      return undefined;
    },
  };
}

/** Runs the generated sw.js in a pretend world and returns its event handlers plus the fakes. */
function runServiceWorker(options: { online: boolean; caches?: ReturnType<typeof fakeCaches>; files?: string[]; readerStatus?: number }) {
  const handlers: Record<string, Handler> = {};
  const caches = options.caches ?? fakeCaches();
  const fetched: string[] = [];
  const self = {
    registration: { scope: SCOPE },
    addEventListener: (type: string, handler: Handler) => (handlers[type] = handler),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  // A pretend internet: records each download, and fails when "offline".
  const fetch = async (request: { url: string }) => {
    fetched.push(request.url);
    if (!options.online) throw new TypeError("offline");
    // The screenshot reader's files come back as real-looking answers (with a status and clone), like a browser's.
    if (request.url.includes("/ocr/")) {
      const answer = { status: options.readerStatus ?? 200, body: `network:${request.url}`, clone: () => answer };
      return answer;
    }
    return `network:${request.url}`;
  };
  new Function("self", "caches", "fetch", buildServiceWorker(options.files ?? FILES, "v1"))(self, caches, fetch);
  return { handlers, caches, fetched, self };
}

/** Sends one pretend request through the helper. Returns its answer, or "not handled" if it stayed out of the way. */
async function request(sw: ReturnType<typeof runServiceWorker>, url: string, init: { method?: string; mode?: string; withOriginNote?: boolean } = {}) {
  let answer: Promise<unknown> | null = null;
  const req = { url, method: init.method ?? "GET", mode: init.mode ?? "no-cors", withOriginNote: init.withOriginNote ?? false };
  sw.handlers.fetch({ request: req, respondWith: (p: Promise<unknown>) => (answer = p) });
  return answer ? await answer : "not handled";
}

/** Runs an install or activate event and waits for the work it started. */
async function lifecycle(sw: ReturnType<typeof runServiceWorker>, type: "install" | "activate") {
  let work: Promise<unknown> = Promise.resolve();
  sw.handlers[type]({ waitUntil: (p: Promise<unknown>) => (work = p) });
  await work;
}

describe("the offline helper (sw.js)", () => {
  it("saves every app file when installed, in a box named for this version", async () => {
    const sw = runServiceWorker({ online: true });
    await lifecycle(sw, "install");
    const box = sw.caches.boxes.get(`${CACHE_PREFIX}v1`)!;
    expect([...box.keys()].sort()).toEqual(FILES.map((f) => SCOPE + f).sort());
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it("deletes this app's old versions but never another app's storage", async () => {
    const caches = fakeCaches({ [`${CACHE_PREFIX}old`]: {}, [`${CACHE_PREFIX}v1`]: {}, "netmon-cache": {} });
    const sw = runServiceWorker({ online: true, caches });
    await lifecycle(sw, "activate");
    expect([...caches.boxes.keys()].sort()).toEqual(["netmon-cache", `${CACHE_PREFIX}v1`]);
  });

  it("gets pages from the internet first, so a new version always reaches people", async () => {
    const sw = runServiceWorker({ online: true });
    await lifecycle(sw, "install");
    expect(await request(sw, SCOPE, { mode: "navigate" })).toBe(`network:${SCOPE}`);
  });

  it("opens the saved app when offline", async () => {
    const sw = runServiceWorker({ online: false });
    await lifecycle(sw, "install");
    expect(await request(sw, SCOPE, { mode: "navigate" })).toBe(`saved:${SCOPE}index.html`);
    expect(await request(sw, `${SCOPE}assets/index-abc123.js`)).toBe(`saved:${SCOPE}assets/index-abc123.js`);
  });

  it("still finds the saved script when the page asks with an Origin note (the bug seen offline in a real browser)", async () => {
    // index.html loads its script and stylesheet with crossorigin, so the browser adds an Origin note; servers that
    // label files "Vary: Origin" then made the saved copy look like a different file, and the app didn't draw offline.
    const sw = runServiceWorker({ online: false });
    await lifecycle(sw, "install");
    expect(await request(sw, `${SCOPE}assets/index-abc123.js`, { mode: "cors", withOriginNote: true })).toBe(`saved:${SCOPE}assets/index-abc123.js`);
  });

  it("serves saved app files without asking the internet (their names change every build)", async () => {
    const sw = runServiceWorker({ online: true });
    await lifecycle(sw, "install");
    sw.fetched.length = 0;
    expect(await request(sw, `${SCOPE}assets/index-abc123.js`)).toBe(`saved:${SCOPE}assets/index-abc123.js`);
    expect(sw.fetched).toEqual([]);
  });

  it("stays out of the way of other sites, the server, other github.io projects, and anything but downloads", async () => {
    const sw = runServiceWorker({ online: true });
    await lifecycle(sw, "install");
    expect(await request(sw, "https://p00rmans.github.io/netmon/")).toBe("not handled");
    expect(await request(sw, "https://example.com/x.js")).toBe("not handled");
    expect(await request(sw, `${SCOPE}api/publish`)).toBe("not handled");
    expect(await request(sw, `${SCOPE}index.html`, { method: "POST" })).toBe("not handled");
  });
});

describe("switching it on", () => {
  it("does nothing while developing, so old saved files never hide new changes", () => {
    expect(registerServiceWorker({ production: false, baseUrl: "/" })).toBe(false);
  });
});

describe("installing as an app", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));

  it("describes the app with relative addresses, so it works in the /cadence/ folder", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe(".");
    expect(manifest.scope).toBe(".");
    for (const icon of manifest.icons) expect(icon.src).not.toMatch(/^\/|^https?:/);
  });

  it("has every icon it lists, including a maskable one for phones that crop icons", () => {
    for (const icon of manifest.icons) expect(() => readFileSync(`public/${icon.src}`), icon.src).not.toThrow();
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon"');
  });
});

describe("the screenshot reader's big files (rule 5)", () => {
  const WITH_READER = [...FILES, "ocr/worker.min.js", "ocr/lang/eng.traineddata.gz"];
  const READER_FILE = `${SCOPE}ocr/lang/eng.traineddata.gz`;

  it("are NOT downloaded when the app is installed (about 12 MB nobody asked for yet)", async () => {
    const sw = runServiceWorker({ online: true, files: WITH_READER });
    await lifecycle(sw, "install");
    const saved = [...sw.caches.boxes.get(`${CACHE_PREFIX}v1`)!.keys()];
    expect(saved.some((url) => url.includes("/ocr/"))).toBe(false);
    expect(saved).toHaveLength(FILES.length);
  });

  it("are saved the first time they are used, and then come from the saved copy even offline", async () => {
    const online = runServiceWorker({ online: true, files: WITH_READER });
    await lifecycle(online, "install");
    expect(await request(online, READER_FILE)).toMatchObject({ body: `network:${READER_FILE}` });
    expect(online.caches.boxes.get(READER_CACHE)?.has(READER_FILE)).toBe(true);

    // later, with no internet, the same box answers
    const offline = runServiceWorker({ online: false, files: WITH_READER, caches: online.caches });
    expect(await request(offline, READER_FILE)).toMatchObject({ body: `network:${READER_FILE}` });
    expect(offline.fetched).toEqual([]); // the saved copy answered; the internet was never asked
  });

  it("survive an app update: old versions are deleted, the reader's box is kept", async () => {
    const caches = fakeCaches({ [`${CACHE_PREFIX}old`]: {}, [READER_CACHE]: { [READER_FILE]: "x" } });
    const sw = runServiceWorker({ online: true, caches });
    await lifecycle(sw, "activate");
    expect([...caches.boxes.keys()]).toEqual([READER_CACHE]);
  });

  it("are never saved from a failed or partial download", async () => {
    const sw = runServiceWorker({ online: true, files: WITH_READER, readerStatus: 206 });
    await lifecycle(sw, "install");
    await request(sw, READER_FILE);
    expect(sw.caches.boxes.get(READER_CACHE)?.has(READER_FILE) ?? false).toBe(false);
  });
});
