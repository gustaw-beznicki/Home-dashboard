# Require pull requests on main, no direct pushes

## Status

Accepted

## Context

Config and deploy-affecting changes (`wrangler.jsonc`, Worker code, CI) were being pushed straight
to `main` early on. For a repo that's also a public CV/portfolio piece, and given how easily a
single wrong committed value (like the email in
[0005](0005-keep-secrets-and-pii-out-of-committed-config.md)) can slip through without review, a
lightweight process gate is worth the small friction.

## Decision

Enable GitHub branch protection on `main`: pull requests required to merge, 0 required approving
reviews (solo project — this blocks direct pushes without requiring a second reviewer that doesn't
exist), force-pushes and branch deletion disabled, enforced even for the repo owner/admin,
conversation resolution required before merge.

## Consequences

Every change to `main` goes through a branch + PR, giving a reviewable diff and a paper trail, even
for solo work. Note: toggling repo visibility (private ↔ public) on a personal GitHub account can
silently strip this protection — worth re-checking (`GET /branches/main/protection`) after any
visibility change.
