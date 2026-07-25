# Keep secrets and PII out of committed config

## Status

Accepted

## Context

`wrangler.jsonc` originally held `INITIAL_ADMIN_EMAIL` — a real personal Gmail address — as a
plaintext `vars` entry, committed to a public repo. An email address isn't a credential (it can't
be used to compromise anything by itself), but it's personal data that shouldn't be sitting in git
regardless of whether the repo is public or private — visibility is the wrong axis to fix this on.
By contrast, `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are legitimately public identifiers per
Cloudflare's own model (the JWKS endpoint they seed is public; the AUD is embedded in every issued
JWT anyway) — those are fine as committed `vars`.

## Decision

Anything personal or credential-like goes through `wrangler secret put`, never committed to
`wrangler.jsonc` — regardless of repo visibility. `INITIAL_ADMIN_EMAIL` was moved to a Cloudflare
secret; `worker/auth.js` needed no code changes, since Workers merge `vars` and `secrets` into the
same `env` object. Only genuinely public config identifiers stay in `wrangler.jsonc`.

## Consequences

The repo can stay public (a deliberate choice — it doubles as a CV/portfolio piece) without
personal data being newly exposed going forward. Old commits before this decision still contain the
email in history; treated as an accepted low-severity residual risk (the repo had zero forks/stars/
watchers the entire time it was public) rather than rewriting git history, which wouldn't fully
work anyway — merged PR diff pages on GitHub retain their own commit refs independent of branch
rewrites.
