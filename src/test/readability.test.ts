import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the team rule in CLAUDE.md: every source file starts with a plain-language comment that
 * says what the file is for, so a reader who is new to programming can always find their footing.
 * This does not judge how GOOD a comment is (a person reviews that in the pull request); it only
 * stops a brand-new file from arriving with no explanation at all.
 */

/** Every .ts/.tsx file under `dir`, skipping tests and type-declaration files. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [path] : [];
  });
}

/** A file "explains itself" if a block comment or line comment appears near the top. */
const COMMENT_NEAR_TOP = /\/\*[\s\S]*?\*\/|^\s*\/\//m;
const LINES_TO_CHECK = 60;

describe("readable code for the whole team", () => {
  const files = sourceFiles("src");

  it("finds the source files (so this check can never pass by looking at nothing)", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("gives every source file a comment near the top saying what it is for", () => {
    const uncommented = files.filter((file) => {
      const top = readFileSync(file, "utf8").split(/\r?\n/).slice(0, LINES_TO_CHECK).join("\n");
      return !COMMENT_NEAR_TOP.test(top);
    });
    expect(uncommented, `Add a short comment at the top of: ${uncommented.join(", ")}`).toEqual([]);
  });
});
