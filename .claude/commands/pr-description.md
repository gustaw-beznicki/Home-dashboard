# PR Description

Generate a pull request description for a GitHub PR or the current branch.

## Usage

`/write-pr-description [PR_NUMBER]`

If `$ARGUMENTS` is empty, describe the current branch against `main`.
If `$ARGUMENTS` is a PR number, fetch that PR from GitHub and describe it.

## Process

### Step 1 — Gather diff information

Determine the repo owner and name from: `git remote get-url origin`

**If a PR number was provided:**

Run:

```sh
gh pr view $ARGUMENTS --json title,body,number,headRefName,baseRefName,commits,files
gh pr diff $ARGUMENTS
```

`gh pr diff` has no `--stat` flag — the `files` array from `gh pr view` already gives per-file additions/deletions. Always fetch the full diff with `gh pr diff $ARGUMENTS` and read it to write the description.

**If no PR number was provided (current branch):**

Run:

```sh
git log main..HEAD --oneline
git diff main...HEAD --stat
```

### Step 2 — Inspect key commits

For each commit on the branch (up to 10), read what it actually changed — not just the message.
If a PR number was given, use `gh pr diff $ARGUMENTS` to get the full diff.
If working from the current branch, use `git diff main...HEAD`.

Focus on:

- New files added
- Schemas or types changed
- Components created or modified
- Config or feature flag changes
- Any ADR documents added or updated

### Step 2.5 — Detect UI changes

Check if the diff touches any files that produce visible output — components, styles, or content fed into rendered pages:

```sh
git diff main...HEAD --name-only | grep -E '\.(astro|tsx|jsx|css)$|tailwind\.config|src/content/'
```

(If a PR number was provided, use `gh pr diff $ARGUMENTS --name-only` instead.)

If any matches exist, set **UI_CHANGED=true** and note which files/routes were affected.

> **Why `src/content/`?** In Astro content-driven sites, `.ts` files under `src/content/` are the sole source of copy rendered into pages. Changing them is a UI change even though they carry no `.astro`/`.css` extension.

### Step 2.6 — Capture screenshots (mandatory when UI_CHANGED=true)

**Do not hand back a UI pull request with an empty screenshot table.** "I have no browser tool" is
not an answer — Playwright is a hard dependency of this command. Install it and take the pictures.

**1. Ensure Playwright is present.** It is a devDependency; if absent, add it. The browser binary is
a separate download and is also required:

```sh
node -e "require.resolve('playwright')" 2>/dev/null || npm install -D playwright
npx playwright install chromium
```

`npx playwright install chromium` is a ~130 MB download on a cold cache and takes a minute or two.
That is expected — run it and wait rather than giving up and stubbing the table.

**2. Serve the app.** Screenshots need the app actually running:

```sh
npm run db:migrate:local && npm run db:seed:local
npm run dev-no-auth
```

`dev-no-auth` exists precisely so this works without Google OAuth credentials (ADR 0011), and the
seed gives the list something on it. Wait ~30 s: the script builds the frontend before wrangler
starts, and wrangler serves built assets from `dist/`.

**3. Capture.**

```sh
node scripts/screenshot-pr.mjs --out docs/screenshots/pr-$ARGUMENTS
```

That script owns the shot list — mobile and desktop, light and dark, plus the task sheet, the rhythm
editor and the admin page. Edit the `SHOTS` array there rather than reinventing the capture logic
here. It also reports browser console errors per shot; **read those**, since a screenshot can look
perfectly fine while the console is full of errors, which is exactly what a reviewer would miss.

**4. Look at the images.** Use the `Read` tool on each PNG. This is the point of the exercise — you
are verifying the UI renders, not generating attachments. If something is visibly broken, say so in
the PR description instead of quietly attaching a picture of the bug.

**5. Make them visible in the PR.** GitHub has no public API for uploading images to a PR body, so
committing them to the branch and linking raw URLs is the only way they render without the user
dragging files in:

```sh
git add docs/screenshots/pr-$ARGUMENTS && git commit -m "Add PR screenshots" && git push
```

Reference them with absolute raw URLs pinned to the branch, not relative paths — relative paths do
not resolve in PR bodies:

