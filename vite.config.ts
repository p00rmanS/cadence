/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
// The ".ts" ending is required here: Vite loads this settings file with Node's own module rules, which need it.
import { addCspToHtml } from "./src/lib/contentSecurityPolicy.ts";

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
    transformIndexHtml: (html) => addCspToHtml(html, process.env.VITE_AUTOMATION_API_URL),
  };
}

export default defineConfig({
  // The address folder the site lives in. On GitHub Pages a project site lives at
  // https://<owner>.github.io/<repository>/, so the deploy workflow sets BASE_PATH=/<repository>/.
  // Everywhere else (Netlify, the dev server) it is the site root, "/".
  base: process.env.BASE_PATH || "/",
  plugins: [react(), contentSecurityPolicyTag()],
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
