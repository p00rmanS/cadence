# Audit

Six audits are recorded here. Everything listed was confirmed by reading code, running it, or
writing a test that failed first. Nothing here is generic advice.

- **Part 1**: bugs in the original single-file prototype
  ([`archive/shift-coverage-planner-v1.html`](../archive/shift-coverage-planner-v1.html)).
- **Part 2**: bugs found in *the first rebuild itself*, plus corrections to claims the first
  version of this document made that turned out to be untrue.
- **Part 3**: a further pass after the plain-language redesign (below the verification table).
- **Part 4**: scale, quick fixes and bulk add (after Part 3).
- **Part 5**: a check of the whole app against the updated Cadence Track C project document
  (2026-09-22) — what's actually built vs. what the course deliverables (D1–D6) still need.
- **Part 6**: hardening the n8n publish/interpret workflow templates (2026-09-23) — a real bug
  in the publish contract (no calendar dates were ever sent) found and fixed along the way.

Run `npm test` to re-check all of it (387 tests in 20 suites).

---

## Part 1: the original prototype

| # | Bug | Fix |
| --- | --- | --- |
| 1 | Switching 7am/8am **office hours** changed real hour totals and let the weekly cap be bypassed, because hours were counted only over the visible slots. | Hours always count *every* shift, whatever is visible. View state and schedule data are separate. |
| 2 | **Gap ranges almost never merged.** Gaps were built time-major but merged assuming day-major, so consecutive same-day gaps were never adjacent in the array. | Coverage is built day-major, then merged. |
| 3 | A **required 7am shift** was satisfied by one 30-minute slot. | It must be a real contiguous block (at least 1 hour) starting at 7:00am. |
| 4 | **Auto-fill fragmented shifts** (lone half-hours scattered across the week). | Block-based planner, see Part 2 for measured results. |
| 5 | **One ambiguous coverage %.** | Two labeled numbers: hours with enough people, and staffing filled. |
| 6 | "**Minimum students needed**" ignored availability but looked like a real gap. | Renamed "students needed (best case)" with an inline explanation. |
| 7 | A `role="button"` **nested inside a `<button>`**. | Sibling buttons, never nested. |
| 8 | Screenshot reading worked **only** through one AI integration. | Text is always parsed locally; images need a configured server-side reader. |
| 9 | No persistence. | Versioned, validated `localStorage`, plus backup/restore. |
| 10 | Ambiguous am/pm silently guessed. | Reported for review. |

---

## Part 2: bugs in the first rebuild (found on a second pass)

### Corrections to earlier claims

The first version of this document said things that were not true. Corrected:

- **"Grid cells are keyboard reachable"** was false. Blocked cells used the `disabled`
  attribute, which removes them from keyboard focus, and the grid had about 100 Tab stops.
  Now there is **one** Tab stop; arrow keys, Home/End and PageUp/PageDown move around;
  blocked cells use `aria-disabled` so their reason can still be read.
- **"Verified manually: keyboard-only pass"** had not been done. It is now covered by
  real keyboard tests (`src/test/app.test.tsx`, "the schedule grid with a keyboard").
- **"WCAG AA contrast"** was never measured. Measuring found 4 real failures (below).

### Real bugs, all fixed

