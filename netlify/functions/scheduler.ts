import { handleRequest } from "../../src/server/handler";

/**
 * ============================================================================
 *  NETLIFY WRAPPER FOR THE SCHEDULER SERVICE (src/server/handler.ts)
 * ============================================================================
 * Answers /api/scheduler/health, /api/scheduler/evaluate and /api/scheduler/generate with the same
 * rule code the app uses. It is meant to be called by n8n (Workflow B, `n8n/shiftfit-generate.json`),
 * not by browsers.
 *
 * Switched off ("503 not set up") until the environment variable SCHEDULER_SECRET (16+ random
 * characters) is set in Netlify. n8n sends the same value as `Authorization: Bearer <secret>`.
 */

/** Called by Netlify for each request to /api/scheduler/... */
export default async function scheduler(request: Request): Promise<Response> {
  return handleRequest(request, { secret: process.env.SCHEDULER_SECRET });
}

/** The web addresses this function answers (Netlify reads this; "*" means anything after /api/scheduler/). */
export const config = {
  path: "/api/scheduler/*",
};
