# Fix PR Review Comments Interactively

Fix reviewer comments on a GitHub pull request one at a time, waiting for explicit user approval before moving to the next comment or committing anything.

## Usage
`/fix-pr-comments <PR_NUMBER>`

## Process

You are given a PR number in `$ARGUMENTS`. Follow this exact interactive loop:

### Step 1 — Fetch unresolved review comments
Determine the repo owner and name from: `git remote get-url origin`

Fetch review threads via GraphQL, which exposes the resolved status:
```
gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
            isOutdated
            comments(first: 100) {
              nodes {
                author { login }
                body
                path
                line
                originalLine
                diffHunk
              }
            }
          }
        }
      }
    }
  }
' -f owner=OWNER -f repo=REPO -F pr=PR_NUMBER
```

Also run `gh pr view $ARGUMENTS --comments --json comments` to get any general (non-inline) PR-level comments.

**Discard any thread where `isResolved: true`.** Outdated threads (`isOutdated: true`) should still be shown but flagged as outdated — the code changed since the comment was left, so interpret the concern rather than the exact line.

List only the unresolved comments, numbered. Tell the user how many there are total and how many were skipped as already resolved.

### Step 2 — Work through comments one at a time

For each comment, in order:

1. **Show the comment in full:**
   - Reviewer name
   - File path and line number (if inline)
   - The comment text verbatim
   - Any suggested code snippet the reviewer provided

2. **Make the fix:**
   - Read the relevant file
   - Apply the minimal change that addresses the reviewer's concern
   - If the fix is ambiguous, explain your interpretation before applying it

3. **Show what changed:**
   - Display the before/after diff for the affected lines
   - Briefly explain why this change addresses the comment

4. **Wait for explicit approval:**
   - End your message with: "Fix for comment N/TOTAL. Approve this change? (yes / no / skip)"
   - Do NOT proceed to the next comment until the user replies
   - If the user says **no**: revert the change, ask what they want instead, re-implement, show diff again, wait for approval again
   - If the user says **skip**: undo the change and move to the next comment without applying anything
   - If the user says **yes**: move to the next comment

### Step 3 — After all comments are processed

Tell the user:
- Which comments were fixed (list them)
- Which were skipped
- Remind them to review the staged changes with `git diff` and commit when satisfied

**Never commit, push, or run `git add` without the user explicitly requesting it.**
**Never move to the next comment before receiving approval for the current one.**
