# Decision log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-09 | Single HTML file, no framework | Fastest path to a working prototype; no build step for teammates |
| 2026-09 | Store busy times only, never course names | Keeps student records out of the tool; simpler FERPA story |
| 2026-09 | Cloudflare Pages for hosting | Free, no credit card, Workers + D1 available later |
| 2026-09 | .ics export before Outlook sync | Works with Outlook, Google, and Apple with no admin approval |
| 2026-09 | 19 hours/week is a hard cap per student | Campus student-employment limit |
| 2026-09-18 | Rebuilt as Vite + React + TypeScript + Tailwind, prototype archived | Prototype's coupled view/data state caused real bugs (see docs/AUDIT.md #1); business logic needed to be unit-testable independent of the DOM |
| 2026-09-18 | n8n is orchestration-only; AI/scheduling authority stays in tested TypeScript | AI must never be able to silently bypass class/lunch/cutoff/hour-cap rules; those rules need to be tested and identical between local preview and server-side publish |
| 2026-09-18 | localStorage (versioned, validated) instead of a backend for v2 | Matches "local-first for MVP" from the project brief; Supabase stays optional and department-scoped for v3 |
| 2026-09-18 | Required "opening shift" means a real contiguous block, not one slot | A single 30-minute assignment at open time is not what "the student opens" means operationally (docs/AUDIT.md #3) |
| 2026-09-18 | Every screen is written for a first-year student; Help text is plain data in one file | The users are student workers and new managers. Adding a FAQ entry must not need a developer (src/content/help.ts) |
| 2026-09-18 | "Fill schedule for me" is a deterministic planner, not AI, and explains every shift | Managers must trust and be able to check it; the same input always gives the same schedule |
| 2026-09-18 | Publishing is gated: explicit approval, refused while a rule is broken, and a mock run can never show "synced" | A fake success state, or a schedule that breaks a rule, reaching a shared calendar is worse than no automation |
| 2026-09-18 | Soft limits (weekly hours, days per week) can be overridden after a confirmation that names every limit; class, lunch and cutoff never can | Managers sometimes need to, but consent must be informed and stay visible as a warning |
| 2026-09-18 | Fonts are bundled, not loaded from Google | Student schedules are education records; avoid third-party requests |
| 2026-09-19 | Drag-to-fill is mouse and pen only | Touch must keep scrolling the page, and keyboard users already have arrow keys and Shift+Enter, so nothing depends on dragging |
| 2026-09-19 | The main action (Fill schedule for me) lives in the header; rarely used options fold away below 1280px | On a laptop the schedule is the point of the screen; it was getting about 200px of height |
| 2026-09-19 | Quick fixes only offer a student who can take part of the stretch under every rule, and say how much | A one-click button that quietly skips boxes or breaks a rule would be worse than no button |
| 2026-09-19 | Bulk add lets bad lines be skipped, but shows every line and says how many will be skipped | Adding 30 students should not fail because of one typo, but nothing may be dropped silently |
| 2026-09-23 | One visibly primary action ("Fill schedule for me"); everything else in the header is icon-only or collapsed by default (Settings row, theme switch, Undo/Redo, Rules/Help) | Feedback on a screenshot: "so what do I click, where do I go" — too many same-weight buttons and always-visible settings made the first click unclear. Text stays reachable via tooltip/aria-label, just not shouting by default. |
| 2026-09-23 | Student cards show only name, hours-vs-target, and anything needing attention — preference/days/cutoff/lunch moved to the Edit form only | Those are settings, not status; repeating them as a text line on every card was the densest text block on the whole screen and added nothing a manager reads while actively scheduling |
| 2026-09-23 | The "what to do next" banner shows one line; the longer explanation moves behind the same "?" tooltip used everywhere else, instead of a second sentence always on screen | Consistency (one disclosure pattern app-wide) and less simultaneous text competing with the schedule for attention |
| 2026-09-18 | Calendar files use local times with a timezone and repeat by count | UTC-suffixed local times put every shift at the wrong hour; local-time UNTIL needs timezone math the app refuses to guess |
