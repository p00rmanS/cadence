/**
 * Generates a unique id like "student-3f9a1c2e...". Used anywhere the app needs
 * a fresh, never-repeats identifier (a new student, a new request to a server).
 * Not used for shift ids — those are built from content instead, so the same
 * schedule always produces the same ids (see `scheduler.ts`'s `shiftId`).
 */
export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
