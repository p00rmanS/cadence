/**
 * All Help text lives here, as plain data, so adding a question is a one-object change:
 * copy an entry in FAQ, give it a new unique `id`, and write short, friendly sentences.
 * Each string in `answer` is one paragraph. Nothing else in the app needs to change.
 *
 * Writing guide: assume the reader has never scheduled anyone before. Use everyday words,
 * say what to click, and say what will happen.
 */

export type FaqTopic = "Getting started" | "The schedule" | "Rules" | "Saving & sharing" | "Good to know";

export type FaqItem = {
  id: string;
  topic: FaqTopic;
  question: string;
  answer: string[];
  /** Extra words people might search for that aren't in the question. */
  keywords?: string[];
};

export const FAQ_TOPICS: FaqTopic[] = ["Getting started", "The schedule", "Rules", "Saving & sharing", "Good to know"];

export const FAQ: FaqItem[] = [
  {
    id: "what-is-shiftfit",
    topic: "Getting started",
    question: "What is ShiftFit for?",
    answer: [
      "ShiftFit helps a manager decide who works when. You tell it when each student worker has class, and it shows you a week grid so you can make sure someone is working every hour.",
      "It won't put anyone in a spot where they have class, and it warns you if someone would work too many hours.",
    ],
    keywords: ["purpose", "about", "overview"],
  },
  {
    id: "first-steps",
    topic: "Getting started",
    question: "What's the fastest way to make a schedule?",
    answer: [
      "1. Press Add student on the left and type a name. Paste or type the student's class times.",
      "2. Press Fill schedule for me. ShiftFit places shifts for everyone.",
      "3. Look for pink boxes in the grid. Those hours still need someone. Click a pink box to assign a student who is free.",
    ],
    keywords: ["start", "begin", "tutorial", "how to"],
  },
  {
    id: "add-student",
    topic: "Getting started",
    question: "How do I add a student?",
    answer: [
      "Press Add student above the student list. Type their name, then paste their class times into the box. You will see each line checked right away: a green check means ShiftFit understood it.",
      "Then choose their preferences (morning or afternoon, how many days a week, when they must leave, lunch) and press Add student.",
    ],
    keywords: ["new", "create", "worker"],
  },
  {
    id: "class-time-format",
    topic: "Getting started",
    question: "How should I write class times?",
    answer: [
      "Any of these work, one class per line: MWF 9:00-9:50, TTh 1:00pm-2:15pm, or Tuesday/Thursday 8:00 AM - 9:15 AM. You can also paste the Meeting Patterns column straight from Workday.",
      "M = Monday, T = Tuesday, W = Wednesday, Th or R = Thursday, F = Friday. Weekend classes aren't part of the Monday to Friday schedule.",
    ],
    keywords: ["workday", "paste", "MWF", "TTh", "format"],
  },
  {
    id: "add-many",
    topic: "Getting started",
    question: "Can I add lots of students at once?",
    answer: [
      "Yes. Press “Add several at once” under the student list. Type one student per line: the name, a colon, then their class times. Separate several classes with a semicolon.",
      "You can also copy rows from a spreadsheet, with the name in the first column and the classes in the next ones. ShiftFit checks every line first and tells you which ones it can't read.",
    ],
    keywords: ["bulk", "many", "roster", "import", "spreadsheet", "paste", "list", "csv", "everyone"],
  },
  {
    id: "other-times",
    topic: "Getting started",
    question: "What if a student can't work at other times, like for a second job?",
    answer: [
      "In the student's form, use the box called “Any other times they can't work?”. Write those times the same way as classes, for example W 2:00pm-4:00pm.",
      "ShiftFit treats these exactly like class time: it won't schedule them there, and the schedule says “is unavailable” instead of “has class”.",
    ],
    keywords: ["job", "appointment", "practice", "busy", "unavailable", "blocked", "sports"],
  },
  {
    id: "am-pm-warning",
    topic: "Getting started",
    question: "Why does it say “No am/pm given”?",
    answer: [
      "If a time like 9:00 has no am or pm, ShiftFit makes a careful guess (for example, 9:00 is morning and 1:00 is afternoon) and tells you what it picked. Check the guess and add am or pm if it is wrong.",
      "ShiftFit would rather ask than quietly put a class in the wrong place.",
    ],
    keywords: ["warning", "ambiguous", "assumed"],
  },
  {
    id: "read-grid",
    topic: "The schedule",
    question: "What do the colors and patterns in the grid mean?",
    answer: [
      "Green: enough people are working. Pink with the words “Need 1”: this half hour still needs someone. Diagonal stripes: the student you picked can't work then (class, lunch, or too late).",
      "A blue outline means the student you picked is working in that box. The colored badges with letters show who is working. We never use color alone, so you can tell states apart by the words and patterns too.",
    ],
    keywords: ["legend", "pink", "green", "stripes", "colors"],
  },
  {
    id: "give-shift",
    topic: "The schedule",
    question: "How do I give someone a shift?",
    answer: [
      "Click a student on the left, then click boxes in the grid. Each box is 30 minutes. Click again to take the shift away.",
      "To do a whole stretch at once, press on the first box and drag down the column. Or click the first box, then hold Shift and click the last box in the same day.",
    ],
    keywords: ["assign", "manual", "click", "range", "shift-click"],
  },
  {
    id: "fill-for-me",
    topic: "The schedule",
    question: "What does “Fill schedule for me” do?",
    answer: [
      "It adds shifts for you, following every rule. It keeps the shifts you placed yourself and only adds new ones. It prefers longer, unbroken shifts instead of lots of tiny ones.",
      "“Rebuild automatic shifts” throws away only the shifts ShiftFit added before and makes them again. Shifts you placed by hand are never removed.",
      "It is not AI. It follows fixed rules, so the same students and settings always give the same schedule.",
    ],
    keywords: ["autofill", "auto-fill", "automatic", "ai", "rebuild"],
  },
  {
    id: "quick-fix",
    topic: "The schedule",
    question: "What are the “Quick fix” buttons?",
    answer: [
      "Under each time that needs someone, Schedule health shows a “Quick fix” row: buttons with the names of students who can really work then. Press one to give that student the whole stretch.",
      "If a student can only take part of it, the button says how much, for example “1 of 2 hours”. Press Undo if you change your mind.",
    ],
    keywords: ["fill", "gap", "suggest", "add", "pink", "empty", "who is free"],
  },
  {
    id: "why-cant-schedule",
    topic: "Rules",
    question: "Why won't it let me put someone in a box?",
    answer: [
      "Something is in the way. It tells you exactly what: the student has class, has to leave before then, is on lunch, is already at their weekly hours, or already works their maximum number of days.",
      "Hover over a striped box (or use the keyboard to move onto it) to read the reason.",
    ],
    keywords: ["blocked", "disabled", "can't", "unavailable"],
  },
  {
    id: "over-limit",
    topic: "Rules",
    question: "Can someone work more than their weekly hours?",
    answer: [
      "Class conflicts, late cutoffs and lunch can never be broken. But if a student is at their weekly hour limit or day limit, ShiftFit asks “Assign anyway?”. If you say yes, the shift is added and a warning stays visible in Schedule health so it isn't forgotten.",
      "The default weekly limit is 19 hours. You can change it under Rules. Check your own employer's policy: ShiftFit doesn't know it.",
    ],
    keywords: ["override", "19", "limit", "hours", "overtime"],
  },
  {
    id: "people-needed",
    topic: "Rules",
    question: "What does “People needed at once” mean?",
    answer: [
      "It is how many workers must be on duty at the same time. If you choose 2, then every half hour needs two people, and a box with only one person turns pink.",
    ],
    keywords: ["staff", "minimum", "per slot"],
  },
  {
    id: "opening-shift",
    topic: "Rules",
    question: "What is an “opening shift”?",
    answer: [
      "Some students need to start their week with a 7:00am shift. ShiftFit only counts it if they work at least one hour in a row starting at 7:00am, not a single lonely half hour.",
      "If you switch to 8:00am office hours, a 7:00am shift is outside the schedule you can see. It still counts toward that student's hours.",
    ],
    keywords: ["7am", "early", "open"],
  },
  {
    id: "two-percentages",
    topic: "Rules",
    question: "What is the difference between the two percentages?",
    answer: [
      "“Hours with enough people” counts every half hour where the minimum number of workers is present.",
      "“Staffing filled” counts every person needed. If you need 2 people and only 1 is working, the hour is not “enough people”, but half of the staffing is filled. Both are shown so you never get a misleading single number.",
    ],
    keywords: ["coverage", "percent", "fully staffed", "demand"],
  },
  {
    id: "students-needed",
    topic: "Rules",
    question: "Why does it say “students needed (best case)”?",
    answer: [
      "It is simple math: total hours to cover divided by the weekly limit. It pretends everyone is free at every hour, which is never true, so treat it as the fewest students you could possibly need, not a promise.",
    ],
    keywords: ["minimum students", "theoretical", "hire"],
  },
  {
    id: "where-saved",
    topic: "Saving & sharing",
    question: "Where is my schedule saved? Is it private?",
    answer: [
      "It is saved automatically in this web browser on this computer. Nothing is sent to a server, and you don't need an account.",
      "Because of that, it won't show up on another computer or browser. Use Save & share, then Save a backup file, to move it.",
    ],
    keywords: ["privacy", "storage", "ferpa", "data", "account", "cloud"],
  },
  {
    id: "lost-schedule",
    topic: "Saving & sharing",
    question: "I switched computers (or cleared my browser) and my schedule is gone. Help!",
    answer: [
      "ShiftFit can only remember what is stored in the browser you are using. If you cleared browsing data or changed computers, that copy is gone.",
      "To be safe, use Save & share → Save a backup file now and then. To restore, use Load a backup file. Backups contain student names and class times, so keep the file somewhere private.",
    ],
    keywords: ["backup", "restore", "lost", "missing", "import", "export"],
  },
  {
    id: "undo",
    topic: "Good to know",
    question: "Can I undo a mistake?",
    answer: [
      "Yes. Use the Undo button at the top, or press Ctrl+Z (Command+Z on a Mac). It works for everything, including removing a student, clearing shifts, or loading a backup. Redo is Ctrl+Shift+Z.",
    ],
    keywords: ["redo", "oops", "mistake", "ctrl z"],
  },
  {
    id: "send-schedule",
    topic: "Saving & sharing",
    question: "How do I send someone their schedule, or post it on a wall?",
    answer: [
      "Above the schedule, choose “By student” to see each person's shifts written out, or “By day” to see who works each day.",
      "Press Copy as text to paste it into a message or email, or Print to get a clean page with no buttons.",
    ],
    keywords: ["share", "text", "email", "print", "post", "list", "copy", "paper"],
  },
  {
    id: "calendar-file",
    topic: "Saving & sharing",
    question: "Can students put their shifts on their phone calendar?",
    answer: [
      "Yes. In Save & share, enter the first and last day of the semester and your timezone (ShiftFit never guesses these), then download a calendar file for each student. Opening it adds their weekly shifts to Google, Apple or Outlook calendar.",
      "Add holidays and breaks under “Days off” first. Shifts that fall on those days are left out. If you skip this step, shifts repeat on holidays too.",
    ],
    keywords: ["ics", "google calendar", "apple", "outlook", "phone"],
  },
  {
    id: "screenshots",
    topic: "Good to know",
    question: "Can ShiftFit read a screenshot of a class schedule?",
    answer: [
      "Only if your organization has set up a reading service for it. If that button is greyed out, it isn't set up here. Typing or pasting the class times always works and is checked instantly.",
      "Even when it is set up, ShiftFit shows you what it found and waits for you to approve before saving anything.",
    ],
    keywords: ["image", "upload", "ocr", "photo", "picture"],
  },
  {
    id: "keyboard",
    topic: "Good to know",
    question: "Can I use it without a mouse?",
    answer: [
      "Yes. Press Tab to move between parts of the page. Inside the schedule, use the arrow keys to move between boxes and press Enter or Space to add or remove a shift. Hold Shift while pressing Enter to fill a whole stretch.",
      "Press ? anywhere to open this Help.",
    ],
    keywords: ["accessibility", "keyboard", "screen reader", "shortcuts"],
  },
];

