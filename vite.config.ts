/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
// The ".ts" endings are required here: Vite loads this settings file with Node's own module rules, which need them.
import { addCspToHtml } from "./src/lib/contentSecurityPolicy.ts";
import { buildServiceWorker } from "./src/pwa/serviceWorker.ts";

/**
 * Settings for Vite, the tool that runs the dev server (`npm run dev`) and builds the website
 * (`npm run build`), and for Vitest, the test runner (`npm test`), which reads the `test` part.
 */

/**
 * Adds the security policy <meta> tag to the BUILT page only (`apply: "build"`), for hosts like
 * GitHub Pages that can't send it as a header. See `src/lib/contentSecurityPolicy.ts` for why.
 */
function contentSecurityPolicyTag(): Plugin {
  return {
    name: "shiftfit-content-security-policy",
    apply: "build",
    transformIndexHtml: (html) => addCspToHtml(html),
  };
}

/** Every file inside `folder` (and its sub-folders), as paths relative to it with "/" between parts. */
function listFiles(folder: string, root = folder): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? listFiles(path, root) : [relative(root, path).split(sep).join("/")];
  });
}

/**
 * After a build, writes the offline helper `sw.js` into the output folder with the exact list of
 * built files (see `src/pwa/serviceWorker.ts`). Its version code is a fingerprint of every file's
 * content, so any change to the site gives it a new version and phones pick up the update.
 */
function offlineHelper(): Plugin {
  let outDir = "dist";
  return {
    name: "shiftfit-offline-helper",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .filter((file) => file !== "sw.js" && !file.endsWith(".map"))
        .sort();
      const hash = createHash("sha256");
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)));
      writeFileSync(join(outDir, "sw.js"), buildServiceWorker(files, hash.digest("hex").slice(0, 12)));
    },
  };
}

export default defineConfig({
  // The address folder the site lives in. On GitHub Pages a project site lives at
  // https://<owner>.github.io/<repository>/, so the deploy workflow sets BASE_PATH=/<repository>/.
  // Everywhere else (Netlify, the dev server) it is the site root, "/".
  base: process.env.BASE_PATH || "/",
  plugins: [react(), contentSecurityPolicyTag(), offlineHelper()],
  server: {
    // Respects an assigned PORT (e.g. from .claude/launch.json's autoPort) so this dev server
    // never fights another one for a fixed port; falls back to Vite's usual 5173 otherwise.
    port: Number(process.env.PORT) || 5173,
  },
  test: {
    // jsdom is a pretend browser, so screen tests can run in the terminal without opening one.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
