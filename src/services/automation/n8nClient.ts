import { createMockAutomationClient } from "./mockAutomationClient";
import { validatePublishResponse } from "./contracts";
import type { AutomationClient, PublishRequest, PublishResponse } from "./contracts";

/**
 * ============================================================================
 *  THE REAL n8n CLIENT (used only once VITE_AUTOMATION_API_URL is set)
 * ============================================================================
 * `getAutomationClient()` at the bottom of this file is what the rest of the
 * app actually calls. It picks between this real client (talks to a live n8n
 * server over the network) and `mockAutomationClient.ts` (a "practice run"
 * that pretends nothing is connected) based on one environment variable. See
 * `.env.example` and the README's "n8n (optional)" section for how to turn
 * this on.
 */

const TIMEOUT_MS = 30_000;

/**
 * Calls the n8n publish webhook (docs/N8N_ARCHITECTURE.md, Workflow C) at the base URL
 * in VITE_AUTOMATION_API_URL. No credentials live here — webhook auth belongs on the
 * server side. The response is validated before use; anything malformed, slow or
 * non-2xx becomes an error the UI shows instead of a silent success.
 */
function createN8nClient(baseUrl: string): AutomationClient {
  return {
    kind: "n8n",
    async publishSchedule(request: PublishRequest): Promise<PublishResponse> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/webhook/shiftfit/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          credentials: "omit",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`The publish service answered with an error (${res.status}).`);
        const validated = validatePublishResponse(await res.json(), request);
        if (!validated.ok) throw new Error(validated.error);
        return validated.value;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new Error("The publish service took too long to answer.");
        }
        throw err instanceof Error ? err : new Error("Could not reach the publish service.");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function getAutomationClient(): AutomationClient {
  const url = import.meta.env.VITE_AUTOMATION_API_URL;
  return url ? createN8nClient(url) : createMockAutomationClient();
}
