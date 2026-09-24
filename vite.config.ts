/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Respects an assigned PORT (e.g. from .claude/launch.json's autoPort) so this dev server
    // never fights another one for a fixed port; falls back to Vite's usual 5173 otherwise.
    port: Number(process.env.PORT) || 5173,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
