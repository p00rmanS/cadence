# ShiftFit

Class-aware shift scheduling for student workers.

Managers paste a student's class schedule and work requests, and ShiftFit builds a
weekly coverage grid that respects class times, a 19-hour weekly target, day-of-week
patterns, cutoff times, lunch breaks, and required early shifts.

Built for CRDEV 301 at BYU–Hawaii.

## The problem

Every semester, departments rebuild every student worker's schedule by hand: class
times from the registration portal, shifts from a spreadsheet or a text message.
There is no single source of truth, so gaps and conflicts slip through.

## What it does today

- Reads class times pasted as text (Workday "Meeting Patterns" rows or short form like `MWF 9:00-9:50`)
- Reads a screenshot of a schedule (only when opened from the claude.ai artifact link)
- Tracks a 19-hour weekly target per student
- Enforces per-student rules: days per week, morning/afternoon preference, latest end time, lunch break, required 7am shift
- Shows a weekly coverage grid for 7am–5pm or 8am–5pm, with 1 or 2 staff per slot
- Flags uncovered time and estimates how many students are needed
- Auto-fills shifts, then lets the manager adjust by hand

## Not built yet

- Saving data between sessions (a refresh clears everything)
- .ics export for Outlook / Google / Apple Calendar
- Outlook sync via Microsoft Graph
- Free in-browser OCR (Tesseract.js) so screenshot reading works off claude.ai
- Multiple departments and manager sign-in

## Run it

It is a single file with no build step.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

**Cloudflare Pages (no CLI):** dashboard → Workers & Pages → Create → Pages →
Upload assets → drag this folder in → Deploy.

**Cloudflare Pages (from GitHub):** connect the repo, leave the build command empty,
and set the output directory to `/`.

**GitHub Pages:** Settings → Pages → deploy from the `main` branch, root folder.

Screenshot reading does not work on these deployments. It needs the claude.ai artifact
link, or one of the replacements listed under "Not built yet".

## Privacy

- Only meeting times are kept. Course names, instructors, rooms, and IDs are ignored.
- Uploaded screenshots are read and discarded, never stored.
- Use fake data for demos. Get each student's OK before using real schedules.
- Class schedules are education records under FERPA. Talk to your instructor before a
  real pilot, and to OIT before connecting BYUH accounts.

## Team

| Role | Owner |
| --- | --- |
| IT / build | |
| Business / adoption | |
| Design / UI | |
| OBHR / interviews | |
