# Team workflow (Git & GitHub, for beginners)

This is the step-by-step guide for the Cadence team working on ShiftFit together. It assumes
you have never used Git or GitHub before. Every command below is one you type into a terminal.

- **Repository:** https://github.com/p00rmanS/cadence
- **Default branch:** `master` (not `main` — this project started before it was pushed to
  GitHub, so it kept its original branch name. Everything below uses `master`.)
- **Project folder:** the repository *is* the ShiftFit app — there's no extra subfolder to `cd`
  into after cloning. `package.json`, `src/`, etc. sit right at the top.

If you get stuck on any step, stop and ask in the team chat before guessing — Git mistakes are
almost always fixable, but it's easier to fix them before more work is piled on top.

---

## 1. James: invite your teammates to the repository

Only needs to be done once per teammate, by whoever owns the repo (James).

1. Go to https://github.com/p00rmanS/cadence in a browser.
2. Click **Settings** (top menu of the repo, not your account settings).
3. In the left sidebar, click **Collaborators**.
4. Click **Add people**, and type each teammate's GitHub username or the email they used to
   sign up for GitHub.
5. GitHub sends them an invite email (and shows a notification on GitHub). They need to click
   **Accept** before they can push anything.

If the repository is **private**, this step is required before anyone else can even see it. If
it's **public**, anyone can view and clone it, but they still need to be added as a collaborator
(or use a pull request from their own fork) to push branches directly.

---

## 2. Everyone: get the project running on your own computer

Do this once, the first time you set up the project on a computer.

1. **Install Git**, if you don't have it: https://git-scm.com/downloads
2. **Install Node.js** (needed to run the app), if you don't have it: https://nodejs.org
   (the LTS version is fine).
3. **Clone the repository** — this downloads a full copy of the project:
   ```bash
   git clone https://github.com/p00rmanS/cadence.git
   cd cadence
   ```
4. **Install the project's dependencies** (libraries the app needs — this reads `package.json`):
   ```bash
   npm install
   ```
5. **Run the app locally**, to check it works:
   ```bash
   npm run dev
   ```
   Then open http://localhost:5173 in your browser. Press `Ctrl+C` in the terminal to stop it.

Other commands you'll use while working:

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the production version (and type-checks everything) |
| `npm test` | Runs the whole automated test suite and prints how many passed |
| `npm run lint` | Type-checks the code without building |

Run `npm test` and `npm run lint` before you consider a change finished — both should say
everything passed, with no errors.

---

## 3. Start a new branch for your task

**Never work directly on `master`.** A branch is your own private copy of the project to make
changes in, without affecting anyone else until your work is reviewed.

1. Make sure you're on `master` and it's up to date:
   ```bash
   git checkout master
   git pull origin master
   ```
2. Create your branch, with a name that says who you are and what you're doing (all lowercase,
   words separated by hyphens):
   ```bash
   git checkout -b yourname-short-feature-name
   ```
   Examples: `christroi-availability-form`, `jared-calendar-sync`, `austin-report-export`.
   James's UI/UX branch is already created and called `james-ui-design`.

You're now on your own branch. Anything you do next won't affect `master` or anyone else's
branch until you open a pull request (step 6) and someone merges it.

---

## 4. Make your changes, then check and stage them

As you edit files:

1. **See what you've changed:**
   ```bash
   git status
   ```
   This lists modified, new, and deleted files.
2. **Look at the actual changes**, to check you're not including anything by accident:
   ```bash
   git diff
   ```
3. **Stage the specific files you want to commit** (don't just stage everything blindly —
   choose the files that belong to this change):
   ```bash
   git add path/to/file1 path/to/file2
   ```
4. **Commit** — this saves a snapshot with a short message explaining what changed:
   ```bash
   git commit -m "Add availability form validation"
   ```

You can repeat steps 1–4 as many times as you like while working — lots of small, clear commits
are better than one giant one.

---

## 5. Push your branch to GitHub

The first time you push a new branch:
```bash
git push -u origin yourname-short-feature-name
```
(`-u` tells Git to remember this branch's home on GitHub, so next time you can just run
`git push`.)

After that, for the same branch:
```bash
git push
```

---

## 6. Open a pull request (PR) and get it reviewed

A pull request is a request to merge your branch into `master`, with a place for teammates to
comment before it happens.

1. Go to https://github.com/p00rmanS/cadence in a browser. GitHub usually shows a banner
   "Compare & pull request" for a branch you just pushed — click it. If not, click **Pull
   requests** → **New pull request**, and choose your branch to merge into `master`.
2. Write a short title and description: what you changed and why.
3. Click **Create pull request**.
4. Ask a teammate to review it (GitHub lets you request a specific reviewer in the sidebar).
5. Once it's approved, click **Merge pull request** on GitHub. Then, locally:
   ```bash
   git checkout master
   git pull origin master
   ```
   to bring the merged change into your own `master`.

**Nobody merges their own PR without a review**, and nobody pushes directly to `master` — every
change to `master` comes in through a reviewed pull request.

---

## 7. Get the latest shared changes before starting a new task

Before starting anything new, update your local `master` so you're building on everyone else's
latest merged work:
```bash
git checkout master
git pull origin master
git checkout -b yourname-next-feature-name
```

If you're continuing on an existing branch and want to bring in the latest `master`:
```bash
git checkout yourname-your-branch
git merge master
```

---

## 8. If a merge conflict happens

A conflict means two people changed the same lines of the same file, and Git can't tell which
version to keep — it needs a human to decide. This is normal, not a disaster.

1. Git will tell you which file(s) have conflicts. Open them in your editor. Conflicted spots
   look like this:
   ```
   <<<<<<< HEAD
   your version of the lines
   =======
   the other version of the lines
   >>>>>>> master
   ```
2. Decide what the final version should look like — keep one side, the other, or a combination
   of both — and delete the `<<<<<<<`, `=======`, and `>>>>>>>` marker lines entirely.
3. Save the file, then:
   ```bash
   git add path/to/the/file
   git commit
   ```
4. If you're not sure what the right resolution is (especially in code you didn't write),
   **ask the teammate whose change you're conflicting with** before deciding — don't guess.

---

## 9. Coordinate before editing the same files

Two people editing the same file at the same time is the #1 cause of merge conflicts and lost
work. Before starting a task, a quick message to the team — "I'm about to edit
`ScheduleGrid.tsx`, anyone else in there?" — saves everyone time later. If your task will touch
files someone else is already working on, talk first.

---

## 10. Never commit secrets

**Never commit** passwords, API keys, tokens, or your real `.env` file. This project's
`.gitignore` already excludes `.env` and `.env.*` (but not `.env.example`, which is a safe
template with no real values) — check `git status` before committing and make sure nothing that
looks like a real secret is in the list of files you're about to add. If you ever do commit a
secret by mistake, tell the team immediately — the key needs to be rotated (replaced), not just
deleted from a later commit, because it still exists in the project's history.
