# ShiftFit

Work schedules that fit around classes. Made for student-worker managers at BYU–Hawaii (CRDEV 301),
and designed so a first-year student can use it without instructions.

Add a student, paste when they have class, press **Fill schedule for me**, then click the pink
boxes that still need someone. ShiftFit never puts anyone in a spot where they have class, and it
tells you in plain words why something can't be done.

## The problem

Every semester, departments rebuild every student worker's schedule by hand: class times from the
registration portal, shifts from a spreadsheet or a text message. There is no single source of
truth, so gaps and conflicts slip through.

## What it does

**For someone using it**

- A welcome screen and a live "what to do next" banner walk a first-time user through the app.
- Class times are checked **as you type** (`MWF 9:00-9:50`, `Tuesday/Thursday 8:00 AM - 9:15 AM`,
  Workday rows). Anything unclear is flagged, never silently guessed.
- **Fill schedule for me** places shifts around classes, lunch, cutoffs and weekly hours, in long
  unbroken shifts. Every shift it adds comes with a plain-language reason. It is not AI: the same
  input always gives the same schedule.
- Click a box to assign or clear a half hour. To do a stretch, drag down a column or Shift+click.
- **Add a whole roster at once**: paste one line per student, or rows copied from a spreadsheet.
  Every line is checked first, and the whole batch is one Undo step.
- **Quick fix** buttons in Schedule health: under each empty time, one click gives the stretch to a
  student who can really work it, with the rule checks already done.
- Online and "to be announced" courses in a pasted registration export are understood, not treated as
  mistakes: they block nothing, and a real time is never skipped by accident.
- **Paste existing shifts**: if a supervisor already wrote the schedule as text
  (`Noa K.: MWF 9:00am-1:00pm`), paste it under **Settings**. Every line is previewed, any half hour that
  breaks a rule is skipped and explained, and the whole paste is one Undo step.
- Optional **profile photos** for students (upload up to 5 MB; shown on cards and in the By student / By day lists).
- Add **other times a student can't work** (a second job, appointments), not just classes.
- **Three views** of the schedule: the grid for building it, and "By student" / "By day" for reading it.
  Both word views can be **copied as text** (for a message or email) or **printed** on a clean page.
- **Schedule health** says what is wrong and *why* ("Nobody is free: Troy (in class), Ana (already
  at 19 hours)"), and warns when a later edit makes an existing shift break a rule.
- **Undo / Redo** for everything, including removing a student or loading a backup.
- **Help** with a quick start, a searchable FAQ, a glossary and shortcuts. `?` opens it anywhere.
- Light, dark, or automatic theme. Works on a phone (one day at a time, section tabs).

**Saving and sharing** (button: *Save & share*)

- Automatic saving in the browser, a backup file you can load on another computer, a spreadsheet,
  and a calendar file per student for phone/Google/Apple/Outlook calendars. Add **days off** (holidays,
  breaks) and shifts on those days are left out of the calendar files.
- Publishing to Google Calendar through n8n is **optional** and honest: without it, the button is
  a "practice run" that says nothing was sent.

## What it deliberately does not do

- No accounts, no server, no analytics. Nothing leaves the browser unless *you* configure an
  automation URL. Fonts are bundled, so it makes no third-party requests.
- No AI in the browser and no API key anywhere in the frontend. Reading screenshots is off unless a
  server-side reader is configured; typed and pasted text always works.
- No invented policy. The 19-hour default is configurable under **Rules**.

## Adding to the FAQ

Help text lives in one file, [`src/content/help.ts`](src/content/help.ts). To add a question, copy
an entry in `FAQ`, give it a new `id`, choose a `topic`, and write short, friendly sentences (each
string in `answer` is one paragraph). Nothing else needs to change. Tests check that ids are
unique, every topic has questions, sentences stay short, and the button names you mention match
what is on screen.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm test          # the whole suite: rules, parsing, calendar, undo, keyboard, mouse, accessibility, scale
npm run lint      # type-check only
```

`npm test` prints the current number of tests. Run it and `npm run lint` before sharing any change.

No environment variables are needed. Copy `.env.example` to `.env` only to connect n8n.

## Architecture

Scheduling rules live in plain TypeScript, separate from React, so they are testable on their own:

```text
src/
  content/help.ts          FAQ, glossary, shortcuts (plain data)
  features/
    scheduling/            types, constants, parser, availability, issues, coverage,
                           scheduler, validation, guidance, blocks, roster, shift-import,
                           summary, time
    persistence/           versioned, validated localStorage
    calendar/              .ics export
    import/                optional screenshot-reader contract + schema checks
  services/automation/     n8n client, mock (practice run), request/response contracts
  hooks/                   useShiftFitStore (state + undo/redo), useTheme, ...
  lib/                     small helpers: ids, downloads, class names, profile-photo shrinking (image.ts)
  components/              app-shell, students, schedule, summary, import, help, ui
  test/                    unit, UI, accessibility, contrast and privacy suites
```

The original single-file prototype is kept at
[`archive/shift-coverage-planner-v1.html`](archive/shift-coverage-planner-v1.html).
[`docs/AUDIT.md`](docs/AUDIT.md) lists every bug found and fixed, **and what is not verified**.
[`CLAUDE_CODE_SHIFTfit_N8N_MASTER_PROMPT_v2.md`](CLAUDE_CODE_SHIFTfit_N8N_MASTER_PROMPT_v2.md) is the
original build brief; AUDIT Part 7 checks the finished app against its acceptance criteria.

## n8n (optional)

n8n can orchestrate screenshot reading and Google Calendar publishing. It never replaces the
frontend or the scheduler. See [`docs/N8N_ARCHITECTURE.md`](docs/N8N_ARCHITECTURE.md) and the
templates in [`n8n/`](n8n/). The templates are starting points, have never been run against a live
n8n, and contain no credentials. Set `VITE_AUTOMATION_API_URL` to enable it.

## Deploy

Any static host works (Cloudflare Pages, Netlify, Vercel, GitHub Pages): build command
`npm run build`, output directory `dist`.

## Privacy

- Only meeting times are kept. Course names, instructors and rooms are ignored.
- Everything is saved in this browser's `localStorage`. Backup files contain student names and
  class times, so keep them private.
- Profile photos are optional. A chosen photo (up to 5 MB) is shrunk to a small square in the browser and
  saved with the student; the original is never stored or uploaded. A photo of a student is personal
  data, so treat backup files as private and check with your instructor before using real photos.
- Screenshots are only ever sent anywhere if you configure a server-side reader, and are never
  stored by the app.
- Class schedules are education records under FERPA. Talk to your instructor before a real pilot,
  and to OIT before connecting BYUH accounts or Google Calendar. Use fake data for demos.

## Team

Cadence, BYU–Hawaii CRDEV 301R (Track C, Fall 2026). Roles are from the team's project document.

| Role | Owner |
| --- | --- |
| Project Manager | Christroi Colarte |
| Team Leader | Jared Rodrigo |
| Reports Manager | Austin Jefferies |
| Deliverables Manager | James Baldwin Dean |

Working together in Git and GitHub: read [`TEAM-WORKFLOW.md`](TEAM-WORKFLOW.md) (one branch per person,
changes reviewed through pull requests). [`CLAUDE.md`](CLAUDE.md) holds the ground rules for anyone
using Claude Code on this repository.
