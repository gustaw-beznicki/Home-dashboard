-- Lets a monthly rhythm repeat every N months or every N years, so "przegląd
-- techniczny co 2 lata" becomes expressible. Extends the existing `monthly`
-- type rather than adding a `yearly` one: `interval_type` carries a CHECK
-- constraint, and D1 cannot ALTER one — widening it would mean the whole
-- create-new-table / copy / drop / rename rebuild, for no gain in meaning.
--
-- A year is stored as a multiple of months at read time (`every * 12`), so both
-- units share one code path in src/lib/recurrence.js. With `unit = 'year'` the
-- month and the day both come from `interval_starts_on`, which is why no
-- separate day rule is needed or offered.
--
-- Additive and backward-compatible, as ADR 0007 requires: migrations apply
-- before the new Worker deploys, and the version currently live selects its
-- columns by name and knows nothing about these two.

ALTER TABLE tasks ADD COLUMN interval_every INTEGER;
-- 'month' | 'year'. No CHECK constraint on purpose: the set may grow (a
-- 'week' unit would fold everyNDays in), and widening a CHECK on D1 needs the
-- rebuild dance. The Worker validates it instead — same call as `users.color`
-- in migration 0006.
ALTER TABLE tasks ADD COLUMN interval_unit TEXT;

-- Make existing rows self-describing rather than relying on the reader's
-- defaults. Every monthly task today means "every 1 month"; the reader treats
-- NULL the same way, so this changes no behaviour, only legibility for anyone
-- querying the table directly.
UPDATE tasks
SET interval_every = 1, interval_unit = 'month'
WHERE interval_type = 'monthly' AND interval_every IS NULL;
