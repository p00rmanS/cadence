import plugin from "tailwindcss/plugin";
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
  plugins: [
    // `wide:` and `xwide:` work like Tailwind's `lg:` and `xl:`, but the window size is measured
    // as if the text were Medium (see `useLayoutQuery` in src/hooks/useMediaQuery.ts, which writes
    // the page's `data-layout` marker). So bigger text switches to the roomy one-column layout sooner.
    plugin(({ addVariant }) => {
      addVariant("wide", ['html[data-layout="wide"] &', 'html[data-layout="xwide"] &']);
      addVariant("xwide", 'html[data-layout="xwide"] &');
    }),
  ],
} satisfies Config;
