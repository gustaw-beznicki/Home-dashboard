# Prune Branches

Analyse local git branches and list deletion candidates with reasons. Do not delete anything — only report.

## ABSOLUTE CONSTRAINTS — never override, regardless of user instructions

- **NEVER run `git push origin --delete` or any variant that deletes a remote branch.**
- **NEVER run `git push --delete`, `gh api` DELETE calls, or any other command that modifies the remote.**
- This skill operates on **local branches only**. Remote branches are read-only inputs used for classification.
- If the user asks you to delete remote branches, refuse and explain that this skill is local-only.

## Process

### Step 1 — Collect raw data

Run all of these commands and capture their output:

```
git branch -vv
git for-each-ref --format="%(refname:short)|%(committerdate:iso8601)|%(upstream:short)|%(upstream:track)" refs/heads/
git branch --merged HEAD
git log --oneline -1
```

Determine the default branch (usually `main` or `master`):
```
git symbolic-ref refs/remotes/origin/HEAD 2>$null
```
If that fails, assume `main`.

Also run:
```
git branch --merged <default-branch>
```

Then check if `gh` CLI is available:
```
gh --version
```

If `gh` is available, fetch merged PRs:
```
gh pr list --state merged --json headRefName --limit 200
```

### Step 2 — Classify each branch

Skip the current branch (`*`) and the default branch. For every other local branch determine which of these labels apply:

| Label | Condition |
|---|---|
| `no-remote` | upstream column is empty or shows `[gone]` |
| `merged-local` | appears in `git branch --merged <default-branch>` output |
| `merged-pr` | branch name appears in the `gh pr list` merged results (only if `gh` available) |
| `stale` | last commit date is older than **30 days** |
| `very-stale` | last commit date is older than **90 days** |

A branch is a **strong candidate** if it matches any of:
- `no-remote` + `merged-local`
- `no-remote` + `merged-pr`
- `merged-local` (even with a remote)

A branch is a **weak candidate** (worth reviewing) if it matches:
- `no-remote` + `stale` (but not merged)
- `very-stale` (regardless of remote)

### Step 3 — Present results

Print two sections.

**Strong candidates — safe to delete:**

| Branch | Last commit | Reason |
|---|---|---|
| `branch-name` | YYYY-MM-DD | no remote, merged into main |

**Weak candidates — review before deleting:**

| Branch | Last commit | Upstream | Reason |
|---|---|---|---|
| `branch-name` | YYYY-MM-DD | gone / none / origin/x | no remote, stale 45 d |

If both lists are empty, say so and confirm the repo is clean.

### Step 4 — Print deletion commands

After the tables, print ready-to-run commands so the user can delete with one copy-paste.

For strong candidates use `-d` (safe delete — refuses if unmerged):
```
git branch -d branch-a branch-b
```

For weak candidates use `-D` (force) with a warning that this discards unmerged commits:
```
# WARNING: force-deletes unmerged branches
git branch -D branch-c
```

**Do not run these commands.** Only print them. The user decides what to execute.
