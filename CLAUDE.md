# CLAUDE.md

Instructions for Claude Code when working in this repository. See `README.md` for what the app
does and how it's built, `docs/AUDIT.md` for known bugs and what's been verified, `docs/ROADMAP.md`
for what's planned, and `docs/DECISIONS.md` for why past choices were made.

## Who is on the team and who does what

Three people write code here. Each runs Claude Code on their own computer, on their own branch.

| Person | GitHub | Focus | Branch names start with |
| --- | --- | --- | --- |
| **Christroi Colarte** | `colartec22` | **UI/UX design only**: how it looks, feels and reads | `christroi-` |
| **James Baldwin Dean** | `p00rmanS` (owns the repository) | **UI and logic** (both) | `james-` |
| **Jared Rodrigo** | *(not invited yet; add his GitHub name here when he joins)* | **UI and logic** (both) | `jared-` |

Austin Jefferies (Reports Manager in the project document) is not currently working in the code. Add
him here if that changes.

**Which person are you helping?** Look at the current branch name (`git branch --show-current`).
`christroi-...` means Christroi, `james-...` means James, `jared-...` means Jared. If the branch name
doesn't say, ask before changing anything.

### Who may edit which files

**Design files, Christroi's area** (James and Jared may edit these too, but tell Christroi first):
`src/components/**`, `src/styles/app.css`, `tailwind.config.ts`, `index.html`, `public/**`, and the
wording in `src/content/help.ts`.

**Logic files, James's and Jared's area:** `src/features/**` (the scheduling rules, parsing,
calendar files, photo handling), `src/hooks/**`, `src/services/**` (n8n), `src/lib/**`, `n8n/**`.

**Shared files, talk to the others BEFORE editing:** `src/app/App.tsx`,
`src/hooks/useShiftFitStore.ts`, `src/features/scheduling/types.ts`, `src/test/app.test.tsx`,
`package.json`, `package-lock.json`, and everything in `docs/`. These are touched by everyone and are
where merge conflicts start.

**If you are working for Christroi:** do not change scheduling logic, saved-data shapes, or the store.
If a design idea needs new data or a new rule (for example "show each student's weekly total in a new
place"), do not build the logic yourself. Write down exactly what is needed and tell Christroi to pass
it to James or Jared. A design change must never change what the app *does*, only how it looks and reads.

**If you are working for James or Jared:** you may change anything, but keep to the task you were
given, announce which files you are about to edit, and never redesign a screen unless that is the task.

### Design rules already decided (Christroi and everyone else, please keep them)

These came from real feedback on the first design ("so what do I click, where do I go"):

- **One clear main action per screen** (a solid accent-colored button). Everything else is quieter.
- **Secondary actions are icon-only** buttons. They MUST keep a name for screen readers and hover:
  `aria-label` and `title`. Tests find buttons by these names, so renaming one means updating its tests.
- **Rarely changed settings are collapsed** behind a toggle (see "Settings" in `TopBar.tsx`), not always on show.
- **Longer explanations go behind the "?" help tip** (`HelpTip`), not as a paragraph on screen.
- **Never rely on color alone.** Pair color with text, an icon or a pattern. Text must stay readable in
  BOTH light and dark themes; `contrast.test.ts` measures it.
- **Plain words.** Every visible string must make sense to a first-year student with no context.
- **Everything works with the keyboard.** Keep visible focus outlines and don't nest a button inside a button.

## Code must be readable and commented (for every person and every Claude session)

Some of us are new to programming and must be able to read every file. So:

- **Every source file starts with a comment** saying, in plain language, what the file is for and how it
  fits into the app. `src/test/readability.test.ts` fails if a new file has none.
- **Every function and component gets a short plain-language comment**: what it does and *why it exists*
  (one or two sentences). Anything not obvious from reading it gets a comment too: a tricky condition,
  a regular expression (explain it in words), a number with a reason behind it.
- **Write simple code.** Use clear, full names (`weeklyHours`, not `wh`). Prefer a few plain lines over one
  clever line. Keep functions and files short and focused on one job. Avoid deep nesting.
- **Name numbers.** No unexplained "magic numbers": put them in a named constant
  (see `src/features/scheduling/constants.ts`) with a comment.
- **Keep comments true.** If you change what code does, fix its comment in the same change. Delete
  commented-out code instead of leaving it.
- **New behavior needs a test.** Put it in `src/test/`, and make sure the test would fail without your fix.
- Comments explain *why*, not just *what*, but never skip the "what" for a beginner reader.

## Project commands

- `npm install` — install dependencies
- `npm run dev` — start the dev server (http://localhost:5173)
- `npm run build` — type-check and build for production
- `npm test` — run the test suite (`src/test/`)
- `npm run lint` — type-check only (`tsc --noEmit`)

Run `npm test` and `npm run lint` before considering any change finished. Both should report no
failures.

## Code rules already established in this project

- Scheduling rules live only in `src/features/scheduling/` — plain TypeScript, no React, fully
  unit-tested. Never duplicate a rule (class conflict, weekly hour cap, etc.) anywhere else.
- No AI or scheduling authority lives in the browser bundle and no API key belongs in a `VITE_*`
  variable — see `docs/N8N_ARCHITECTURE.md` for how the optional n8n integration is scoped.
- Student data and photos are personal records (FERPA). Use made-up people in demos and screenshots.

## Working on this repo as a team (multiple people, multiple Claude Code sessions)

See `TEAM-WORKFLOW.md` for the full Git/GitHub steps; the rules that matter for how you (Claude)
should behave:

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
- **Never commit secrets:** passwords, API keys, tokens, or a real `.env` file.
