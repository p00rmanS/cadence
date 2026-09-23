# Claude Code Master Prompt — ShiftFit Audit, Refactor, Bug Fixes, and UI/UX Redesign

You are acting as a senior staff frontend engineer, product designer, accessibility specialist, QA engineer, and scheduling-algorithm reviewer.

You are working inside an existing repository called **ShiftFit / Shift Coverage Planner**. The current product is a working prototype for scheduling BYU–Hawaii student workers around class times and work constraints. It currently lives mostly in a single `index.html` file with inline CSS and JavaScript.

## Mission

Do **not** merely review the code and give me suggestions. Inspect the repository, audit the current behavior, preserve the useful features, fix real bugs, refactor the architecture, redesign the interface, add tests, and leave the project in a polished state that can be run locally and deployed.

The final product should feel like a real modern scheduling SaaS product, not a class project and not a generic AI-generated dashboard.

## First: inspect before changing anything

1. Read `README.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `index.html`, `.gitignore`, and the rest of the repository.
2. Understand every existing feature and scheduling rule before rewriting it.
3. Check git status and preserve the current working prototype. If appropriate, create a safe backup branch or commit before a large refactor, but do not destroy working history.
4. Run the existing app and manually inspect the UI at desktop, tablet, and mobile widths.
5. Audit logic, accessibility, responsiveness, browser behavior, performance, security/privacy, and maintainability.
6. Create a short `docs/AUDIT.md` describing confirmed issues, why they matter, and what was changed. Do not fill it with generic advice.

## Confirmed issues to investigate and fix

Treat these as starting points, not the complete audit.

### Scheduling/data bugs

- The current state is only in memory, so refresh loses work. Add persistence.
- Open-hours selection is mixed with hour calculations. A shift that exists at 7:00 can become hidden when the UI switches to an 8:00 opening, which can cause the visible hour total and the real assigned hour total to disagree. Separate **schedule data** from **view/filter state**.
- Gap ranges are currently grouped while gaps are still ordered by time then day. Sort by day/time before merging, or replace the algorithm with a correct grouping function. Consecutive uncovered slots on the same day should become one readable range.
- A required “7am shift” can currently be satisfied by a single 30-minute assignment. Model an actual shift/start requirement rather than treating one slot as a complete shift.
- Auto-fill schedules individual 30-minute cells and can create fragmented or unrealistic shifts. Prefer contiguous work blocks, penalize isolated cells and unnecessary split shifts, and keep the algorithm deterministic and explainable.
- The 19-hour cap must be enforced against all assignments in the schedule, not only assignments currently visible in the grid.
- Coverage percentage should have an unambiguous definition. If minimum staffing is 2, distinguish “fully staffed slots” from “staffing demand fulfilled.” Do not display a misleading percentage.
- The “minimum students needed” value is a theoretical labor-hour minimum and ignores availability/constraints. Label it accurately or calculate a more useful metric.
- Rules such as weekly target, opening time, closing time, slot length, and staffing minimum should not be scattered magic numbers.
- Avoid silently creating assignments that violate class blocks, cutoff time, lunch, maximum work days, or target hours.
- Add conflict detection and clear human-readable explanations when auto-fill cannot satisfy all requirements.

### Parser/import issues

- Keep deterministic parsing for common patterns including `MWF`, `MW`, `TTh`, `TR`, `Th`, `Tuesday/Thursday`, and Workday-like rows.
- Add unit tests for AM/PM, noon, partial-slot overlaps, malformed lines, online/no-meeting classes, and mixed input.
- Do not silently accept ambiguous times if doing so can produce the wrong schedule. Return a warning that the manager can review.
- Normalize parsed output before it reaches scheduler state.
- Preserve the privacy principle that only the schedule information needed for availability is retained. Do not persist uploaded screenshots.

### Current Claude-specific integration

The existing `window.claude?.use(...)` path is acceptable as a prototype fallback but must not be the only production path.

Create a clean provider abstraction for schedule extraction:

- Text should be parsed locally first whenever possible.
- Image extraction may use a server-side/edge AI provider only when configured.
- Never expose a private AI API key in browser JavaScript.
- Validate AI output against a strict schema before applying it to the form.
- Treat pasted text and OCR output as untrusted data, not instructions.
- Show the user what was extracted and require review before saving.
- If no AI provider is configured, the app must still work fully for manual entry and deterministic text parsing.
- If you add client OCR such as Tesseract.js, lazy-load it only when the image-import feature is used. Do not make the initial bundle huge for a feature the user may never open.

### Accessibility/UI bugs

- Do not place interactive controls inside another interactive button. The current student card/remove pattern must become valid accessible markup.
- Every action must be keyboard accessible.
- Use visible focus styles.
- Do not communicate coverage, conflicts, or student identity by color alone.
- Verify WCAG AA contrast for text/chips/statuses in both light and dark mode.
- Respect `prefers-reduced-motion`.
- Add meaningful `aria-label`, `aria-live`, table semantics, and screen-reader text where needed without over-labeling everything.

## Target architecture

Refactor away from one giant HTML file.

Use a modern, simple stack:

- **Vite**
- **React + TypeScript**
- **Tailwind CSS** using the current Vite integration
- `lucide-react` for icons
- **Vitest** for unit tests
- Use React state/useReducer or a small state library only if it actually improves the code. Do not install dependencies just because they are popular.

Do not add Next.js, PHP, Firebase, AWS, Redux, GraphQL, or a heavy component framework unless the repository has a concrete requirement that justifies it.

A reasonable structure is:

```text
src/
  app/
    App.tsx
  components/
    app-shell/
    students/
    schedule/
    summary/
    import/
    ui/
  features/
    scheduling/
      types.ts
      constants.ts
      parser.ts
      availability.ts
      coverage.ts
      scheduler.ts
      validation.ts
      selectors.ts
    persistence/
      storage.ts
    calendar/
      ics.ts
    import/
      schedule-extractor.ts
      schemas.ts
  hooks/
  lib/
  styles/
    app.css
  test/
