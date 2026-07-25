# Add a Cloudflare Worker backend with D1 for shared state

## Status

Accepted

## Context

The app started client-only, persisting tasks to `localStorage`. That works for one person on one
device, but multiple household members on separate devices need to share one task list, with
attribution for who completed which chore — a single browser's local storage can't do that.

## Decision

Add a Worker API (`worker/index.js`, `worker/db.js`) backed by a D1 database, with `tasks`,
`completions`, and `users` tables (`migrations/0001_init.sql`). `completions` is a history table
recording who completed each chore and when, not just the latest completer, so attribution survives
across devices and over time. `src/hooks/useTasks.js` was rewritten to fetch from the API with
optimistic updates and rollback on failure, keeping its previous exported shape so
`Dashboard`/`TaskCard`/`TaskForm` needed almost no changes. A one-shot banner offers to import any
tasks still sitting in a browser's pre-backend `localStorage`.

## Consequences

Task state is now centralized and shared correctly across devices, and completions carry real
per-person attribution. This introduces a dependency on the Worker/D1 being reachable and correctly
configured to use the app at all (no more fully-offline client-only mode), and required adding
authentication so the shared backend isn't open to anyone —
see [0003](0003-use-cloudflare-access-for-authentication-app-owned-users-table-for-authorization.md).
