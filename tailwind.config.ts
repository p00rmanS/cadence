import type { Config } from "tailwindcss";

/**
 * Settings for Tailwind, the styling tool behind class names like "rounded-xl" or "bg-panel".
 * `content` lists the files it scans for class names; `colors` maps names like "accent" to the
 * color variables in src/styles/app.css, which switch between the light and dark themes.
 */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-ink": "rgb(var(--accent-ink) / <alpha-value>)",
        ok: "rgb(var(--ok) / <alpha-value>)",
        "ok-bg": "rgb(var(--ok-bg) / <alpha-value>)",
        gap: "rgb(var(--gap) / <alpha-value>)",
        "gap-bg": "rgb(var(--gap-bg) / <alpha-value>)",
        busy: "rgb(var(--busy) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        "warn-bg": "rgb(var(--warn-bg) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        body: ["Atkinson Hyperlegible", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
} satisfies Config;
