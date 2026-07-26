-- Extends the interval model with an anchor date and the weekly/monthly
-- variants the redesigned rhythm editor needs (ADR 0010).
--
-- Before this, "co 3 dni" was counted from `last_done` alone, so a task that
-- had never been done had no schedule at all and a task done late silently
-- re-based its whole future. `interval_starts_on` is the grid the deadlines sit
-- on; `interval_weekdays` and `interval_day` say which points of that grid
-- count for weekly and monthly rhythms.
--
-- Additive and backward-compatible, as required by ADR 0007 (migrations apply
-- before the new Worker deploys): the currently-live Worker selects columns it
-- knows about and never reads these three.

ALTER TABLE tasks ADD COLUMN interval_starts_on TEXT;
-- JSON array of ISO weekdays, 1 = Monday … 7 = Sunday. Weekly rhythms only.
ALTER TABLE tasks ADD COLUMN interval_weekdays TEXT;
-- Monthly rule: '1'..'28', 'first', 'last', or a JSON {"nth":1,"weekday":6}.
ALTER TABLE tasks ADD COLUMN interval_day TEXT;

-- Backfill so existing tasks keep the cadence they have today. Anchoring on
-- `last_done` reproduces the old "N days after you last did it" behaviour
-- exactly; tasks never done fall back to their creation date, which is where
-- the old code implicitly treated them as already overdue.
UPDATE tasks
SET interval_starts_on = COALESCE(last_done, substr(created_at, 1, 10))
WHERE interval_starts_on IS NULL AND interval_type != 'manual';
