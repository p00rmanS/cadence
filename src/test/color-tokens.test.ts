/**
 * ============================================================================
 *  TEST: EVERY BACKGROUND COLOR NAME USED IN THE SCREENS REALLY EXISTS
 * ============================================================================
 * Tailwind quietly ignores a color name it does not know. Writing `bg-surface` when no color called
 * "surface" exists produces NO background at all, so a box silently turns browser-default white. In dark
 * mode that made the "How many students" box in Save & share white with near-white text (contrast 1.19:1,
 * unreadable). This test reads every `bg-<name>` in the screens and checks that `<name>` is one of the
 * colors defined in `tailwind.config.ts` (or a normal built-in Tailwind color), so a typo fails here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every file under `folder` that ends in .tsx (the screens and their parts). */
function screenFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) return screenFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/** The color names the project defines, read from the `colors: { ... }` block of the Tailwind config. */
function definedColors(): Set<string> {
  const config = readFileSync("tailwind.config.ts", "utf8");
  const block = config.slice(config.indexOf("colors: {"), config.indexOf("fontFamily"));
  const names = [...block.matchAll(/^\s*"?([a-z-]+)"?:\s*"rgb/gm)].map((match) => match[1]);
  return new Set(names);
}

/** Built-in Tailwind background names that are not project colors (e.g. bg-transparent, bg-red-500, bg-gradient-to-r). */
const BUILT_IN = /^(transparent|current|inherit|white|black|none|fixed|local|scroll|cover|contain|center|auto|no-repeat|repeat|clip-.*|origin-.*|blend-.*|gradient-.*|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+)$/;

describe("Tailwind color names", () => {
  it("finds the project colors in the config (guards this test itself)", () => {
    expect(definedColors().has("bg")).toBe(true);
    expect(definedColors().has("panel")).toBe(true);
  });

  it("every bg-<name> class in src/ names a color that exists", () => {
    const known = definedColors();
    const unknown: string[] = [];
    for (const file of screenFiles("src")) {
      const text = readFileSync(file, "utf8");
      // Matches `bg-name` and `dark:bg-name/50`; skips `bg-[...]` (custom values) and `bg-var(...)`.
      for (const match of text.matchAll(/(?<![\w-])bg-([a-z][a-z0-9-]*)(?:\/\d+)?/g)) {
        const name = match[1];
        if (!known.has(name) && !BUILT_IN.test(name)) unknown.push(`${file}: bg-${name}`);
      }
    }
    expect(unknown).toEqual([]);
  });
});