| Area | Bug | Consequence | Fix |
| --- | --- | --- | --- |
| Calendar (.ics) | Local times were written with a `Z` (UTC) suffix, and repetition used a `UNTIL` in the wrong timezone. | Every shift would appear at the wrong hour in students' calendars. | Local times with `TZID`, repetition by `COUNT`, first weekday on/after the start date. Tested. |
| Publishing | Mock mode reported **"Synced"**; version was `Date.now()`; no approval step; no rule check. | A fake success state; retries not idempotent. | Mock is an honest "practice run" (`dry_run` → "not synced"); version is a content fingerprint; explicit approval; blocked while rules are broken; responses validated. |
| Accessibility | Contrast failures: light-mode muted text (4.39:1), light-mode green text (4.17:1), two student colors (4.17, 4.44). | Text below WCAG AA. | Tokens and colors adjusted; a test measures every pair in both themes, plus translucent banners. |
| Overrides | Confirming "Assign anyway" for the weekly-hours limit **silently also broke the days-per-week limit**. (Found by a UI test.) | Manager consents to one problem and gets two. | The dialog lists every limit it will break; both show as warnings afterward. |
| Auto-fill | A soft per-day cap left students short of their hours, and the explanation blamed the wrong cause. | Wrong advice ("classes and lunch"). | A relaxed second attempt before giving up, so the explanation is true. |
| Conflicts | Nothing checked the schedule after class times were edited. | A shift could sit on top of a class unnoticed. | `findIssues` re-checks the whole schedule; issues appear in Schedule health, on the grid, and block publishing. |
| Import | Backup files were barely validated. | Malformed data could crash the app or inject content. | Strict validation returns a **sanitized copy**: unknown fields stripped, orphan and duplicate shifts dropped (with a note), colors repaired, sizes capped. |
| Parser | Screenshot-derived `13:00` times could not be read by the app's own parser; a bare `8:00-9:15 PM` was read as 8am to 9:15pm. | Wrong or missing classes. | 24-hour times, `noon`, `a.m.`/`p.m.`; a range is resolved *together* and warns only when more than one sensible reading exists. |
| Parser | Weekend classes, `Mon, Wed`, `M/W/F`, duplicates, room names containing "Am". | Rejected or mis-read lines. | Handled; weekend lines get a clear message. |
| State | Reducers generated IDs with `Date.now()`/random. | Impure reducers; unstable IDs across undo. | Deterministic, content-based IDs. |
| Cutoff | "No limit" was stored as 5pm. | If the office later closes at 6pm it would silently become a real cutoff. | Explicit `NO_CUTOFF`. |
| Opening shift | Tied to the visible open time. | At 8am, the 7am requirement was meaningless. | Fixed `OPENING_SHIFT_START`, independent of the view. |
| Persistence | A failed save (full or blocked storage) was swallowed. | Silent data loss. | A visible banner with a "save a backup" button. |
| Multi-tab | Two tabs overwrite each other; last save wins. | Silent data loss. | Changes from another tab trigger a warning. |
| Privacy | Fonts loaded from Google's servers. | A third-party request (visitors' IP addresses shared with Google) on every page load. | Self-hosted; a test forbids third-party requests. |
| n8n template | The AI placeholder returned a hard-coded `confidence: 0.9`. | Looks like a real read. | Returns an honest "nothing was read" error until a provider is connected. |
| Copy | "1 hours", "Noa K.." (double period), "19 hours of 19 hours". | Sloppy, confusing text. | Fixed at the source; a helper enforces it. |
| Tooling | 5 known vulnerabilities in the dev toolchain. | Dev-server exposure. | Upgraded; `npm audit` reports 0. |

### Auto-fill, measured

On the sample roster (6 students, 19 hours each):

| Measure | Result |
| --- | --- |
| Rules broken | 0 |
| Students at their hours | 6 of 6 |
| Single-slot (30-minute) shifts | **0** |
| Shifts of 2+ hours | over 70% (asserted in tests) |
| Coverage at 1 person | 100% |
| Run time | about 25 ms |
| Deterministic | yes, IDs included; running it twice changes nothing |

With **2 people needed** at once, hours become scarce late in the week and a few short shifts
appear (3 single slots on the sample roster). That is inherent scarcity, not a bug, but it is a
known limit of a greedy planner.

### How this is verified

| Check | Where |
| --- | --- |
| Rules, parsing, scheduling, calendar, publish, validation, undo, summaries, help content | 18 unit suites (about 300 tests) |
| Real user flows with genuine keyboard and mouse events (Testing Library `user-event`) | `src/test/app.test.tsx` |
| WCAG 2 A/AA rules via `axe-core` on every screen and dialog (with a self-test proving the checker catches violations) | `app.test.tsx` |
| Contrast of every text/background pair in both themes, and of chip colors | `contrast.test.ts` |
| No third-party requests, no analytics, no stored screenshots | `privacy.test.ts` |

---

## Part 3: a further pass

