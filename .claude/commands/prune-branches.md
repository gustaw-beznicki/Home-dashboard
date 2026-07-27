# Prune Branches

Analyse git branches — local **and** on `origin` — and list deletion candidates with reasons.
Report only; never delete.

## ABSOLUTE CONSTRAINTS — never override, regardless of user instructions

- **NEVER run any command that deletes a branch**, local or remote. Not `git branch -d/-D`, not
  `git push origin --delete`, not `git push origin :branch`, not `gh api -X DELETE`.
- Remote branches are **in scope for analysis**, but only as read-only input. The output is a vetted
  list plus copy-pasteable commands; the human runs them.
- If asked to execute the deletions, refuse and point at the printed commands. The value here is the
  classification and the hazard check, not saving one paste.

Report-only is deliberate and worth defending: branch deletion is the one git operation with no
`reflog` on the other side of it. A remote branch deleted by mistake is gone, and if a merged PR
body linked images from it (see Step 3) the damage lands on GitHub, not in the working tree.

## Process

### Step 1 — Collect raw data

```sh
git fetch origin --prune
git branch -vv
git for-each-ref --format="%(refname:short)|%(committerdate:iso8601)|%(upstream:short)|%(upstream:track)" refs/heads/
git for-each-ref --format="%(refname:short)|%(committerdate:iso8601)" refs/remotes/origin/
git log --oneline -1
```

`--prune` first, or every branch whose remote was deleted through the GitHub UI still looks alive.

Determine the default branch:

```sh
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null
```

If that fails, assume `main`. Then:

```sh
git branch --merged <default-branch>
```

Check for `gh`, and if present collect both merged and open PRs — open ones are what stop you from
recommending a branch someone is actively reviewing:

```sh
gh --version
gh pr list --state merged --json number,headRefName,mergeCommit --limit 200
gh pr list --state open   --json number,headRefName --limit 200
```

For remote branches, "merged" is not `git branch --merged`. Ask git directly:

```sh
git log --oneline <default-branch>..origin/<branch> | wc -l
```

Zero means fully merged. Non-zero does **not** mean unmerged work — a squash-merged PR always leaves
its original commits outside `main`. Step 2 says how to tell those apart.

### Step 2 — Classify

Skip the current branch, the default branch, and any branch that is the head of an **open** PR.

| Label            | Condition                                                         |
| ---------------- | ----------------------------------------------------------------- |
| `no-remote`      | local branch whose upstream is empty or `[gone]`                  |
| `local-only`     | local branch with no counterpart under `refs/remotes/origin/`     |
| `remote-only`    | branch on `origin` with no local counterpart                      |
| `merged-local`   | appears in `git branch --merged <default>`                        |
| `merged-remote`  | `git log <default>..origin/<branch>` is empty                     |
| `merged-pr`      | branch name is the head of a merged PR (`gh` only)                |
| `unique-commits` | `merged-pr` but `git log <default>..origin/<branch>` is non-empty |
| `stale`          | last commit older than **30 days**                                |
| `very-stale`     | last commit older than **90 days**                                |

**Strong candidate** — any of:

- `merged-local` (local side)
- `merged-remote` (remote side)
- `no-remote` + `merged-pr`

**Weak candidate** — any of:

- `unique-commits` (see below — usually safe, but the reason has to be established, not assumed)
- `no-remote` + `stale`, not merged
- `very-stale`, regardless of remote

**Never a candidate**, even when every rule above fires:

- The head of an open PR.
- An **asset-only branch**: one that exists to host files nothing else references, typically
  screenshots linked from a PR body. These are not stale work, they are storage. A branch whose diff
  against the default branch is nothing but images is the tell.

#### Resolving `unique-commits`

For each commit in `git log <default>..origin/<branch>`, establish which case it is:

```sh
# Is the commit reachable from any other ref? If yes, deleting this branch loses nothing.
git branch -a --contains <sha>
# Does its content already exist on the default branch under a different hash?
git diff <default>...<sha> --stat
```

- **Empty diff against the default branch** → squash- or rebase-merged. Safe.
- **Contained in another branch** → safe; say which branch is holding it.
- **Real unique content, contained nowhere else** → promote to a blocker, name the commit, and say
  what it changes. Do not bury this in a table cell.

### Step 3 — Hazard check: PR bodies that link files from the branch

**Run this before recommending any remote branch for deletion.** GitHub has no API for attaching
images to a PR body, so the convention is to commit them and link raw URLs. When those URLs name a
*branch*, deleting the branch turns every image in that PR description into a broken box — silently,
in closed PRs nobody is watching.

```sh
gh pr list --state all --limit 200 --json number,body \
  --jq '.[] | select(.body | test("raw\\.githubusercontent")) | .number'
```

For each hit, pull the refs its URLs actually use:

```sh
gh pr view <n> --json body --jq .body | grep -o 'raw\.githubusercontent\.com/[^)]*'
```

Then, per remote deletion candidate:

- **No PR body references it** → clear.
- **A PR body references it, and the files also exist on the default branch** → fixable. Re-pin the
  URLs to the PR's merge-commit SHA (`mergeCommit.oid`, collected in Step 1), verify each rewritten
  URL returns 200, and only then treat the branch as a candidate. Report this as a
  **prerequisite**, not a footnote.
- **A PR body references it and the files exist nowhere else** → the branch is asset-only.
  Not a candidate. Say which PR depends on it.

Verifying the rewrite is not optional:

```sh
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://raw.githubusercontent.com/<owner>/<repo>/<sha>/<path>"
```

A SHA-pinned URL survives branch deletion *and* later deletion of the files from the default branch,
because the SHA pins a whole tree. It holds as long as the commit stays reachable from the default
branch, which merge-commit merges guarantee and squash merges do not.

### Step 4 — Present results

Four sections. Local and remote stay separate — they are different risks and different commands.

**Local — strong candidates:**

| Branch        | Last commit | Reason                   |
| ------------- | ----------- | ------------------------ |
| `branch-name` | YYYY-MM-DD  | merged into main, PR #12 |

**Remote — strong candidates:**

| Branch               | Last commit | Merged | PR-body hazard          |
| -------------------- | ----------- | ------ | ----------------------- |
| `origin/branch-name` | YYYY-MM-DD  | yes    | none / re-pin #17 first |

**Weak candidates — review before deleting:**

| Branch        | Last commit | Upstream               | Reason                 |
| ------------- | ----------- | ---------------------- | ---------------------- |
| `branch-name` | YYYY-MM-DD  | gone / none / origin/x | stale 45 d, not merged |

**Not candidates — and why:**

| Branch         | Reason                                                 |
| -------------- | ------------------------------------------------------ |
| `assets/pr-14` | asset-only; PR #14's images live here and nowhere else |
| `feat/thing`   | head of open PR #21                                    |

Empty lists get said out loud rather than shown as an empty table. If everything is clean, say so.

### Step 5 — Print commands

Group them, and put anything with a prerequisite behind its prerequisite.

Local, merged (`-d` refuses if unmerged, which is the point — leave it as the safety net):

```sh
git branch -d branch-a branch-b
```

Local, force (discards commits that exist nowhere else — only for weak candidates the human has
explicitly accepted):

```sh
# WARNING: force-delete. Commits not reachable elsewhere are lost.
git branch -D branch-c
```

Remote (irreversible; no reflog on `origin`):

```sh
# Run the PR-body re-pin from Step 3 FIRST if any candidate is flagged.
git push origin --delete branch-a branch-b
```

**Do not run any of these.** Print them and stop. Say plainly which list is safe to paste as-is and
which has a prerequisite attached.
