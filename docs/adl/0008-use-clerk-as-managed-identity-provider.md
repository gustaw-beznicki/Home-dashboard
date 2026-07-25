# Use Clerk as a managed identity provider

## Status

Superseded by [0009](0009-replace-clerk-with-self-hosted-better-auth-on-d1.md)

## Context

New requirement: a dedicated admin portal where an admin can invite new users, reset a user's
password, disable a user's MFA, and block/unblock a user, plus role-based permissions. One option
considered was having the app own credentials directly — password hashing, invite tokens, TOTP
secret storage, and password-reset email delivery, all built from scratch in the Worker. Weighed
against this app's actual scale (2 real users), that's a lot of security surface area to own
correctly: no native bcrypt in the Workers runtime, secure reset-token generation, TOTP secret
storage, rate limiting, and zero existing email-sending capability in this repo. Enterprises
generally don't hand-roll this anymore — they delegate to a managed identity provider that
specializes in it and exposes an admin API for user lifecycle management.

Two capability gaps surfaced while scoping this against Clerk's actual current API: there is no
per-user "admin enables MFA for user X" call (only `disableUserMFA()` exists — enabling is
self-service or an app-wide enforcement toggle), and no "admin triggers a password-reset email"
primitive (the real capability is `createSignInToken()`, an admin-issued one-time sign-in link).
Both were resolved directly rather than assumed: MFA control is disable-only plus a read-only
status badge, and "reset password" means an admin-issued one-time sign-in link, not a reset email.

## Decision

Adopt Clerk as the authentication provider, replacing Cloudflare Access/Google SSO
([0003](0003-use-cloudflare-access-for-authentication-app-owned-users-table-for-authorization.md)).
This preserves the same authn/authz split 0003 already established — Clerk only proves identity
(OAuth2/OIDC-based, same category of mechanism Access already was), the D1 `users` table still owns
authorization and is extended with a `role` column, a `pending` status for invited-not-yet-accepted
users, and a `clerk_user_id` column. Admin actions (invite, block/unblock, MFA-disable,
reset-password-link) are implemented as new `/api/admin/*` Worker routes calling Clerk's Backend
API, gated by the new `role` column rather than Clerk's own metadata — D1 stays the single source
of truth for who's allowed to use the app and at what permission level.

## Consequences

Gains real invite/block/MFA-disable/sign-in-link admin actions and role-based permissions without
the app ever storing a password or TOTP secret itself — Clerk owns that responsibility end to end.
Loses the "no third-party auth dependency" property Access-via-Google had, and takes on the two
documented capability gaps (MFA can't be admin-enabled per user, only disabled; password reset is a
one-time link, not an emailed reset flow) as accepted trade-offs rather than unmet requirements.
Cloudflare Access is retired only after a coordinated cutover and a short bake period — see the
rollout runbook that accompanies this change — since Access intercepts at the edge before any app
code runs, so it and Clerk's login screen can never both be live on the same hostname at once.