```markdown
![Dashboard, mobile](https://raw.githubusercontent.com/<owner>/<repo>/<branch>/docs/screenshots/pr-N/dashboard-mobile-light.png)
```

Ask before committing binaries if the repo has no precedent for it — some projects would rather the
images stayed out of git history. If the user declines, leave the files on disk and give them the
paths to drag in.

**Killing the dev server afterwards, on Windows:** `pkill -f "wrangler dev"` does **not** work. The
listeners are `workerd.exe` processes with `node.exe` wrangler parents, and orphans left on the port
will silently serve stale code and stale env to every subsequent request — which reads exactly like a
code bug and is not one. Kill them properly:

```sh
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*wrangler*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }; Get-Process workerd -ErrorAction SilentlyContinue | Stop-Process -Force"
```

Verify with `netstat -ano | grep 8787` before starting another run.

### Step 3 — Write the description

Output the description in this exact format. Write concrete sentences — no filler, no vague summaries.

**When UI_CHANGED=false:**

```markdown
## What changed
<!-- One sentence overview of the PR -->

**Area name (route or system)**
- Specific change — what it does and why it matters
- Another specific change

**Another area**
- ...

## Why
<!-- Motivation or linked issue -->

## How to test
<!-- Steps to verify locally or on preview deploy -->

## Checklist
- [ ] Tested locally (`npm run dev-no-auth`)
- [ ] Build passes (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] No secrets in diff
```

**When UI_CHANGED=true**, add a `## Screenshots` section after `## How to test` and one extra checklist item:

```markdown
## What changed
<!-- One sentence overview of the PR -->

**Area name (route or system)**
- Specific change — what it does and why it matters

## Why
<!-- Motivation or linked issue -->

## How to test
<!-- Steps to verify locally or on preview deploy -->

## Screenshots

Captured with `node scripts/screenshot-pr.mjs` against `npm run dev-no-auth` and the local seed.

| Mobile (390px) | Desktop (1440px) |
|----------------|------------------|
| ![...](raw URL) | ![...](raw URL) |

<!-- Add a dark-mode row, and a row for any distinctive state the PR introduces
     (a new sheet, an empty state, an error state). Caption what the reviewer
     should be looking at, not just the route. -->

## Checklist
- [ ] Tested locally (`npm run dev-no-auth`)
- [ ] Build passes (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] No secrets in diff
- [ ] Screenshots reviewed, not just attached
```

Rules for each section:

**What changed** — start with one plain sentence that summarises the PR in full. Then group bullets under **bold subheadings** by area. Good subheading examples: `Home page (/)`, `Services (/uslugi, /uslugi/[slug])`, `Schema changes (Service)`, `Architecture`, `Components`, `Config`. Each bullet names the concrete thing that changed and what it does — never write "various files updated" or "minor improvements". Include route paths in parentheses when the area is a page.

**Why** — one short paragraph. Explain the user-facing or developer-facing problem this solves. Reference any ADR added or updated (e.g. "See ADR-0016").

**How to test** — numbered steps a reviewer can follow locally or on a preview deploy. Be specific: name the URL, the Studio document, or the config flag to toggle. When UI_CHANGED=true, include a step to visually verify the affected routes/components.

**Screenshots** — only present when UI_CHANGED=true, and it must contain **real images captured in Step 2.6**, not placeholders. Caption each one with what the reviewer should be looking at. If a shot failed or a state could not be reached (a login screen is unreachable under `dev-no-auth`, for instance), say which and why rather than leaving a silent gap.

**Checklist** — always include exactly as shown above, all unchecked; the author ticks them. Add the screenshots item only when UI_CHANGED=true. Do not pre-tick items on the author's behalf — but do state plainly in the body which of them you actually verified and which you did not.

### Step 4 — Present and offer to post

Show the description to the user.

If a PR number was provided, use the `AskUserQuestion` tool to ask:

- Question: "Post this as the PR description?"
- Option 1 label: "Yes, post it" — description: runs `gh pr edit $ARGUMENTS --body "<description>"`
- Option 2 label: "No, just copy" — description: leaves it as text for the user to copy

If the user selects "Edit first" or provides custom input, apply their feedback, show the revised description, and ask again.

If no PR number was provided, just output the description — do not post anywhere.
