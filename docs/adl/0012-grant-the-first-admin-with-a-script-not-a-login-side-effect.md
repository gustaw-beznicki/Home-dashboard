# Grant the first admin with a script, not a login side effect

## Status

Accepted

## Context

[0003](0003-use-cloudflare-access-for-authentication-app-owned-users-table-for-authorization.md)
introduced `INITIAL_ADMIN_EMAIL` and [0009](0009-replace-clerk-with-self-hosted-better-auth-on-d1.md)
carried it forward: `authorize()` would insert an `admin`/`active` row for the account matching that
secret, **but only while the `users` table was empty**. It solved a real problem — the admin portal is
the only way to invite people, so somebody has to be an admin before anybody can be invited.

It solved it badly, in four separate ways.

**A login attempt caused a privilege grant.** `authorize()` is the read path for every single
`/api/*` request. Giving it a branch that writes an admin row means the authorization check is also,
conditionally, an authorization *grant*. That is a strange shape for the one function whose whole job
is deciding whether to say no.

**The condition was global, not per-account.** "The table is empty" is a property of the system, not
of the person signing in. It closes the instant anyone is added, silently, with nothing recorded and
nothing to observe. `CLAUDE.md` carried an explicit warning about this trap — that a stale row makes
the bootstrap quietly not fire and the account land as a plain `member` — which is a good sign the
mechanism was hard to reason about rather than a good sign the warning was needed.

**It was useless exactly when it was needed most.** A one-shot valve helps on day zero. It does
nothing on day four hundred, when the household has locked itself out because the only admin's
address stopped working. Recovery then meant hand-writing `UPDATE users SET role = 'admin' …` against
production D1 — which is precisely what happened in this repo, and what prompted this record.

**The rule lived in two places.** Both `authorize()` in `worker/auth.js` and `resolveInvite()` in
`worker/db.js` re-derived the same empty-table condition independently, and a comment asked future
readers to keep them in step by hand.

And the secret outlives its usefulness. `INITIAL_ADMIN_EMAIL` stops mattering the moment the first
row exists, but it stays in the secret store forever, drifting: in this repo it ended up pointing at
an address that could no longer authenticate, while still looking like configuration that meant
something.

## Decision

The bootstrap is removed from both code paths. A non-revoked `users` row is now the entire rule for
access, and `authorize()` only ever reads — an empty table means nobody gets in.

The first admin is granted out of band by `scripts/grant-admin.mjs`, wired up as
`npm run admin:grant` and `npm run admin:list`:

```bash
npm run admin:list -- --remote
npm run admin:grant -- you@example.com --remote
npm run admin:grant -- them@example.com --role member --remote
npm run admin:grant -- old@example.com --status revoked --remote
```

It upserts on `email`, so it is idempotent and equally usable to create, promote, demote, revoke or
restore — setup and recovery are the same operation rather than two different ones with only the
former supported. `invited_by` is set to `'cli'` so a grant made this way is distinguishable later
from one made by a person clicking **Zaproś**.

Two details are deliberate. D1's CLI has no bind parameters, so the address is validated against a
regex deliberately narrower than RFC 5322 — no quotes, semicolons, backslashes or whitespace can
reach the SQL text — and the statement is written to a temp file rather than interpolated into a shell
command. And wrangler is invoked through `process.execPath` directly rather than `npx` with
`shell: true`, so there is no shell to escape against.

It also reports two things raw SQL would not: that the table has **no active admin** (the state that
cannot be recovered from through the UI), and that an address has already signed in — because Better
Auth keeps its own mirrored `role`, which `authorize()` repairs on that person's next request, so one
reload is expected before `/admin` stops refusing.

`INITIAL_ADMIN_EMAIL` should be deleted from the production secret store; no code reads it.

## Consequences

**Fail closed instead of fail open.** An empty `users` table now denies everyone, where before the
next sign-in by the right address became an admin. For a household app whose entire security model is
"the `users` table is the allowlist" (ADR 0003, 0009), a table that grants privileges when empty was
the one place that model didn't hold.

**Recovery is a documented command rather than improvised SQL.** The failure this ADR came out of —
one admin, an address that can't sign in, no way into `/admin` — is now `npm run admin:grant`.

**One rule, one place.** `resolveInvite()` and `authorize()` no longer re-derive a shared condition;
there is a test asserting they agree on active, revoked and unknown addresses. `pending` is excluded
from that assertion on purpose: the two genuinely differ there and should, since an invitee must be
allowed to create an identity before `create.after` flips their row to active.

**A first-run step that cannot be skipped.** Deploying this app to a fresh D1 now requires running
the grant script before anyone can sign in. That is a real extra step, and it is the point: the
alternative made it implicit, invisible, and impossible to repeat.

**ADR 0011 has one stale sentence.** It justifies the dev bypass not writing a `users` row on the
grounds that doing so "would silently disable the `INITIAL_ADMIN_EMAIL` bootstrap". That reason is now
gone, but the behaviour is still right for a better one, recorded in `worker/auth.js`: a bypass is not
a grant, and running the app locally should not hand out access. The record is left as written rather
than edited, since it documents the reasoning at the time.

**The old marker survives in data.** Rows created by the bootstrap still carry `invited_by =
'bootstrap'`. Left alone deliberately — it is accurate history, and it is how you can tell which row
came from the mechanism this ADR removes.
