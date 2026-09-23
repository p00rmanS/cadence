import { MAX_STUDENTS } from "./constants";
import { buildBusy, parseMeetingLine } from "./parser";

/**
 * ============================================================================
 *  "ADD SEVERAL STUDENTS AT ONCE" PARSER
 * ============================================================================
 * Powers the bulk-add dialog: reads one pasted block of text, one student per
 * line, and turns it into a preview list the manager can check before adding
 * anyone. Reuses `parser.ts` for the class-time part of each line — this file
 * is only responsible for splitting "Name: class times" (or a spreadsheet
 * row) into its two pieces and catching per-line problems.
 */

export type RosterRow = {
  /** 1-based line number in what was pasted, so a problem can be pointed at. */
  line: number;
  name: string;
  classText: string;
  /** How many separate class meetings were understood (a "MWF" class counts as 3). */
  meetings: number;
  errors: string[];
  warnings: string[];
  ok: boolean;
};

export type RosterParse = {
  rows: RosterRow[];
  valid: RosterRow[];
  /** Problems with the paste as a whole, such as too many students. */
  overall: string[];
};

const MAX_NAME = 80;

/** Splits one line into a name and its class-time text, or explains why it can't. */
function splitLine(raw: string): { name: string; classText: string } | { error: string } {
  // A spreadsheet paste separates cells with tabs: the first cell is the name, the rest are classes.
  if (raw.includes("\t")) {
    const [first, ...rest] = raw.split("\t");
    return { name: first.trim(), classText: rest.map((c) => c.trim()).filter(Boolean).join("; ") };
  }
  const example = "Put the name first, then a colon, then the class times. Example: Noa K.: MWF 9:00-9:50";
  // Otherwise "Name: classes". A colon inside a time (9:00) always has a digit on BOTH sides, so the
  // separator is the first colon that doesn't. That also lets a name contain digits ("Student 2: ...").
  const colon = raw.search(/(?<!\d):|:(?!\d)/);
  if (colon === -1) {
    // No separator: it is either just a name ("Noa K.") or class times with the name forgotten.
    const looksLikeTimes = parseMeetingLine(raw).ok || /\d{1,2}\s*:\s*\d{2}/.test(raw);
    return looksLikeTimes ? { error: example } : { name: raw.trim(), classText: "" };
  }
  return { name: raw.slice(0, colon).trim(), classText: raw.slice(colon + 1).trim() };
}

/**
 * Reads a pasted list of students, one per line, so a whole roster can be added at once.
 * Accepts "Name: MWF 9:00-9:50; TTh 1:00pm-2:15pm" and tab-separated spreadsheet rows.
 * Nothing is guessed: a line that can't be read is reported with its line number.
 */
export function parseRoster(text: string, existingCount = 0): RosterParse {
  const rows: RosterRow[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const line = i + 1;

    if (trimmed.length > 1000) {
      rows.push({ line, name: trimmed.slice(0, 30) + "…", classText: "", meetings: 0, errors: ["This line is too long."], warnings: [], ok: false });
      return;
    }

    const split = splitLine(raw);
    if ("error" in split) {
      rows.push({ line, name: trimmed.slice(0, 40), classText: "", meetings: 0, errors: [split.error], warnings: [], ok: false });
      return;
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!split.name) errors.push("There is no name at the start of this line.");
    if (split.name.length > MAX_NAME) errors.push(`The name is longer than ${MAX_NAME} characters.`);

    const { classes } = buildBusy(split.classText, "");
    errors.push(...classes.errors);
    warnings.push(...classes.warnings);
    if (!split.classText) warnings.push("No class times listed, so nothing will keep them out of any hour.");

    rows.push({
      line,
      name: split.name,
      classText: split.classText,
      meetings: classes.busy.length,
      errors,
      warnings,
      ok: errors.length === 0,
    });
  });

  // The same name twice is allowed (two people can share one), but worth a heads-up.
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const row of rows) {
    if ((seen.get(row.name.trim().toLowerCase()) ?? 0) > 1) row.warnings.push("This name appears more than once.");
  }

  const valid = rows.filter((r) => r.ok);
  const overall: string[] = [];
  if (existingCount + valid.length > MAX_STUDENTS) {
    overall.push(`That would be more than ${MAX_STUDENTS} students in total. Add fewer at a time.`);
  }
  return { rows, valid, overall };
}
