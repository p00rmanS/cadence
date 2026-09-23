import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "test" ? [] : sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

describe("privacy: the app makes no third-party requests on its own", () => {
  it("index.html loads nothing from another site", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).not.toMatch(/(src|href)\s*=\s*"https?:\/\//i);
  });

  it("fonts are bundled, not fetched from Google", () => {
    const main = readFileSync("src/main.tsx", "utf8");
    expect(main).toContain("@fontsource/");
    for (const file of sourceFiles("src")) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
  });

  it("the only network calls go to the optional, configured automation URL", () => {
    const calls = sourceFiles("src").flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/\bfetch\(([^)]*)/g)].map((m) => `${file}: ${m[1]}`),
    );
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call, call).toMatch(/endpoint|baseUrl/);
  });

  it("no analytics or tracking libraries are present", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ");
    expect(deps).not.toMatch(/analytics|sentry|segment|mixpanel|hotjar|gtag|amplitude|posthog/i);
  });

  it("never stores screenshots: images are only ever held in memory", () => {
    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/localStorage\.setItem\([^)]*(image|screenshot)/i);
    }
  });
});
