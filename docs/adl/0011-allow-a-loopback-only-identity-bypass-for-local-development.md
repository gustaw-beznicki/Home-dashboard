# Allow a loopback-only identity bypass for local development

## Status

Accepted

## Context

[0009](0009-replace-clerk-with-self-hosted-better-auth-on-d1.md) left a deliberate absence, stated in
a comment at the top of `worker/auth.js` and repeated in `CLAUDE.md`: no mock-identity bypass, because
a mock cannot exercise the real login screen, the invite gate, or the admin portal. The intent was
sound — every trap the Clerk setup produced came from local and production behaving differently.

Two things made that position untenable in practice.

First, running the app locally requires a Google OAuth client ID and secret, and those exist only in
the developer's own Google Cloud Console. `wrangler secret list` returns names, never values. A
`git clone` therefore could not reach *any* screen of the app — not the dashboard, not the admin
portal, nothing — until someone had manually configured OAuth. For a two-person household chore
tracker that is a disproportionate barrier to reading your own code.

Second, and concretely: production currently has no `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` or
`BETTER_AUTH_SECRET` set at all — only two retired Clerk secrets and `INITIAL_ADMIN_EMAIL`. The Better
Auth cutover was merged before its credentials existed. So at the moment there is no working OAuth
client to borrow, and the redesign in [0010](0010-anchor-recurrence-to-a-start-date-instead-of-the-last-completion.md)
could not be looked at by anyone.

The risk that the original decision was protecting against is real and worth naming precisely: a
bypass flag is an authentication hole the instant it is reachable in production. Flags get copied into
config files, config files get committed, and "it's only for dev" is how that happens. A bypass whose
only protection is *"we didn't set the variable"* is one careless `wrangler.jsonc` edit away from
being an open door.

## Decision

`npm run dev:no-auth` runs `wrangler dev --var DEV_NO_AUTH:true`, and `devBypassUser` in
`worker/auth.js` synthesises a local admin identity. Two conditions are required, and the second is
the one carrying the security property:

1. `env.DEV_NO_AUTH === 'true'` — the literal string, so no stray `1` or `yes` enables it. It is
   supplied on the command line by the npm script and appears nowhere in `wrangler.jsonc`, so no
   deploy path carries it.
2. The request arrived on a loopback hostname (`localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`). This app
   has exactly one public hostname and `workers_dev: false` keeps it that way
   ([0004](0004-attach-custom-domain-disable-workers-dev-to-prevent-access-bypass.md)), so a deployed
   request cannot satisfy this. **If condition 1 leaked into production config, the bypass would still
   be unreachable rather than merely switched off.**

The bypass is entirely server-side. Better Auth has no session to return without Google credentials,
so the app would sit on the login screen forever; the Worker's existing `/api/auth/*` carve-out
answers `get-session` with a synthetic payload instead. Nothing about the bypass is compiled into the
browser bundle, which is verified — a production build contains no reference to it. A `VITE_*`
build-time flag was rejected for exactly this reason: it would put "skip authentication" logic into
shipped JavaScript.

It deliberately writes no `users` row, because doing so would silently disable the
`INITIAL_ADMIN_EMAIL` bootstrap on a later real sign-in — the trap `CLAUDE.md` already warns about.

Both conditions have guard tests in `worker/auth.test.js`, including live-server verification that a
spoofed `Host: home-dashboard.app` gets a 401 and no session while the flag is on. Those tests are
the mechanism that keeps this decision true over time; a failure there is a security regression.

`DEV_USER_ROLE=member`, `DEV_USER_EMAIL` and `DEV_USER_NAME` are accepted so the admin gate and
completion attribution can both be exercised. Only the exact string `member` downgrades the role — an
unrecognised value stays `admin` rather than silently granting something unintended.

## Consequences

**The app is now readable from a clean clone.** `npm run dev:no-auth` builds and serves the whole
thing against local D1 with no credentials, which is what `scripts/seed-local.sql` exists to fill.

**Four paths still need a real Google sign-in**, and that is the cost of this decision rather than an
oversight: the login screen, the invite gate (`databaseHooks.user.create.before`), the bootstrap in
`authorize()`, and role mirroring into Better Auth's tables. `docs/runbooks/local-testing.md` keeps
the real-OAuth route documented alongside the fast one, and anything touching those four paths must be
verified that way. The 0009 warning still stands: local success is not evidence of production
correctness.

**`npm run dev:no-auth` rebuilds the frontend first** (`vite build && wrangler dev`), because
`assets.directory` is `./dist` — wrangler dev serves built assets, not a Vite dev server, so there is
no HMR. Frontend edits need a re-run or a separate `npm run build`.

**A second, weaker signal was added rather than relied upon.** The script also passes
`--var ENVIRONMENT:development`, overriding the `production` value in `wrangler.jsonc` so logs and any
future environment-sensitive behaviour are honest locally. It is not part of the security check —
adding it there would mean the bypass depended on a value that *is* committed to `wrangler.jsonc`,
which is the failure mode this design avoids.
