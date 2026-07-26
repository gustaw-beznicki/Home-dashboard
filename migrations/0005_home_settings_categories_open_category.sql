-- The Panel domu screen makes two things editable that were previously fixed in
-- code: household-wide settings and the category list. Both get a table. The
-- editable category list also means `tasks.category` can no longer be a CHECK
-- against four hard-coded keys, and since D1 can't alter a CHECK, the tasks
-- table is rebuilt. The rebuild also drops `priority`: it was collected and
-- stored but displayed nowhere and used by nothing, and the redesigned form no
-- longer sends it.
--
-- Backward-compatible with the currently-live Worker (ADR 0007): it never
-- reads `priority` (INSERTs rely on the column default, which goes away
-- together with the column), the category values it writes all pass the
-- removed CHECK trivially, and it doesn't know about the two new tables.

-- Exactly one row, enforced by the CHECK on id.
CREATE TABLE home_settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  name            TEXT NOT NULL DEFAULT 'Nasz dom',
  week_start      INTEGER NOT NULL DEFAULT 1 CHECK (week_start IN (1, 7)),
  default_rhythm  TEXT NOT NULL DEFAULT 'weekly' CHECK (default_rhythm IN ('manual', 'weekly', 'monthly')),
  remind_morning  INTEGER NOT NULL DEFAULT 1,
  remind_overdue  INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO home_settings (id) VALUES (1);

-- 'home' is the fallback bucket tasks land in when their category is deleted,
-- so the Worker refuses to delete it — see removeCategory in worker/db.js.
CREATE TABLE categories (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO categories (key, label, position) VALUES
  ('plants', 'Rośliny', 1),
  ('equipment', 'Sprzęt', 2),
  ('home', 'Dom', 3),
  ('health', 'Zdrowie', 4);

-- Rebuild tasks without the category CHECK and without priority. Deferring FK
-- enforcement keeps the completions → tasks reference happy mid-rebuild; the
-- RENAME re-points it at the new table.
PRAGMA defer_foreign_keys = on;

CREATE TABLE tasks_new (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  last_done          TEXT,
  interval_type      TEXT NOT NULL CHECK (interval_type IN ('daily', 'everyNDays', 'weekly', 'monthly', 'manual')),
  interval_n         INTEGER,
  interval_starts_on TEXT,
  interval_weekdays  TEXT,
  interval_day       TEXT,
  note               TEXT NOT NULL DEFAULT '',
  category           TEXT NOT NULL DEFAULT 'home',
  pinned             INTEGER NOT NULL DEFAULT 0,
  archived           INTEGER NOT NULL DEFAULT 0,
  last_done_by_email TEXT,
  last_done_by_name  TEXT,
  created_by_email   TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO tasks_new (id, name, last_done, interval_type, interval_n, interval_starts_on, interval_weekdays, interval_day,
                       note, category, pinned, archived, last_done_by_email, last_done_by_name, created_by_email, created_at, updated_at)
SELECT id, name, last_done, interval_type, interval_n, interval_starts_on, interval_weekdays, interval_day,
       note, category, pinned, archived, last_done_by_email, last_done_by_name, created_by_email, created_at, updated_at
FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
