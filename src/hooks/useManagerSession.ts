import { useSyncExternalStore } from "react";
import { isManagerSignedIn, subscribeToManagerSession } from "../services/automation/managerSession";

/**
 * Tells a screen whether a manager is signed in on this tab, and re-draws it the moment that changes
 * (for example, the sign-in box disappears everywhere right after signing in). The sign-in itself
 * lives in `services/automation/managerSession.ts`; this only connects it to React.
 */
export function useManagerSession(): boolean {
  return useSyncExternalStore(subscribeToManagerSession, isManagerSignedIn, isManagerSignedIn);
}
