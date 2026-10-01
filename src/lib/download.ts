/**
 * ============================================================================
 *  DOWNLOADING FILES (backups, calendar files, spreadsheets)
 * ============================================================================
 * The browser can't write straight to the computer's disk, so to "save" a file we wrap the text
 * in a Blob (an in-memory file), make a temporary link to it, click that link in code, and then
 * throw the link away. Nothing is uploaded anywhere.
 */

/** Saves text as a file the user downloads. Nothing leaves the browser. */
export function downloadTextFile(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Today's date as YYYY-MM-DD in the user's own timezone (not UTC, which is "tomorrow" on Hawaiian evenings). */
export function todayStamp(now: Date = new Date()): string {
  // Two digits for months and days, e.g. 7 -> "07".
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
