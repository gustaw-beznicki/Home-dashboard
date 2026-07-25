-- Users the app authorizes to use the dashboard. Cloudflare Access only proves
-- "this is a real Google account" — this table is the actual authorization boundary,
-- managed from the in-app admin page rather than Cloudflare's dashboard.
CREATE TABLE users (
  email        TEXT PRIMARY KEY,
  name         TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  invited_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE tasks (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  last_done          TEXT,
  interval_type      TEXT NOT NULL CHECK (interval_type IN ('daily', 'everyNDays', 'weekly', 'monthly', 'manual')),
  interval_n         INTEGER,
  priority           TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  note               TEXT NOT NULL DEFAULT '',
  category           TEXT NOT NULL CHECK (category IN ('plants', 'equipment', 'home', 'health')),
  pinned             INTEGER NOT NULL DEFAULT 0,
  archived           INTEGER NOT NULL DEFAULT 0,
  last_done_by_email TEXT,
  last_done_by_name  TEXT,
  created_by_email   TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Append-only completion history so "who did it" survives beyond the latest
-- completer — tasks.last_done_by_* is just a denormalized cache of the most
-- recent row here, kept in sync by the /complete endpoint.
CREATE TABLE completions (
  id                 TEXT PRIMARY KEY,
  task_id            TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_by_email TEXT NOT NULL,
  completed_by_name  TEXT,
  completed_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_date     TEXT NOT NULL
);

CREATE INDEX idx_completions_task_id ON completions(task_id, completed_at DESC);
