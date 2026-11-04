/**
 * ============================================================================
 *  WHICH SCREEN A LINK OPENS
 * ============================================================================
 * Syncro is one website. The part of the address after "#" says which screen to show:
 *   #/send            the student's page: "Send your details to your manager"
 *   #/shifts/<code>   a student's own shifts, from a link their manager gave them
 *   #/add/<code>      a student's details, from a link the student sent their manager
 *   (nothing)         the normal manager app
 * This file only reads that address. What the codes contain, and how they are checked, is in
 * `features/sharing/links.ts`.
 */

export type ShareRoute = { kind: "send" } | { kind: "shifts"; code: string } | { kind: "add"; code: string };

/** The screen a "#..." address asks for, or null for the normal app (including any address it does not recognise). */
export function parseShareRoute(hash: string): ShareRoute | null {
  const send = /^#\/send\/?$/.exec(hash);
  if (send) return { kind: "send" };
  const withCode = /^#\/(shifts|add)\/([A-Za-z0-9_-]+)$/.exec(hash);
  if (withCode) return { kind: withCode[1] as "shifts" | "add", code: withCode[2] };
  return null;
}
