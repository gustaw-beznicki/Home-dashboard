-- Adds role-based permissions and an invited-not-yet-accepted state, ahead of
-- moving authentication to Clerk (ADR 0008). D1 can't ALTER an existing CHECK
-- constraint, so this rebuilds the table rather than altering it in place.
-- Additive/backward-compatible: the currently-live Worker never reads these
-- new columns, so this is safe to apply before the code cutover.
CREATE TABLE users_new (
  email         TEXT PRIMARY KEY,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
  clerk_user_id TEXT,
  invited_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO users_new (email, name, status, invited_by, created_at)
SELECT email, name, status, invited_by, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
