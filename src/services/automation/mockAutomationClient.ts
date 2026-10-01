import type { AutomationClient, PublishRequest, PublishResponse, RemoveResponse } from "./contracts";

/**
 * Local stand-in for the ShiftFit server so the app stays demoable without one.
 * It never claims a real Google Calendar sync happened: every result is "dry_run",
 * which `summarizePublish` maps to "not synced" so the UI cannot show a fake success.
 */
export function createMockAutomationClient(): AutomationClient {
  return {
    kind: "mock",
    async publishSchedule(_schedule, request: PublishRequest): Promise<PublishResponse> {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        scheduleVersion: request.scheduleVersion,
        results: request.events.map((e) => ({ shiftId: e.shiftId, status: "dry_run" as const })),
      };
    },
    // A practice run never deletes anything either; it only reports what it would have done.
    async removeEvents(shiftIds: string[]): Promise<RemoveResponse> {
      return { results: shiftIds.map((shiftId) => ({ shiftId, status: "dry_run" as const })) };
    },
  };
}
