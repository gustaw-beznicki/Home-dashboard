# Replace Clerk with self-hosted Better Auth on D1

## Status

Accepted

## Context

[0008](0008-use-clerk-as-managed-identity-provider.md) adopted Clerk on the assumption it was
effectively free at this app's scale of two users. That assumption was wrong, and correcting it is the
entire reason for revisiting the decision. Clerk's free Hobby tier lists **Multifactor authentication
(MFA)**, **User bans**, **Passkeys**, and **Allowlist / blocklist** as *Not included*; the cheapest
tier carrying them is Pro at $25/mo, or $20/mo billed annually. Since MFA is a hard requirement and
block/unblock was an explicit 0008 requirement, a spec-compliant Clerk deployment costs roughly
$240–300/yr to run a two-person household chore tracker. Clerk's February 2026 pricing change
eliminated the old "Enhanced Authentication" add-on and folded MFA into Pro while raising the free
allotment to 50,000 monthly retained users, so the widely-repeated "$100/mo MFA add-on" figure is
stale — but the paywall itself is real.

Two things surfaced while verifying this. First, the Worker merged in 0008 already calls Pro-gated
APIs: `clerk.users.banUser()`/`unbanUser()` back the admin portal's block/unblock, so that feature was
never going to work in production on Hobby. It went unnoticed only because the Access-to-Clerk cutover
was still incomplete and the code path had never been exercised against the production instance.
Second, Clerk makes all Pro features available in *development* instances, and this repo's local setup
uses one — so MFA and banning both worked locally and would have failed in production. Local success
was never evidence of entitlement.

Better Auth is an MIT-licensed framework whose `admin`, `twoFactor`, and `passkey` plugins are all in
the free core with no feature gating; its paid tier sells managed infrastructure (hosted dashboard,
audit logs, transactional email) that is not required to run the library. Critically it runs *inside*
the existing Worker against D1 — Better Auth has supported D1 as a first-class database since v1.5, so
its own tables sit next to the `users` authorization table, and the authn/authz split established in
[0003](0003-use-cloudflare-access-for-authentication-app-owned-users-table-for-authorization.md) is
preserved by construction rather than by integration glue.

Three findings shaped the *scope* of what was adopted, and they matter more than the cost figure.
Better Auth's two-factor challenge is installed as a hook matching only `/sign-in/email`,
`/sign-in/username`, and `/sign-in/phone-number` — social, magic-link, and passkey sign-ins are never
challenged. Enrolling in TOTP also requires the user's own password, so app-owned TOTP is only
meaningful when email-and-password is the primary sign-in path, and adding Google or passkeys
alongside it would create a bypass rather than an extra option. Separately, this account runs on
Workers Free, which caps CPU at 10 ms per request, and every defensible password hash exceeds that:
Better Auth's default scrypt (N=16384, r=16) measured 46.6 ms, OWASP's interactive scrypt profile
24.4 ms, and PBKDF2-SHA256 at OWASP's 600,000 iterations 75.6 ms. Overriding the hasher does not
rescue the free tier; it only selects which security property to weaken. Dropping passwords resolves
both problems at once — no credential accounts means no hashing, and MFA moves to Google, where it is
actually enforced instead of bypassable.

Alternatives were assessed at two users. Clerk Pro ($20–25/mo) is feature-complete but charges an
enterprise-shaped price for 50,000 MRU of headroom that will never be used. Better Auth with
passwords and app-owned TOTP on Workers Paid ($5/mo) is viable and was the original intent, but pays
for a capability Google already provides free, and Google sign-in would bypass that TOTP anyway.
Running Better Auth on a VPS removes the CPU ceiling, but Cloudflare's D1 REST API is documented as
suited to administrative use because the global API rate limit applies, so auth data would have to
leave D1 for a VPS-local database — contradicting D1 as the single source of truth, costing the same
as Workers Paid, and adding patching, TLS, backups, process supervision, and a login single point of
failure to an app that is otherwise entirely edge-hosted. WorkOS AuthKit is the genuine runner-up —
free to one million monthly active users with MFA included and no operations burden — and is recorded
here as the fallback if Better Auth proves unworkable; it was rejected because it is closed-source and
keeps an external identity dependency, solving the cost problem but not the architectural one.
Cloudflare Access is 0003 and still offers no in-app user CRUD, so it cannot satisfy 0008's admin
portal requirement. Supabase Auth and Stack Auth both require standing up Postgres alongside D1, a
second database and service for two users. Zitadel and Logto Cloud add an external identity service
without WorkOS's scale headroom. Self-hosted Keycloak, Zitadel, or Authentik cannot run in Workers at
all and would cost more than Clerk Pro once a VPS and its upkeep are counted.

