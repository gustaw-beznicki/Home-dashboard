-- Per-user profile bits for the onboarding wizard: the avatar colour picked in
-- step two, and the timestamp that marks the wizard as completed so it runs
-- exactly once per person. Additive and backward-compatible: the currently-live
-- Worker never reads either column, so this is safe to apply before the code
-- deploys (ADR 0007).
--
-- `color` is a palette key ('forest' | 'leaf' | 'clay' | 'sand'), validated in
-- the Worker rather than by a CHECK constraint — widening a CHECK on D1 needs
-- the whole rebuild-and-rename dance, and the set is expected to grow.
ALTER TABLE users ADD COLUMN color TEXT;
ALTER TABLE users ADD COLUMN onboarded_at TEXT;

-- Everyone already active predates the wizard — the household would otherwise
-- be greeted like strangers on their next visit. Only invited-but-not-yet-in
-- (pending) rows keep NULL and get onboarded for real.
UPDATE users SET onboarded_at = created_at WHERE status != 'pending';
