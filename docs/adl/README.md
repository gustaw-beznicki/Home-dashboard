# Architecture Decision Log

This is the architecture decision log (ADL) for Home Dashboard — the collection of architecture
decision records (ADRs) capturing significant design choices, their context, and their
consequences.

Background on the format:
[architecture-decision-record/architecture-decision-record](https://github.com/architecture-decision-record/architecture-decision-record).
Each record here uses
[Michael Nygard's template](https://github.com/architecture-decision-record/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md)
(Title / Status / Context / Decision / Consequences) — lightweight and enough for a project this
size. Files are numbered in decision order, named with a present-tense imperative verb phrase.

New ADRs are recorded via the `.claude/skills/adr` skill — see that folder for the workflow and
template.

## Records

| # | Title | Status |
|---|-------|--------|
| [0001](0001-use-cloudflare-workers-for-static-hosting.md) | Use Cloudflare Workers for static hosting | Accepted |
| [0002](0002-add-cloudflare-worker-backend-with-d1-for-shared-state.md) | Add a Cloudflare Worker backend with D1 for shared state | Accepted |
| [0003](0003-use-cloudflare-access-for-authentication-app-owned-users-table-for-authorization.md) | Use Cloudflare Access for authentication, an app-owned users table for authorization | Superseded by [0008](0008-use-clerk-as-managed-identity-provider.md) |
| [0004](0004-attach-custom-domain-disable-workers-dev-to-prevent-access-bypass.md) | Attach a custom domain, disable workers.dev to prevent Access bypass | Accepted |
| [0005](0005-keep-secrets-and-pii-out-of-committed-config.md) | Keep secrets and PII out of committed config | Accepted |
| [0006](0006-require-pull-requests-on-main-no-direct-pushes.md) | Require pull requests on main, no direct pushes | Accepted |
| [0007](0007-automate-deploy-and-migrations-with-github-actions.md) | Automate deploy and migrations with GitHub Actions | Accepted |
| [0008](0008-use-clerk-as-managed-identity-provider.md) | Use Clerk as a managed identity provider | Superseded by [0009](0009-replace-clerk-with-self-hosted-better-auth-on-d1.md) |
| [0009](0009-replace-clerk-with-self-hosted-better-auth-on-d1.md) | Replace Clerk with self-hosted Better Auth on D1 | Accepted |
| [0010](0010-anchor-recurrence-to-a-start-date-instead-of-the-last-completion.md) | Anchor recurrence to a start date instead of the last completion | Accepted |
| [0011](0011-allow-a-loopback-only-identity-bypass-for-local-development.md) | Allow a loopback-only identity bypass for local development | Accepted |
| [0012](0012-grant-the-first-admin-with-a-script-not-a-login-side-effect.md) | Grant the first admin with a script, not a login side effect | Accepted |
| [0013](0013-store-household-settings-and-categories-in-d1.md) | Store household settings and categories in D1, dropping the fixed-category CHECK | Accepted |
| [0014](0014-suggest-chores-from-a-static-bundled-catalog.md) | Suggest chores from a static bundled catalog, not a search service | Accepted |
| [0015](0015-express-yearly-rhythms-as-a-monthly-multiple.md) | Express yearly rhythms as a monthly multiple, and snap the anchor to the grid | Accepted |
