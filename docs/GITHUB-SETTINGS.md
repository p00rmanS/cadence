# GitHub settings for this repository

This file records how the repository on GitHub (`p00rmanS/cadence`) is protected, and the exact
commands used, so the setup can be checked, repeated, or changed later. Everything here can also be done
by clicking through the repository's **Settings** page on github.com.

Last set up: 2026-09-24, by the repository owner using the GitHub command-line tool (`gh`).

## What is switched on

| Setting | State | Why |
| --- | --- | --- |
| Ruleset **"Protect master"** | Active on the default branch (`master`) | Nobody, including the owner, can push straight to `master`. Every change arrives through a reviewed pull request. |
| ...pull request required | 1 approval; review conversations must be resolved | A second person looks at every change before it goes live. |
| ...block deleting `master` | On | A slip cannot delete the main branch. |
| ...block force-pushes | On | Nobody can rewrite the shared history. |
| ...bypass | Repository admins, **for pull requests only** | The owner is never locked out, but can still only change `master` through a pull request. |
| Dependabot alerts | On | GitHub warns us if a library we use has a known security hole. |
| Dependabot security updates | On | GitHub opens a pull request that fixes such a hole. Review it like any other pull request. |
| Secret scanning + push protection | On (GitHub enables these for public repositories) | A commit containing a password or key is blocked before it reaches GitHub. |

GitHub Pages publishes `master`, so protecting it also protects the live website.

## One-time tool setup (Windows, macOS or Linux)

1. Install the GitHub command-line tool. Windows: `winget install --id GitHub.cli`. Mac: `brew install gh`.
2. Close and reopen the terminal (so it finds the new command).
3. Sign in: `gh auth login` and choose GitHub.com, HTTPS, "Login with a web browser".
4. Check: `gh auth status` should say you are logged in.

The account used must be an **admin** of the repository to change these settings.

## The commands used

Look at what is currently set (safe, changes nothing):

```bash
gh api repos/p00rmanS/cadence/rulesets
gh api repos/p00rmanS/cadence/rules/branches/master
gh api repos/p00rmanS/cadence --jq '.security_and_analysis'
```

Create the "Protect master" ruleset. Save the JSON below as `ruleset.json`, then run the command under it:

```json
{
  "name": "Protect master",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    }
  ]
}
```

```bash
gh api -X POST repos/p00rmanS/cadence/rulesets --input ruleset.json
```

(`~DEFAULT_BRANCH` means "whatever the default branch is", here `master`. `actor_id` 5 is GitHub's built-in
"Repository admin" role.)

Turn on the security alerts:

```bash
gh api -X PUT repos/p00rmanS/cadence/vulnerability-alerts
gh api -X PUT repos/p00rmanS/cadence/automated-security-fixes
```

## How to check it is working

- `gh api repos/p00rmanS/cadence/branches/master --jq .protected` prints `true`.
- Open any pull request into `master`. It shows **"Review required"** and the Merge button is blocked
  until someone approves it.

## How to change or remove it

- List rulesets and their ids: `gh api repos/p00rmanS/cadence/rulesets --jq '.[] | {id, name}'`
- Turn a ruleset off without deleting it: on github.com go to **Settings, Rules, Rulesets**, open it and set
  **Enforcement status** to *Disabled*.
- Delete it: `gh api -X DELETE repos/p00rmanS/cadence/rulesets/<id>`

## GitHub Pages (the public website)

The website is published to **https://p00rmans.github.io/cadence/** by `.github/workflows/deploy-pages.yml`,
every time `master` changes. This is the team's only deployment (no Netlify for now). GitHub Pages can only host
the website, so the server parts (gateway, scheduler service) are not running anywhere; the app works fully in the
browser, with Google Calendar in practice-run mode. See the README's "Deploy" section.

**One-time setup** (repository admin), **done 2026-09-30**: Settings -> **Pages** -> Build and deployment ->
Source: **GitHub Actions**. Or with the command-line tool:

```bash
gh api -X POST repos/p00rmanS/cadence/pages -f build_type=workflow
```

Then either merge a pull request into `master`, or start it by hand: Actions tab -> "Deploy to GitHub Pages" ->
Run workflow. The first deploy takes a few minutes; the address appears on the run's summary page.

**Later, if a server host is chosen:** Settings -> Secrets and variables -> Actions -> **Variables** tab -> New
repository variable: `VITE_AUTOMATION_API_URL` = the server's address. It is a *variable*, not a secret, because it
ends up in the public website anyway; never put a password there. On the server, set
`ALLOWED_ORIGINS=https://p00rmans.github.io` so it accepts calls from the github.io site. Until then, leave the
variable unset.

**Security note:** GitHub Pages can't send security headers, so the security policy is written into the page
itself (`src/lib/contentSecurityPolicy.ts`). One protection is lost: other websites can show the github.io site
inside a frame. Saved schedules are still safe from that, because browsers keep a framed site's saved data
separate from the real one.

### Shared address (important for student data)

Every GitHub Pages site of one account lives under the same address, `https://p00rmans.github.io`. Browsers treat
that as **one website**, so code on any of those sites can read what Cadence saved in the browser (student names,
class times, photos). Checked 2026-09-30: the account has one other Pages site, `p00rmans.github.io/netmon/`; it
loads no outside scripts, so there is no known problem today. To keep it that way:

- Never add outside scripts (analytics, chat widgets, ads) to **any** Pages site on this account.
- Better, when the team is ready: give Cadence its own address. Either create a free GitHub **organization** for
  the team (for example `cadence-team`) and move the repository there, so the site becomes
  `https://cadence-team.github.io/cadence/` (a separate address; this also suits a team project), or connect a
  custom domain in Settings -> Pages.

## Automatic checks on every pull request

`.github/workflows/ci.yml` runs the type check, every test and the build on GitHub's computers for every pull
request and every change to `master`. A pull request shows a green tick or a red X next to "Checks".

To make the checks **required** (a pull request can't be merged while they fail), add this rule to the
"Protect master" ruleset (Settings -> Rules -> Rulesets -> Protect master -> Require status checks to pass ->
add `checks`), or add this to `ruleset.json` above and update the ruleset:

```json
{ "type": "required_status_checks", "parameters": { "strict_required_status_checks_policy": false, "required_status_checks": [{ "context": "checks" }] } }
```

Wait until the workflow has run at least once, so GitHub knows the `checks` name.

## Things this does not do

- The repository is **public**. It contains no secrets or personal data (checked across the whole history), but
  anyone can read the code. Switching to private is under **Settings, General, Danger Zone**.
