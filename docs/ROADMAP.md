# Roadmap

## v1: single-file prototype (archived)
Superseded. Kept at `archive/shift-coverage-planner-v1.html`. See `docs/AUDIT.md` Part 1.

## v2: manager planning tool (current)
- [x] Vite + React + TypeScript + Tailwind; rules separate from the UI and unit-tested
- [x] All prototype bugs fixed (`docs/AUDIT.md` Part 1) and a second audit of the rebuild (Part 2)
- [x] Plain-language UI: welcome, next-step banner, inline explanations, FAQ, glossary, shortcuts
- [x] Block-based, deterministic auto-fill with a reason for every shift
- [x] Conflict detection, "why is this empty?" explanations, explicit override with warnings
- [x] Undo / redo for everything, range fill (Shift+click), keyboard grid navigation
- [x] Backup / restore, spreadsheet export, per-student calendar files (.ics)
- [x] Honest publishing flow (approval, rule check, practice run, validated responses)
- [x] Light / dark / auto theme; phone layout with section tabs and a day picker
- [x] Other times a student can't work; days off in calendar files
- [x] "By student" and "By day" views with Copy as text and Print
- [x] Drag-to-fill on the grid (plus Shift+click and keyboard ranges)
- [x] "Quick fix" buttons for empty times; "Add several students at once"
- [x] Accessibility rules, contrast and privacy checks run in `npm test`
- [x] Self-hosted fonts; 0 known vulnerabilities
- [x] Every file commented in plain language for a non-developer reader (`docs/AUDIT.md`, "Readability pass")
- [x] Checked against the updated Track C project document; gaps mapped to D1–D6 (`docs/AUDIT.md` Part 5)
- [ ] **Try it with real first-year students** and fix what confuses them (not yet done)
- [ ] Test with a real screen reader (NVDA / VoiceOver)
- [ ] Grow the FAQ from real questions (edit `src/content/help.ts`)
- [x] Harden the n8n templates' own logic (request validation, idempotent shiftId->googleEventId diffing via workflow static data, real AI-output schema validation, real calendar dates via `PublishRecurrence`) — `docs/AUDIT.md` Part 6
- [ ] Run the n8n templates against a live n8n (James is standing up hosting/credentials/AI provider)
- [x] Declutter the header, banner and student cards: one visible primary action, icon-only secondary actions, settings collapsed by default, less always-on text (`docs/DECISIONS.md` 2026-09-23)
- [x] "Paste existing shifts": import a schedule written as plain text (the engagement letter's supervisor-text case), previewed line by line, rule-checked, one Undo step (`shift-import.ts`)
- [x] Optional student profile photos (upload up to 5 MB, shrunk to a small thumbnail, saved locally, shown on cards and lists)
- [ ] Keep iterating on visual design toward "award winning" polish (typography, spacing, color depth) — this pass fixed information density and hierarchy, not a full visual redesign
- [ ] A stronger auto-fill (optimizing planner) for the "2 people at once" case
- [ ] Merge same-day shifts into one visual block in the grid
- [ ] One guided import flow (Upload / Paste → Review → Draft → Approve → Sync) instead of separate screens (from the original build brief; `docs/AUDIT.md` Part 7)
- [ ] Headline tiles for "uncovered staff-hours" and "required early shifts still missing" in Schedule health
- [ ] Let the right-hand Schedule health panel collapse on medium-width screens
- [ ] Optional upgrades, each its own project: React 19, Tailwind 4
- [ ] Open the generated calendar files in real calendar apps and confirm holidays are skipped
- [ ] Check printing on real paper
- [ ] Try "Add several at once" with a real registrar or Workday export and adjust the accepted formats

## v3: shared tool
- [ ] Department accounts / sign-in
- [ ] Supabase-backed shared persistence (departments, memberships, students, busy_blocks,
      schedule_settings, shift_assignments; row-level security per department)
- [ ] Photos in shared storage (e.g. a Supabase Storage bucket with per-department access rules) instead of inside each browser's saved data. Needs the same hosting/FERPA decision as the rest of v3; until then photos stay local.
- [ ] Student self-service availability form and a published schedule view
- [ ] Live n8n: AI extraction and Google Calendar publishing actually running

## v4: automation
- [ ] Opt-in auto-publish (confidence-gated, falls back to human review)
- [ ] Reconciliation between ShiftFit and Google Calendar
- [ ] Mid-semester changes that re-sync without duplicates

## Open questions
- Which department pilots first?
- Who owns hosting and the n8n instance (and its credentials) after the semester?
- Does OIT allow a Google Calendar / Microsoft Graph app registration in the BYUH tenant?
- Is Supabase acceptable for FERPA-covered data, or does OIT require something else?
