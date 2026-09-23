# CLAUDE.md

Instructions for Claude Code when working in this repository. See `README.md` for what the app
does and how it's built, `docs/AUDIT.md` for known bugs and what's been verified, `docs/ROADMAP.md`
for what's planned, and `docs/DECISIONS.md` for why past choices were made.

## Project commands

- `npm install` — install dependencies
- `npm run dev` — start the dev server (http://localhost:5173)
- `npm run build` — type-check and build for production
- `npm test` — run the test suite (`src/test/`)
- `npm run lint` — type-check only (`tsc --noEmit`)

Run `npm test` and `npm run lint` before considering any change finished. Both should report no
failures.

## Code style already established in this project

- Comments explain *why*, not *what* — except that every file has a short top-of-file comment
  explaining its purpose, written for a reader with no prior backend/frontend experience (the
  project owner is learning as he goes). Keep new files consistent with that.
- Scheduling rules live only in `src/features/scheduling/` — plain TypeScript, no React, fully
  unit-tested. Never duplicate a rule (class conflict, weekly hour cap, etc.) anywhere else.
- No AI or scheduling authority lives in the browser bundle and no API key belongs in a `VITE_*`
  variable — see `docs/N8N_ARCHITECTURE.md` for how the optional n8n integration is scoped.
- Every user-facing string should be understandable to a first-year student with no context.

## Working on this repo as a team (multiple people, multiple Claude Code sessions)

This project is shared by several people, each running Claude Code independently on their own
branch. See `TEAM-WORKFLOW.md` for the full Git/GitHub steps; the rules that matter for how you
(Claude) should behave:

- **Stay on the current branch and the assigned task.** Don't create branches, switch branches,
  commit, or push unless the person you're working with explicitly asks — someone else may be
  relying on the branch state as it is.
- **Keep changes focused.** Touch the files the task actually requires. Don't refactor,
  reformat, or "improve" unrelated code while you're in there — someone else may be mid-edit on
  the same file on a different branch, and unrelated diffs make pull requests harder to review.
- **Avoid unrelated edits**, including opportunistic dependency bumps, renames, or reordering
  imports, unless that's the task.
- **Run the relevant checks before calling anything done**: `npm test` and `npm run lint` at
  minimum; `npm run build` if the change could affect the production build. Report the actual
  results, not an assumption that it's fine.
- **Summarize what changed and how it was verified** at the end of a task: which files, what
  tests were run, and what (if anything) is still unverified — this project already keeps that
  discipline in `docs/AUDIT.md`; match it rather than just saying "done."
- **Shared work goes through a branch and a pull request** — never a direct commit to `master`.
  If you're asked to "ship" or "save" something, that means committing on the current branch and
  (if asked) pushing it and opening a PR, not merging it yourself.