export type GlossaryItem = { term: string; meaning: string };

export const GLOSSARY: GlossaryItem[] = [
  { term: "Shift", meaning: "A stretch of time when a student is working, like Monday 9:00am to 1:00pm." },
  { term: "Box (slot)", meaning: "One 30-minute square in the schedule grid. Shifts are made of boxes." },
  { term: "Covered", meaning: "Enough people are working during that half hour." },
  { term: "Gap", meaning: "A time when too few people are working. Shown in pink." },
  { term: "Class block", meaning: "A time when a student is in class and can't work." },
  { term: "Must leave by", meaning: "The latest time a student can work. ShiftFit won't schedule them past it." },
  { term: "Opening shift", meaning: "A required shift starting at 7:00am, lasting at least one hour." },
  { term: "Weekly limit", meaning: "The most hours a student may work in one week. The default is 19." },
  { term: "Assign anyway", meaning: "Going past a weekly hour or day limit on purpose. Allowed, but flagged with a warning." },
  { term: "Conflict", meaning: "A shift that breaks a rule, such as a shift during a class. Fix these before publishing." },
  { term: "Backup file", meaning: "A small file with all your students and shifts that you can save and load later." },
];

export type ShortcutItem = { keys: string; action: string };

export const SHORTCUTS: ShortcutItem[] = [
  { keys: "Ctrl + Z  (⌘ Z on Mac)", action: "Undo" },
  { keys: "Ctrl + Shift + Z  (or Ctrl + Y)", action: "Redo" },
  { keys: "?", action: "Open Help" },
  { keys: "Arrow keys (in the schedule)", action: "Move between boxes" },
  { keys: "Enter or Space (in the schedule)", action: "Add or remove a shift" },
  { keys: "Shift + click, or Shift + Enter", action: "Fill or clear everything from the last box to this one" },
  { keys: "Esc", action: "Close a window" },
];
