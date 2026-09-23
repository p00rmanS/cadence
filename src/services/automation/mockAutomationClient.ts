import type { AutomationClient, PublishRequest, PublishResponse } from "./contracts";

/**
 * Local stand-in for the n8n publish webhook so the app stays demoable without n8n.
 * It never claims a real Google Calendar sync happened: every result is "dry_run",
 * which `summarizePublish` maps to "not synced" so the UI cannot show a fake success.
 */
export function createMockAutomationClient(): AutomationClient {
  return {
    kind: "mock",
    async publishSchedule(request: PublishRequest): Promise<PublishResponse> {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        scheduleVersion: request.scheduleVersion,
        results: request.events.map((e) => ({ shiftId: e.shiftId, status: "dry_run" as const })),
      };
    },
  };
}
