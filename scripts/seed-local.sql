-- Sample data for the LOCAL D1 only. Run with `npm run db:seed:local`.
--
-- Deliberately does NOT touch `users`: `authorize()` self-provisions the first
-- INITIAL_ADMIN_EMAIL account only while that table is empty, so seeding a row
-- here would silently demote your first local sign-in to a plain member.
--
-- Every date is relative to `date('now')`, so the fixture keeps making sense
-- whenever it is run. Between them the tasks cover all five rhythms, all three
-- dashboard stops, all four categories, an anchorless-but-never-done task, a
-- pinned one and an archived one.

DELETE FROM completions;
DELETE FROM tasks;

INSERT INTO tasks (id, name, category, interval_type, interval_n, interval_starts_on, interval_weekdays, interval_day, last_done, last_done_by_email, last_done_by_name, note, pinned, archived, created_by_email)
VALUES
  -- Zaległe ---------------------------------------------------------------
  -- Monthly on the 1st, last paid at the start of last month: the deadline
  -- that was missed is this month's 1st, and it stays the 1st.
  ('seed-01', 'Wymienić filtr w kranie', 'equipment', 'monthly', NULL, date('now', '-6 months', 'start of month'), NULL, 'first',
   date('now', 'start of month', '-1 month'), 'ala@example.com', 'Ala', '', 0, 0, 'ala@example.com'),

  -- Never done, anchored five days ago — the case the old model could only
  -- render as "overdue since forever".
  ('seed-02', 'Odkamienić czajnik', 'home', 'everyNDays', 21, date('now', '-5 days'), NULL, NULL,
   NULL, NULL, NULL, 'ocet leży pod zlewem', 0, 0, 'kuba@example.com'),

  -- Na dziś ---------------------------------------------------------------
  ('seed-03', 'Podlać monsterę', 'plants', 'everyNDays', 3, date('now', '-9 days'), NULL, NULL,
   date('now', '-3 days'), 'kuba@example.com', 'Kuba', 'tylko letnia woda', 0, 0, 'kuba@example.com'),

  ('seed-04', 'Witamina D', 'health', 'daily', NULL, date('now', '-30 days'), NULL, NULL,
   date('now', '-1 day'), 'ala@example.com', 'Ala', '', 0, 0, 'ala@example.com'),

  -- Na spokojnie ----------------------------------------------------------
  -- Pinned, so it sorts above everything regardless of urgency.
  ('seed-05', 'Rachunki', 'home', 'monthly', NULL, date('now', '-3 months', 'start of month'), NULL, 'last',
   date('now', 'start of month', '-1 day'), 'kuba@example.com', 'Kuba', '', 1, 0, 'kuba@example.com'),

  ('seed-06', 'Odkurzyć salon', 'home', 'weekly', NULL, date('now', '-30 days'), '[1,4]', NULL,
   date('now', '-1 day'), 'ala@example.com', 'Ala', '', 0, 0, 'ala@example.com'),

  ('seed-07', 'Podlać paprocie', 'plants', 'everyNDays', 2, date('now', '-1 day'), NULL, NULL,
   date('now', '-1 day'), 'kuba@example.com', 'Kuba', '', 0, 0, 'kuba@example.com'),

  ('seed-08', 'Wyczyścić ekspres', 'equipment', 'everyNDays', 14, date('now', '-7 days'), NULL, NULL,
   date('now', '-7 days'), 'ala@example.com', 'Ala', 'odkamieniacz w szafce', 0, 0, 'ala@example.com'),

  ('seed-09', 'Umyć okna', 'home', 'everyNDays', 30, date('now', '-9 days'), NULL, NULL,
   date('now', '-9 days'), 'kuba@example.com', 'Kuba', '', 0, 0, 'kuba@example.com'),

  -- First Saturday of the month.
  ('seed-10', 'Przegląd pieca', 'equipment', 'monthly', NULL, date('now', '-6 months', 'start of month'), NULL, '{"nth":1,"weekday":6}',
   date('now', '-1 month'), 'kuba@example.com', 'Kuba', '', 0, 0, 'kuba@example.com'),

  -- No rhythm at all: sits in "Na spokojnie" until someone acts on it.
  ('seed-11', 'Wymienić żarówkę w łazience', 'home', 'manual', NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, '', 0, 0, 'ala@example.com'),

  -- Schowek ---------------------------------------------------------------
  ('seed-12', 'Zmienić opony na zimowe', 'equipment', 'manual', NULL, NULL, NULL, NULL,
   date('now', '-200 days'), 'kuba@example.com', 'Kuba', '', 0, 1, 'kuba@example.com');

-- History for the "Ten tydzień" card. It reads `completions` rather than
-- `tasks.last_done`, so seeding several completions of the same task is the
-- point: the cache would count each task once.
INSERT INTO completions (id, task_id, completed_by_email, completed_by_name, completed_date, completed_at)
VALUES
  ('seed-c01', 'seed-03', 'kuba@example.com', 'Kuba', date('now', '-6 days'), datetime('now', '-6 days')),
  ('seed-c02', 'seed-04', 'ala@example.com',    'Ala',    date('now', '-5 days'), datetime('now', '-5 days')),
  ('seed-c03', 'seed-03', 'kuba@example.com', 'Kuba', date('now', '-4 days'), datetime('now', '-4 days')),
  ('seed-c04', 'seed-06', 'ala@example.com',    'Ala',    date('now', '-4 days'), datetime('now', '-4 days')),
  ('seed-c05', 'seed-04', 'ala@example.com',    'Ala',    date('now', '-3 days'), datetime('now', '-3 days')),
  ('seed-c06', 'seed-03', 'kuba@example.com', 'Kuba', date('now', '-3 days'), datetime('now', '-3 days')),
  ('seed-c07', 'seed-08', 'ala@example.com',    'Ala',    date('now', '-2 days'), datetime('now', '-2 days')),
  ('seed-c08', 'seed-04', 'ala@example.com',    'Ala',    date('now', '-2 days'), datetime('now', '-2 days')),
  ('seed-c09', 'seed-09', 'kuba@example.com', 'Kuba', date('now', '-1 day'),  datetime('now', '-1 day')),
  ('seed-c10', 'seed-04', 'ala@example.com',    'Ala',    date('now', '-1 day'),  datetime('now', '-1 day')),
  ('seed-c11', 'seed-07', 'kuba@example.com', 'Kuba', date('now', '-1 day'),  datetime('now', '-1 day'));