The community `better-auth-cloudflare` package was evaluated and rejected: core D1 support makes it
unnecessary, it is at 0.x, and `drizzle-orm` is a hard dependency behind a static import, so adopting
it would add an ORM this repo does not otherwise use.

## Decision

Replace Clerk with Better Auth, pinned to an exact version, running in the existing Worker with
`database: env.DB` — no adapter package, no ORM. **Google is the only sign-in method**, configured
through `socialProviders.google` and reusing the OAuth client created for Access, which restores the
Google sign-in of 0003 and delegates MFA and account recovery to Google. The `admin` plugin provides
ban/unban and session revocation. `emailAndPassword`, `twoFactor`, and `passkey` are deliberately not
enabled.

The D1 `users` table remains unchanged and remains the authorization boundary, joined to Better Auth's
`user` table on email — `role` and `status` there are still what `requireUser`/`requireAdmin` gate on,
exactly as 0008 established. Because the `admin` plugin authorizes its own endpoints against Better
Auth's `user.role`, that column is mirrored from ours when a user row is created, with a
mismatch-guarded reconciliation on session verification to correct drift. Invitations write a `pending`
row to `users`; a `databaseHooks.user.create.before` hook refuses to create a Better Auth user for any
email without such a row (or the `INITIAL_ADMIN_EMAIL` bootstrap while the table is empty), and
`create.after` flips the row to `active`. That replaces Clerk's `user.created` webhook entirely, so the
unauthenticated public webhook endpoint and its signing secret are removed.

Session cookie caching is left off so that blocking a user takes effect on their next request, and
rate-limit counters are stored in D1 rather than the default in-memory map, which is per-isolate and
would not survive Cloudflare's isolate recycling. Better Auth is constructed at module scope so its
plugin and schema initialisation is charged to the Worker's 1-second startup budget instead of a
request's 10-millisecond CPU budget.

## Consequences

Authentication costs nothing again, and identity data now lives in the same database as
authorization. One deliberately unauthenticated public endpoint and one shared secret leave the
system, as does the build-time publishable key that had to be kept in two places. Block/unblock
becomes genuinely functional rather than silently paywalled.

The app no longer implements MFA itself. It is delegated to Google, and because Google's ID token
carries no second-factor claim, the app can neither enforce nor confirm that a household member has
Google 2FA enabled. This is the same posture 0003 accepted with Access and Google SSO, so it is a
return to a previously accepted position rather than a new weakening — but it is a real reduction
against what 0008 promised, and it is the price of Google-only sign-in. Passkeys are likewise not
implemented. There is no self-service password reset because there are no passwords; recovery is
Google's. 0008's second accepted gap does technically close, since `admin.setUserPassword` sets a
password directly with no emailed link, but there is no password path left to use it on.

Two `role` columns now exist and must agree, which is a new failure mode: editing `users.role` directly
via `wrangler d1 execute` will silently 403 the admin API until reconciliation runs. Better Auth's
tables use camelCase columns while this repo's use snake_case, a seam worth knowing before writing
queries by hand. Leaving cookie caching off costs one D1 read per authenticated request, which is
immaterial here and buys immediate revocation.

The heaviest ongoing cost is dependency maintenance. Better Auth is pre-2.0, ships breaking minor
versions every four to six weeks, and had twenty-two security advisories published across nineteen
months. The version is therefore pinned exactly and minor bumps are reviewed changes, not routine
updates; because [0007](0007-automate-deploy-and-migrations-with-github-actions.md) applies migrations
before deploying, a minor version that changes schema needs a two-step deploy rather than a single
merge. This is acceptable for a two-user household app and would not be for a commercial product.

Cutover is materially safer than the Access-to-Clerk one, because both Clerk and Better Auth run in
application code rather than intercepting at the edge. Better Auth can therefore be deployed and
verified in production *behind* the still-active Access gate before the Access Bypass policy is
added — the one irreversible step — instead of requiring a single coordinated flip.