```

You may improve this structure if you can justify the change. Keep scheduling/business logic independent of React components so it is testable.


## n8n is a first-class orchestration layer

This project is intentionally designed to integrate with **n8n**. Do not treat n8n as a replacement for the frontend, database, or scheduling algorithm. Treat it as the orchestration/integration layer connecting intake, AI extraction, scheduling services, approvals, persistence, notifications, and Google Calendar.

The target separation of responsibilities is:

- **React frontend:** user interaction, upload/paste, review screens, manual edits, visual schedule, approvals, status/errors.
- **Deterministic TypeScript scheduling engine:** calculates shifts, validates hard constraints, calculates coverage, and explains unsatisfied constraints. AI must not be the source of truth for these rules.
- **n8n:** receives workflow requests, invokes AI/server services, branches based on confidence/status, performs Google Calendar operations, handles approval/notification workflows, retries integrations, and records execution outcomes.
- **AI/vision model:** converts messy text/images into structured schedule constraints and may generate human-readable recommendations. It must not silently override deterministic scheduling rules.
- **Persistence layer:** local-first for MVP; Supabase is the preferred optional shared backend for production/multi-user state and sync metadata.
- **Google Calendar:** publishing destination, not the canonical scheduling database.

### Required automation modes

Design the product so it can support three explicit automation levels:

1. **Suggest only**
   - User pastes text or uploads a schedule image.
   - AI extracts meeting times, preferences, and ambiguities.
   - App shows recommendations and warnings.
   - Nothing is scheduled or synced automatically.

2. **Draft + Review — DEFAULT / MVP TARGET**
   - User provides text/image and scheduling constraints.
   - AI extracts/normalizes the input.
   - Deterministic scheduler produces a complete proposed schedule.
   - UI shows coverage, conflicts, reasons, and any unresolved gaps.
   - Manager manually approves or edits the proposal.
   - Only after explicit approval does n8n publish/update events in Google Calendar.

3. **Auto-publish — FUTURE / OPT-IN**
   - Same extraction and deterministic scheduling pipeline.
   - Automatically publishes only when validation/confidence thresholds and business rules pass.
   - Ambiguous input, hard conflicts, low-confidence extraction, or destructive calendar changes must fall back to human review.
   - This mode must be opt-in and visibly distinguishable from Draft + Review.

### n8n workflows to design for

Do not bury the entire application inside one huge n8n workflow. Prefer small workflows with explicit contracts.

#### Workflow A — Intake / AI extraction

Suggested endpoint: `POST /webhook/shiftfit/interpret`

Input can include:

```json
{
  "requestId": "uuid",
  "studentId": "optional-id",
  "text": "Tuesday Thursday 8-9:15 ...",
  "image": "binary upload or secure temporary reference",
  "preferences": {
    "targetHours": 19,
    "preferredTime": "morning",
    "latestEnd": "16:00",
    "maxDays": 5
  }
}
```

Pipeline:

1. Webhook trigger.
2. Authenticate/validate the caller.
3. Enforce request size and supported MIME types.
4. Treat user text/image content as untrusted data, never as system instructions.
5. Run deterministic text parsing first where possible.
6. If image or ambiguous text requires AI, call a configured vision/LLM provider server-side.
7. Require strict structured output validated against JSON Schema.
8. Normalize days/times into the application's canonical data model.
9. Generate confidence/ambiguity flags and warnings.
10. Return structured extraction results to the frontend for review.

Example response shape:

```json
{
  "requestId": "uuid",
  "status": "needs_review",
  "confidence": 0.93,
  "meetings": [
    {"day":"tue","start":480,"end":555,"source":"class"},
    {"day":"thu","start":480,"end":555,"source":"class"}
  ],
  "constraints": {
    "latestEnd": 960,
    "targetHours": 19,
    "preferredTime": "morning",
    "maxDays": 5
  },
  "warnings": [],
  "unresolved": []
}
```

Never store the original screenshot indefinitely merely because n8n processed it. Delete temporary binary data after extraction unless a documented retention requirement exists.

#### Workflow B — Generate / evaluate schedule

Suggested endpoint: `POST /webhook/shiftfit/generate`

The scheduling result must come from the deterministic scheduling engine, not an LLM improvising shift times.

Preferred architecture:

- Keep the scheduling engine in a reusable, tested TypeScript module.
- If n8n must invoke it remotely, expose the scheduler through a small server/API/edge function and have n8n call that API.
- Alternatively, the frontend may execute the exact same deterministic scheduler locally for instant previews, while n8n/server re-validates before publishing.
- Do **not** reimplement complex scheduling rules separately inside multiple n8n Code nodes because the rules will drift and become difficult to test.

Return:

- proposed contiguous shifts
- assigned hours per student
- coverage by slot
- uncovered staff-hours
- hard conflicts
- soft-preference violations
- required 7am starts satisfied/missing
- explanation codes/messages
- a stable schedule/version ID

AI may summarize this result in plain English, for example:

> "Coverage is complete except Tuesday 3:30–4:30 PM. No available student can cover that period without exceeding a class or hour constraint."

But AI does not get authority to bypass the scheduler's hard constraints.

#### Workflow C — Human approval / publish to Google Calendar

Suggested endpoint: `POST /webhook/shiftfit/publish`

Input should include the exact approved schedule/version, not a natural-language request such as "make the schedule work."

Pipeline:

1. Receive approved schedule ID/version and event payloads.
2. Revalidate that the schedule has not changed since approval.
3. Compare proposed events with previously synced ShiftFit events.
4. Create missing Google Calendar events.
5. Update changed ShiftFit-owned events.
6. Delete/cancel obsolete ShiftFit-owned events only when explicitly permitted.
7. Save Google event IDs and sync status in persistence so retries are idempotent.
8. Return per-event success/failure information.
9. Log the publish action and any failed integrations.

Calendar writes must be idempotent. Retrying a failed n8n execution must not create duplicate shifts.

Use ShiftFit-specific metadata, persisted event IDs, or another durable mapping strategy so the system knows which Google Calendar events it owns. Never broadly delete arbitrary user calendar events.

#### Workflow D — Reconciliation / change handling (later phase)

Optional scheduled workflow:

- detect pending/failed syncs
- reconcile ShiftFit assignments with Google Calendar event IDs
- retry transient failures
- surface conflicts created after the schedule was published
- notify the manager when manual intervention is required

Do not add this until the core Draft + Review flow works reliably.

### AI responsibilities vs scheduling responsibilities

**AI SHOULD:**

- read screenshots
- understand messy pasted Workday/class text
- extract day/time blocks
- detect statements such as "I can't work after 4" or "I need Friday morning"
- identify ambiguous information
- summarize coverage problems
- explain why a proposed schedule was generated
- suggest possible manager actions when deterministic scheduling cannot achieve coverage

**AI MUST NOT be solely responsible for:**

- checking class overlaps
- enforcing the 19-hour target/cap
- calculating staffing minimums
- enforcing lunch/cutoff/max-days rules
- guaranteeing conflict-free schedules
- deciding whether destructive calendar changes are safe
- creating arbitrary calendar events directly from unvalidated natural language

Those belong to tested deterministic code plus explicit approval gates.

### Frontend UX for automation

The redesigned UI must make the automation visible and trustworthy.

Create an import flow resembling:

`1. Upload / Paste` → `2. AI Review` → `3. Schedule Draft` → `4. Manager Review` → `5. Sync`

For step 2 show:

- extracted meetings
- detected preferences
- confidence/needs-review state
- unrecognized lines
- edit-before-accept controls

For step 3 show:

- proposed shifts
- coverage improvement
- remaining gaps
- conflicts/reasons
- alternative suggestions when useful

For step 4 require explicit approval for the MVP.

For step 5 show real sync state:

- Not synced
- Syncing
- Synced
- Partially synced
- Sync failed / Retry

Do not show fake success states.

### n8n integration adapter

Create a frontend service module such as:

```text
src/services/automation/
  n8nClient.ts
  contracts.ts
  mockAutomationClient.ts
