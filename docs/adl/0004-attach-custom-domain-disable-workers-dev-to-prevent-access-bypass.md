# Attach a custom domain, disable workers.dev to prevent Access bypass

## Status

Accepted

## Context

Cloudflare Access protects specific hostnames, not a Worker script as a whole. A Worker deployed
with both a custom domain and its default `*.workers.dev` subdomain live is reachable at two public
hostnames — if only the custom domain is registered as an Access application, the `workers.dev`
hostname bypasses Access entirely, defeating the auth model in
[0003](0003-use-cloudflare-access-for-authentication-app-owned-users-table-for-authorization.md).
Separately, Cloudflare re-enables the `workers.dev` route on every `wrangler deploy` unless
`workers_dev: false` is explicit in `wrangler.jsonc` — disabling it only via the dashboard doesn't
survive the next deploy.

## Decision

Purchase and attach `home-dashboard.app` (apex) as a Workers custom domain — the app's only public
hostname. Disable the `workers.dev` route for both Production and Preview. Build the Cloudflare
Access application on `home-dashboard.app` as its destination. Set `"workers_dev": false` in
`wrangler.jsonc` so the route stays disabled across every future deploy, including the automated
pipeline in [0007](0007-automate-deploy-and-migrations-with-github-actions.md).

## Consequences

There is exactly one public hostname for the app, and it's the one Access actually protects — no
bypass path. Anyone wanting to reach the Worker directly via `*.workers.dev` gets nothing (route
disabled), and that stays true even if the config is redeployed without anyone remembering to
re-check the dashboard toggle.