| Area | Finding | Fix |
| --- | --- | --- |
| Missing feature | The data type had a `manual` busy source but no way to enter it, so a second job or an appointment could not be represented. | "Any other times they can't work?" field, checked live like class times. Messages say "unavailable", not "has class". Older backups without the field still load. |
| Calendar | Files repeated on holidays and breaks. | "Days off" list; each skipped date becomes an `EXDATE` on only the shifts that fall on that weekday. |
| Layout | At a common laptop size (1100 x 640) the schedule grid got only about **200 px** of height; the header, options row and banner took the rest. | Main action moved into the header, rarely used options folded away except on wide screens, the banner sentence is visually hidden on short windows (still read by screen readers), narrower side columns. Measured: 200 px to 281 px. |
| Layout | The selected student's name was cut to "Tr…"; "Add student" wrapped onto two lines and spilled out of its column; a summary tile broke mid-phrase. | Shorter labels and non-wrapping controls. |
| Reliability | Loading a backup read the **whole file into memory before checking its size**, so a huge file would freeze the page. | Size is checked first. |
| Correctness | Backup and spreadsheet file names used the **UTC** date, so an evening in Hawaii was dated "tomorrow". | Local date. |
| Data loss | If the browser refused to save, closing the tab silently lost the work. | The tab now asks before closing while saving is broken. |
| Feedback | "See who is free" scrolled to a panel that was already on screen, so it looked like nothing happened. | The panel is briefly outlined. |
| Accessibility | The "?" help button sat *inside* a `<label>`, so a screen reader would read its text as part of the field's name. | Moved beside the label. |
| Accessibility | Hiding text with `display: none` on short windows would also hide it from screen readers. | Visually hidden instead. |
| Interaction | Only Shift+click could fill a stretch of boxes. | Mouse drag-to-fill (mouse and pen only; touch still scrolls; Escape cancels; one undo step). |
| Sharing | The grid is poor for telling a student when they work. | "By student" and "By day" views, Copy as text, and Print (forced to black on white, buttons hidden). |

Tests added for all of the above, including genuine mouse-drag events. Drag-to-fill was also
checked with a real mouse drag in a live browser.

---

## Part 4: scale, quick fixes and bulk add