```

The app should read n8n webhook/API base URLs from environment configuration, for example:

```text
VITE_AUTOMATION_API_URL=
```

Do not embed n8n credentials or secrets in frontend JavaScript.

For production, prefer calling a secured backend/API facade rather than exposing sensitive administrative n8n endpoints. At minimum secure webhook endpoints appropriately and document the threat model.

Provide a mock/local adapter so the application remains demoable when n8n is unavailable.

### n8n deliverables

Add `docs/N8N_ARCHITECTURE.md` containing:

- workflow diagrams in Mermaid
- webhook contracts
- expected input/output JSON
- authentication strategy
- error/retry behavior
- idempotency strategy for Google Calendar
- which steps use AI and which are deterministic
- instructions for setting up each n8n workflow manually
- environment variables required by the frontend/backend

If feasible in the repository, also provide importable n8n workflow JSON templates under:

```text
n8n/
  shiftfit-interpret.json
  shiftfit-generate.json
  shiftfit-publish.json
```

The workflow templates may use placeholder credentials/environment variables, but must never contain real secrets.

### Technology restraint

Do not introduce AWS simply because cloud services are available.

AWS Textract or other OCR services may be evaluated if there is a demonstrated advantage for the actual class-schedule screenshots, but a general multimodal AI model may be simpler for this use case. Document the tradeoff before adding a paid cloud dependency.

Do not simultaneously add AWS + Firebase + Supabase + n8n. Each platform must have a specific responsibility.

Recommended MVP stack:

```text
React + TypeScript + Tailwind
        ↓
 deterministic scheduling engine
        ↓
 n8n orchestration/webhooks
   ↙          ↓            ↘
