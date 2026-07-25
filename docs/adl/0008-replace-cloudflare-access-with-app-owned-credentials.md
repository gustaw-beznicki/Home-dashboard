# Replace Cloudflare Access with app-owned credentials and roles

## Status

Proposed

## Context

The current model ([0003](0003-use-cloudflare-access-for-authentication-app-owned-users-table-for-authorization.md))
delegates identity entirely to Google via Cloudflare Access — the app verifies a Google-issued JWT
but never stores or manages a credential itself. That was sufficient for "is this a real Google
account, and is it in our `users` table."

New requirement: a dedicated admin portal where an admin can invite new users, reset a user's
password, enable/disable MFA per user, and block/unblock a user, plus different permission levels
per user type. Password reset and per-user MFA toggling can't be built on top of delegated Google
identity — Google owns the credential and its own MFA, not this app. Making those admin actions
real requires the app to own the credential itself, not just an authorization table keyed on a
verified external identity.

## Decision

Move authentication off Cloudflare Access/Google SSO onto app-owned credentials:
- A new login screen replaces the Cloudflare Access redirect flow
- The `users` table gains a role/user-type column (for permission levels) and owns password
  storage, invite-token-based onboarding (admin invites an email → user sets their own password),
  per-user TOTP-based MFA enrollment with an enable/disable toggle, and a block/unblock flag
- A separate admin portal page (gated to the admin role) hosts invite, password reset, MFA
  toggle, and block/unblock controls

Still open, not yet decided as part of this record — needs resolving before implementation:
- Password hashing approach available in the Workers runtime (no native bcrypt; likely Web Crypto
  PBKDF2 or scrypt)
- Session mechanism to replace Access's JWT verification (own session tokens/cookies)
- How invite and password-reset emails actually get delivered — this app has no email-sending
  capability today
- Whether Cloudflare Access is dropped entirely or kept as an additional outer layer in front of
  the new login screen (defense in depth) rather than removed outright
- Migration path for the current bootstrap admin (`INITIAL_ADMIN_EMAIL`) into the new model

## Consequences

Gains full control over invite, reset, MFA, and block flows, and supports real per-user permission
levels — none of which fit the delegated-identity model. Loses Google's battle-tested credential
handling (password hashing, breach/phishing detection, account recovery) — the app now owns that
responsibility end to end, which is a substantial increase in security surface area and
implementation complexity compared to delegating to Google. This proposal, if accepted, would
supersede [0003](0003-use-cloudflare-access-for-authentication-app-owned-users-table-for-authorization.md)
once actually implemented (that record stays Accepted until then, since it still describes what's
live today).
