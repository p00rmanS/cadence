/**
 * ============================================================================
 *  SHARED SAFETY HELPERS FOR THE SERVER FILES
 * ============================================================================
 * Small building blocks used by both server files (`handler.ts`, the scheduler service, and
 * `gateway.ts`, the one the website talks to), so each safety rule is written once:
 *  - answers are JSON, marked "do not cache" (they may describe students) and locked down so a browser never runs them,
 *  - errors are short and never repeat what the caller sent,
 *  - passwords are compared in constant time,
 *  - request bodies over a size limit are refused before being read into memory,
 *  - failed passcode guesses are counted, so guessing is slowed right down.
 */

/** Sends a JSON answer that browsers and proxies must not keep a copy of (it may describe students). */
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      // An answer is data, never a page: if one is ever opened in a browser, it may not run or load anything.
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
    },
  });
}

/** Short, generic error. Never includes anything the caller sent. */
export function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}): Response {
  return json(status, { error: code, message, ...extra });
}

/**
 * Compares two strings in the same amount of time no matter where they first differ, so an attacker
 * cannot guess the secret one character at a time by measuring how fast the answer comes back.
 */
export function sameSecret(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}

/** True when the request carries the right `Authorization: Bearer ...` header. */
export function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  // "Bearer " followed by at least one character, captured as the password.
  const match = /^Bearer (.+)$/.exec(header);
  return match !== null && sameSecret(match[1], secret);
}

/** Reads the body as text, refusing anything larger than `maxBytes` (checked twice: the header, then the real size). */
export async function readBody(request: Request, maxBytes: number): Promise<{ ok: true; text: string } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, response: fail(413, "too_large", "That request is too large.") };
  const text = await request.text();
  // Characters are not bytes, but a character is at least one byte, so this never lets an oversized body through.
  if (text.length > maxBytes) return { ok: false, response: fail(413, "too_large", "That request is too large.") };
  return { ok: true, text };
}

/** Reads the body as raw bytes (for uploaded pictures), with the same two size checks as `readBody`. */
export async function readBytes(request: Request, maxBytes: number): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, response: fail(413, "too_large", "That request is too large.") };
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) return { ok: false, response: fail(413, "too_large", "That request is too large.") };
  return { ok: true, bytes };
}

/**
 * The caller's internet address, used only to count wrong passcode guesses. Netlify puts the real
 * address in `x-nf-client-connection-ip`; other hosts use the first entry of `x-forwarded-for`.
 */
export function clientAddress(request: Request): string {
  const netlify = request.headers.get("x-nf-client-connection-ip");
  if (netlify) return netlify;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

/** How many wrong passcodes one address may send before it has to wait. */
export const MAX_FAILED_ATTEMPTS = 10;
/** How long those wrong tries are remembered: 15 minutes, in milliseconds. */
export const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Counts wrong passcode guesses per address. After MAX_FAILED_ATTEMPTS in FAILED_ATTEMPT_WINDOW_MS the
 * address is refused (even with the right passcode) until the window passes, which makes guessing a
 * passcode by trying many of them far too slow to work.
 *
 * Honest limit: the count lives in this server's memory. A hosting service may run several copies of
 * the server or restart it, and each copy counts separately. It still slows guessing by a huge amount,
 * and a long passcode (the gateway requires at least 12 characters) does the rest.
 */
export class FailedAttemptLimiter {
  private attempts = new Map<string, { count: number; firstAt: number }>();

  /** `now` is replaceable only so tests can move the clock forward. */
  constructor(private now: () => number = Date.now) {}

  /** True while this address has used up its wrong tries for the current window. */
  isBlocked(address: string): boolean {
    const entry = this.current(address);
    return entry !== undefined && entry.count >= MAX_FAILED_ATTEMPTS;
  }

  /** Records one wrong passcode from this address. */
  recordFailure(address: string): void {
    const entry = this.current(address);
    if (entry) entry.count += 1;
    else this.attempts.set(address, { count: 1, firstAt: this.now() });
    // Keep memory small: if very many addresses are tracked, forget the ones whose window is over.
    if (this.attempts.size > 10_000) this.forgetExpired();
  }

  /** This address's entry, or undefined if it has none or its window is over. */
  private current(address: string): { count: number; firstAt: number } | undefined {
    const entry = this.attempts.get(address);
    if (entry && this.now() - entry.firstAt > FAILED_ATTEMPT_WINDOW_MS) {
      this.attempts.delete(address);
      return undefined;
    }
    return entry;
  }

  /** Removes every entry whose 15-minute window has ended. */
  private forgetExpired(): void {
    for (const [address, entry] of this.attempts) {
      if (this.now() - entry.firstAt > FAILED_ATTEMPT_WINDOW_MS) this.attempts.delete(address);
    }
  }
}