AI extraction  optional DB  Google Calendar
               (Supabase)
```

The app must still support manual scheduling if AI or n8n is unavailable.


## Persistence strategy

### Required now

Implement reliable local persistence so a page refresh does not destroy the schedule.

- Use versioned local storage or IndexedDB behind a small persistence adapter.
- Include a migration/version strategy so future state changes do not corrupt old saved data.
- Add **Export backup** and **Import backup** as JSON.
- Validate imported data before loading it.
- Add “Reset demo data” and “Clear all data” with confirmation.

### Optional shared backend, but architect for it

If implementing cloud persistence, prefer **Supabase** rather than mixing multiple backend platforms.

If you add Supabase:

- Create `.env.example`; never commit secrets.
- Keep the app usable in local/demo mode when Supabase variables are absent.
- Add SQL migrations under `supabase/migrations/`.
- Use Auth only if multi-user persistence is actually implemented.
- Use Row Level Security for every user/department-owned table.
- Never use the Supabase service-role key in frontend code.
- Consider tables such as departments, memberships, students, busy_blocks, schedule_settings, and shift_assignments.
- Store normalized meeting/busy times, not screenshots or unnecessary course information.

Do not add Supabase just to say the project has a database. If local persistence is enough for this iteration, build the adapter boundary and document the future schema instead.

## Product/UI direction

Redesign the product completely while keeping the core workflow familiar.

Visual direction: premium scheduling SaaS, calm, efficient, human, and campus-friendly. Think the restraint and clarity of Linear, Cron/Notion Calendar, and modern workforce tools — **not** neon gradients, glassmorphism everywhere, giant hero sections, excessive rounded cards, or decorative AI-looking blobs.

Use a strong information hierarchy, generous spacing, crisp typography, subtle borders, clear status colors, and small purposeful motion.

### Desktop layout

- Compact top app bar with product name, schedule status, week/template controls, undo/redo if implemented, theme control, and primary actions.
- Left student rail with search/filter, student status, hours progress, and quick add.
- Large central scheduling canvas with sticky time column and sticky weekday header.
- Right insights panel for coverage, gaps, student-hour warnings, conflicts, and recommended actions.
- Allow the right panel to collapse on medium widths.

### Schedule grid

Make the grid the star of the app.

- Sticky day headers and time labels.
- Clear half-hour rows without visual clutter.
- Strong but tasteful hover/selection states.
- Selected student availability should be obvious.
- Show class/busy blocks using pattern/icon/label as well as color.
- Show assigned shift blocks as contiguous visual blocks rather than dozens of unrelated chips when possible.
- Make gaps visually noticeable without screaming red across the whole page.
- Tooltips/popovers should explain who is working, staffing requirement, why the selected student is unavailable, and any conflict.
- Manual edits should be fast. Consider click-drag/range selection if it can be implemented accessibly and reliably; keep keyboard/click fallback.

### Add/edit student UX

Replace the long `<details>` form with a polished side sheet or modal flow:

1. Student basics.
2. Import/paste class schedule.
3. Review detected meetings.
4. Work preferences/constraints.
5. Save.

The same UI must support editing an existing student.

For AI/image import, clearly show `Detected`, `Needs review`, and `Could not read` states. Never silently save AI output.

### Summary/insights

Show useful metrics such as:

- staffing demand fulfilled
- fully staffed slots
- uncovered staff-hours
- students at target
- students below target
- hard conflicts
- required early shifts still missing

Use plain language. A manager should understand the schedule in five seconds.

### Empty/loading/error states

Design them intentionally. Do not leave blank columns or raw browser errors.

## Scheduling engine redesign

Keep 30-minute granularity unless there is a strong reason to make it configurable.

Separate these concepts:

- a `BusyBlock` such as class/lunch/unavailable time
- a `ShiftBlock` such as Monday 08:00–12:00
- derived 30-minute coverage slots for calculations/rendering

The optimizer should work with contiguous candidate shift blocks or otherwise strongly favor contiguous assignments.

Hard constraints:

- never overlap a busy/class block
- never go beyond a student cutoff
- never overlap required lunch/unavailability
- never exceed target weekly hours unless the manager explicitly overrides with a warning
- never exceed maximum work days unless explicitly overridden
- honor required 7am start requirement when possible

Soft preferences:

- morning/afternoon preference
- fewer split shifts
- fewer isolated 30-minute assignments
- balanced hours across the student’s requested work days
- fill the thinnest coverage first
- minimize unnecessary overstaffing

The algorithm must be deterministic for the same input.

Do not hide failure. If full coverage is impossible, return a structured result containing uncovered periods and reasons/candidate shortages.

## Data model

Create explicit TypeScript types. Avoid loosely shaped objects.

At minimum model:

```ts
type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