| Area | Finding | Result |
| --- | --- | --- |
| Scale | Auto-fill had only ever run on 6 students, and its search space grows with the roster. | Measured on generated rosters with random classes, lunches, cutoffs and opening shifts, at 2 people needed: **12 students 78 ms, 40 students 193 ms, 80 students 339 ms**. No rule is ever broken and results are identical on a second run. A test fails if it takes more than 4 seconds. |
| Actionability | Schedule health explained *why* a time was empty but left the manager to pick a student and click each box. | "Quick fix" buttons. Each candidate is checked by playing the stretch forward under every rule, so "1 of 2 hours" is true rather than a guess. Computed for the first 10 gaps only, so a huge roster can't slow the panel. |
| Onboarding | Adding 30 students meant opening the form 30 times. | "Add several at once": name and classes per line, or tab-separated spreadsheet rows. Previewed line by line; one Undo step; capped at the 200-student limit with a clear message. |
| Bug caught before shipping | My first roster parser treated any name containing a digit as an error ("Student 2: ..."), and would have accepted a lone class time with no colon as a *name*. | The separator is now the first colon that does not sit between two digits (a time's colon always does). A line that looks like class times but has no name is refused. Both cases have tests. |
| Bug caught before shipping | A regular expression's backslash was silently dropped by a patch script (`/\d/` became `/d/`), which would have searched for the letter "d". | Caught by reading the change diff and by the test suite; fixed. Lesson kept: edit regexes with the file editor, not a shell one-liner. |

Also confirmed with a real mouse click in a live browser: quick-fix buttons work end to end,
and a stray click on a grid box for a student at their weekly limit correctly opens
"Assign anyway?" rather than changing anything.

---

## What is *not* verified (be honest about it)

- **No real screen reader was used.** `axe-core` finds roughly a third to a half of
  accessibility problems; it cannot judge whether the experience *makes sense* when read aloud.
- **Contrast is computed from design tokens**, not measured on rendered pixels.
- **Keyboard activation** (Enter/Space/Shift+Enter) is tested in jsdom with `user-event`. The
  browser-automation tool available here could not produce native button activation, so it
  was not re-checked in a live browser (arrow-key movement was).
- **Phone and tablet layouts** were checked in an emulated viewport, not on physical devices. The laptop layout was measured at 1100 x 640 only.
- **Printing** is set up with print styles and tested only for the button, not on real paper or in a print preview.
- **Days off in calendar files** are covered by tests of the file contents, but the files were not opened in Google, Apple or Outlook Calendar.
- **n8n workflows have never been run** against a live n8n instance. The three files are
  starting-point templates.
- **No usability testing with real first-time users.** The plain-language design follows
  established guidelines and is tested for things like sentence length, but has not been
  tried on actual freshmen. Please do that before relying on it.
- **Single user, single browser.** There are no accounts or shared data.
- **Auto-fill is a heuristic**, not an optimizer. It is explainable and deterministic, but not
  guaranteed to find the best possible schedule.

---

## Part 5: checked against the updated Cadence Track C project document (2026-09-22)

The team's engagement letter and project document (Fall 2026, BYU–Hawaii CRDEV 301R) were read
in full and compared line-by-line against this codebase. This section maps the six key
deliverables (D1–D6) to what is actually built and tested today, and separates "the code exists
and is tested" from "the course requirement is fully met" — those are not the same claim.

| Deliverable | What the project document asks for | Status in this codebase |
| --- | --- | --- |
| D1 — Problem validation and requirements | 8+ interviews, current-process map, 12 test scenarios, requirements list, manual-time baseline. | **Not code.** This is research/interview work for the team (Austin/Jared per the Action Register), not something this repository can produce. Nothing to audit here. |
| D2 — Improved ShiftFit prototype | "One working web demo with five verified functions: availability entry, class-conflict display, staffing-demand setup, shift assignment, and coverage-gap reporting." | **All five exist and are tested.** Availability entry: `StudentFormSheet` + `ImportPanel`, parsed by `src/features/scheduling/parser.ts`. Class-conflict display: striped grid cells in `ScheduleGrid`, driven by `availability.ts`/`issues.ts`. Staffing-demand setup: office hours / people-needed controls in `TopBar`, backed by `ScheduleSettings`. Shift assignment: click/drag/keyboard on `ScheduleGrid`, plus deterministic auto-fill (`scheduler.ts`). Coverage-gap reporting: `InsightsPanel`, backed by `coverage.ts`. 387 automated tests pass, the production build is clean, and `tsc --noEmit` reports no type errors as of this audit. |
| D3 — AI-assisted schedule intake proof of concept | Structured extraction from **pasted text and selected schedule images**, human review, ≥90% required-field accuracy, tested on 12 controlled scenarios. | **Text half: done and always on.** `parseClassText` (`parser.ts`) deterministically parses pasted/typed text with no network call; it is exercised by `src/test/parser.test.ts` and shown for review in `MeetingReview` before anything saves. **Image half: wired but not functional yet.** `ImportPanel`, `schedule-extractor.ts` and `schemas.ts` implement the full upload → validate → review flow, but they only *work* once `VITE_AUTOMATION_API_URL` points at a real server with a real AI/vision provider behind it (see D4 below) — that server does not exist yet, so today the screenshot button either shows "Reading screenshots isn't set up here" or is not offered at all. The "12 controlled scenarios / 90% accuracy" measurement itself is a testing-phase task (Week 9 in the Action Register), not something the app can self-report yet. |
| D4 — Calendar publishing automation | One n8n workflow tested on 20+ approved events, ≥95% correct date/time/recurrence/timezone fields, no duplicates. | **Client side done and tested; server side not yet run.** `src/services/automation/{contracts,n8nClient,mockAutomationClient}.ts` implement the request/response contract, idempotent shift ids (so re-publishing updates instead of duplicating), and full validation of whatever comes back. Three n8n workflow templates exist in `n8n/` and are described in `docs/N8N_ARCHITECTURE.md`. None of this has been run against a live n8n instance or a real Google Calendar (also listed under "What is not verified" above) — that is genuinely open work, tracked in `docs/ROADMAP.md` under v3. |
| D5 — Testing and evaluation report | 12 scenario tests, 8+ user sessions, accuracy/time/usability/defect data. | **Not code.** This is the team's testing-phase deliverable. The app's own 387 automated tests are a different, narrower thing (they check the code does what it claims, not that real users succeed with it) — see "What is not verified" above, which already says so plainly. |
| D6 — Final project package | Final demo, user guide, technical setup notes, recommendation, report, presentation. | Partially supported: the README doubles as technical setup notes, and Help/FAQ (`src/content/help.ts`) is a start on a user guide, but neither has been written *as* the formal Track C deliverable yet. |

**Net finding:** the two things standing between this codebase and the D3/D4 targets are the
same thing — a live n8n instance wired to a real AI/vision provider and a Google Calendar API
registration. Nothing in the frontend is blocking that; the contract, validation, and UI are
already built and tested against a mocked version of that server. This matches the open
questions already listed at the bottom of `docs/ROADMAP.md` ("who owns hosting and the n8n
instance," "does OIT allow a Google Calendar app registration").

No regressions were introduced by this pass: `npm run lint` (`tsc --noEmit`), `npm test`
(387/387), and `npm run build` were all re-run clean after this audit and after the readability
pass below.

---

## Part 6: n8n publish workflow hardening (2026-09-23)

Found while building out the n8n automation further (James is now owning n8n hosting/credentials
directly; this pass focused on making the client-side contract and templates as complete as
possible ahead of that).

| Area | Bug | Consequence | Fix |
| --- | --- | --- | --- |
| Calendar publishing | The publish request (`buildPublishRequest` in `contracts.ts`) only ever sent a weekday + minutes-of-day (`day: "mon", start: 480`), never a real date or timezone. The n8n publish template's Google Calendar node referenced `$json.startIso`/`$json.endIso`, fields nothing ever set. | The "Send to Google Calendar" flow could never have worked, even with real n8n/Google credentials wired up — there was no calendar date to send. | `buildPublishRequest` now takes the manager's saved `SemesterConfig` and computes a real `recurrence` block per event (first occurrence date, timezone, `RRULE`, `EXDATE`s), reusing the same, already-tested date math as the `.ics` export (`countWeeklyOccurrences`/`excludedOccurrences` in `features/calendar/ics.ts`) so the two outputs can't disagree. Covered by three new tests in `src/test/automation.test.ts`. |
| Calendar publishing | The "Send to Google Calendar" section had no gate on semester dates being configured — unlike the per-student `.ics` downloads right above it in the same dialog, which were already locked until dates were saved. | A manager could press "Approve and send" (or "Do a practice run") with no dates saved, and — once real credentials existed — send/attempt to send dateless events. | The button is now locked behind the same `calendarReady` check the calendar-file section already used, with the same wording pattern ("Save the semester dates and timezone above first"). Verified in a live browser and covered by an updated test in `src/test/app.test.tsx`. |
| n8n template (publish) | "Revalidate schedule version", "Diff vs. previously synced events" and "Persist sync state" were empty `return items;` stubs — the idempotency strategy the architecture doc promises (`docs/N8N_ARCHITECTURE.md`) was undocumented-as-not-built. | Retrying a publish, or publishing twice, would very likely have created duplicate Google Calendar events once someone filled in a Calendar node. | Implemented real logic: request-shape validation, a shiftId→googleEventId diff and persistence using n8n's own workflow static data (no external database needed for a pilot), and a Google Calendar node wired to the new `recurrence` fields and the diff's `existingEventId`. Still **not run against a live n8n** — see the `notes` on each node for what to verify once real credentials exist. |
| n8n template (interpret) | "Validate and build response" had a `// TODO: validate ai against the schema` comment but no actual validation — any shape an AI provider returned would be passed straight to the frontend. | A misbehaving or compromised AI provider response could reach the UI unvalidated (the frontend's own `schemas.ts` check is the only remaining backstop). | Implemented the same field-by-field validation as `validateExtractedSchedule` in `src/features/import/schemas.ts` directly in the n8n Code node (day enum, minute bounds, confidence range, clamped warning/unresolved lists, malformed individual meetings dropped rather than failing the whole response). Verified by running the extracted JS against four cases (no provider, valid response, non-object response, out-of-range confidence). |

All three `n8n/*.json` files remain starting-point templates — the new logic was verified by
extracting each Code node's JavaScript and running it directly under Node with representative
inputs (see the commands used, not kept in the repo), not by executing the workflow in a real
n8n instance. `npm test` (389/389), `npm run lint` and `npm run build` were re-run clean after
this pass, and the "Send to Google Calendar" flow (including the new date gate) was re-verified
in a live browser.

---

## Readability pass (2026-09-22)

Every file under `src/` now has a plain-language comment explaining what it's for and, in the
more complex files (`scheduler.ts`, `useShiftFitStore.ts`, `ScheduleGrid.tsx`, and the rest of
`src/features/scheduling/`), how it works — aimed at a reader with no prior backend/frontend
experience. This was a comments-only pass: no logic changed, and the full test suite, typecheck
and production build were re-verified clean before and after.
