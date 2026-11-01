import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { App } from "./App";
import { parseShareRoute } from "./shareRoute";
import { ShiftViewPage } from "../components/share/ShiftViewPage";
import { StudentIntakePage } from "../components/share/StudentIntakePage";
import { useDisplayPrefs } from "../hooks/useDisplayPrefs";
import { useTheme } from "../hooks/useTheme";

/**
 * ============================================================================
 *  THE VERY TOP OF THE WEBSITE: WHICH SCREEN DOES THIS ADDRESS OPEN?
 * ============================================================================
 * Most of the time this just shows the manager's app (`App`). But the address can carry a link
 * (`app/shareRoute.ts`): a student's "send your details" page, a student's own "Your shifts" page, or a
 * student's details sent to a manager. The student pages are separate from the manager's app on purpose: they
 * never read or touch the manager's saved schedule, so a student opening a link cannot see anything.
 */

/** The address's "#..." part, kept up to date when it changes (a link clicked while the site is open). */
function useHash(): string {
  return useSyncExternalStore(
    (listen) => {
      window.addEventListener("hashchange", listen);
      return () => window.removeEventListener("hashchange", listen);
    },
    () => window.location.hash,
    () => "",
  );
}

/** Applies the person's saved look (text size, colors, motion) to a student page, the same way the manager's app does. */
function StudentPageLook({ children }: { children: React.ReactNode }) {
  useTheme();
  useDisplayPrefs();
  return <>{children}</>;
}

export function Root() {
  const route = parseShareRoute(useHash());
  // A student's details opened by a manager: kept until the app has opened its "Student links" window, then forgotten.
  const [incoming, setIncoming] = useState<string | null>(null);

  useEffect(() => {
    if (route?.kind !== "add") return;
    setIncoming(route.code);
    // Take the (long) link out of the address bar so a refresh or a screenshot doesn't carry the student's details around.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [route?.kind, route?.kind === "add" ? route.code : null]);

  const handled = useCallback(() => setIncoming(null), []);

  if (route?.kind === "send") {
    return (
      <StudentPageLook>
        <StudentIntakePage />
      </StudentPageLook>
    );
  }
  if (route?.kind === "shifts") {
    return (
      <StudentPageLook>
        <ShiftViewPage code={route.code} />
      </StudentPageLook>
    );
  }
  return <App incomingStudentLink={incoming} onIncomingStudentLinkHandled={handled} />;
}