type BusyBlock = {
  day: Day
  start: number
  end: number
  source: 'class' | 'lunch' | 'manual'
}

type ShiftBlock = {
  id: string
  studentId: string
  day: Day
  start: number
  end: number
  source: 'manual' | 'autofill'
}
```

Create similarly explicit types for Student, ScheduleSettings, CoverageSlot, ConstraintViolation, AutoFillResult, and persisted state.

Use minutes-from-midnight internally if that remains the simplest representation, but centralize all conversion/formatting helpers.

## Tests that must exist

Write meaningful tests before declaring the refactor done.

Parser tests:

- `MWF 9:00-9:50`
- `MW 1:00pm-2:15pm`
- `TTh 8:00-9:15`
- `TR 9:00-10:15`
- `Th 8:00-9:15`
- `Tuesday/Thursday | 8:00 AM - 9:15 AM | SCB 211`
- noon and 12am handling
- malformed/ambiguous rows

Scheduling tests:

- class overlap blocks assignment
- a 9:00–9:15 class blocks the 9:00–9:30 slot
- cutoff is enforced
- lunch is enforced
- hour cap includes hidden/non-visible assignments
- max work days is enforced
- required 7am behavior is correct
- impossible schedules return explicit unmet constraints
- auto-fill is deterministic
- auto-fill prefers contiguous blocks
- existing manual assignments remain unless the manager chooses to replace them

Coverage tests:

- consecutive same-day gaps merge correctly
- non-consecutive gaps do not merge
- minimum staffing 2 is calculated correctly
- coverage-demand percentage and fully-staffed percentage are distinct and correct
- theoretical staffing-hours are labeled correctly

Persistence tests:

- state saves and reloads
- invalid import is rejected safely
- migration/version handling works

Run tests and production build. Fix failures rather than commenting tests out.

## Security and privacy

This app may contain student schedule information.

- Do not log screenshots, raw imported schedules, or sensitive data to analytics/console in production.
- Do not upload screenshots unless the user explicitly invokes image extraction.
- Do not persist screenshots after extraction.
- Never put secret API keys in client bundles.
- Sanitize/escape user-provided text rendered into HTML.
- Prefer React rendering over manually building large `innerHTML` strings.
- Validate all imported JSON and all AI responses.
- Document what is stored locally and what would be sent to an external AI service.

## Calendar export

If it can be implemented without destabilizing the core refactor, add `.ics` export for each student as a separate module.

Do not fake calendar sync. For recurring semester events, require explicit semester start/end dates and timezone. If those values are not configured, disable `.ics` export with a clear explanation rather than guessing dates.

## Theme and polish

- Fully support light and dark mode with a visible theme control: System / Light / Dark.
- Use design tokens/CSS variables for semantic colors.
- Verify chip text contrast.
- Use typography that looks professional and loads safely. Avoid adding many web-font weights.
- Keep animation subtle and functional.
- Add favicon/app metadata if missing.
- Give the product a polished title/identity such as **ShiftFit** while preserving “Shift Coverage Planner” as a descriptive subtitle if useful.

## Responsiveness

Desktop should be the richest experience, but mobile must remain usable.

On small screens:

- convert side panels into sheets/tabs
- make day navigation easy rather than forcing an enormous five-day table
- keep primary schedule actions reachable
- preserve accessibility and editing capability

Test at roughly 1440px, 1024px, 768px, 430px, and 375px widths.

## Deliverables

By the end, leave the repository with:

- clean Vite + React + TypeScript source structure
- separated CSS/styles and JavaScript/TypeScript modules
- working local development commands
- production build command
- polished responsive UI
- fixed scheduling bugs
- robust parser
- versioned persistence
- tests
- `docs/AUDIT.md`
- updated `README.md`
- updated `docs/ROADMAP.md` if scope changed
- `.env.example` if environment variables are needed
- no committed secrets
- no dead legacy code unless intentionally kept in a clearly labeled archive folder

## Acceptance criteria

Do not tell me the work is complete until all of these are true:

1. `npm install` succeeds.
2. `npm run dev` starts the app.
3. `npm run build` succeeds with no errors.
4. Unit tests pass.
5. The schedule survives page refresh.
6. I can add, edit, and remove a student.
7. I can paste common class-time formats and review parsed results.
8. I can manually assign/unassign work.
9. Auto-fill respects hard constraints and favors contiguous shifts.
10. Switching the visible/open-hours view cannot silently alter or hide hour totals.
11. Gap ranges group correctly.
12. Coverage metrics are mathematically correct and clearly labeled.
13. The interface works with keyboard only.
14. Light and dark mode are both polished.
15. Mobile does not require an unusable five-column desktop grid.
16. No API secret is present in frontend source or built assets.
17. The app still works when no AI provider and no Supabase account are configured.

## Working style

Make decisions and execute them. Do not stop every few minutes to ask me which library or component style I prefer. Use the product goal and the existing repository to choose sensible defaults.

However:

- do not invent BYU–Hawaii policies that are not present in the repository
- keep configurable rules configurable
- do not fake a backend, AI call, login, calendar sync, or database connection
- do not replace working functionality with mock UI
- do not delete features just because they are inconvenient to refactor

When you encounter ambiguity, choose the safest reversible implementation and document the assumption.

## Final response after implementation

When finished, give me a concise implementation report with:

- what you changed
- bugs fixed
- new architecture
- dependencies added and why
- how to run it
- how persistence works
- whether Supabase/AI is enabled or only scaffolded
- privacy/security notes
- tests/build result
- any remaining limitations

Then stop. The repository itself is the primary deliverable, not a long essay.
