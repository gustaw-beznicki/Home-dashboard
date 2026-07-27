// The monthly rule is one column holding three shapes: a day number, one of the
// 'first'/'last' keywords, or a JSON nth-weekday object. Storing it as TEXT and
// narrowing here keeps the migration additive; a separate column per shape
// would have meant a table rebuild.
function parseMonthlyDay(raw) {
  if (raw === null || raw === undefined || raw === '') return undefined
  if (raw === 'first' || raw === 'last') return raw
  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw)
    } catch {
      return undefined
    }
  }
  const day = Number(raw)
  return Number.isFinite(day) ? day : undefined
}

function serializeMonthlyDay(day) {
  if (day === null || day === undefined) return null
  if (typeof day === 'object') return JSON.stringify(day)
  return String(day)
}

// The cadence multiplier. Anything absent, non-numeric or below 1 is 1: a
// zero would make `nextOccurrenceAfter` step nowhere and loop.
function normaliseEvery(raw) {
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n >= 1 ? n : 1
}

function parseWeekdays(raw) {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : undefined
  } catch {
    return undefined
  }
}

// Maps between the D1 row shape and the JSON shape the frontend expects. The
// anchor (`startsOn`) rides along on every non-manual interval — it is what the
// whole recurrence grid hangs off, so it is never omitted (ADR 0010).
function serializeTask(row) {
  const interval = { type: row.interval_type }

  if (row.interval_type !== 'manual') {
    if (row.interval_starts_on) interval.startsOn = row.interval_starts_on
    if (row.interval_type === 'everyNDays') interval.n = row.interval_n
    if (row.interval_type === 'weekly') {
      const weekdays = parseWeekdays(row.interval_weekdays)
      if (weekdays) interval.weekdays = weekdays
    }
    if (row.interval_type === 'monthly') {
      // Always present in the JSON, even for rows written before migration
      // 0008, so the frontend never has to special-case a missing cadence.
      interval.every = normaliseEvery(row.interval_every)
      interval.unit = row.interval_unit === 'year' ? 'year' : 'month'
      // A yearly rhythm takes its month and day from the anchor, so a day rule
      // left over from a spell as a monthly one would be a lie.
      if (interval.unit === 'month') {
        const day = parseMonthlyDay(row.interval_day)
        if (day !== undefined) interval.day = day
      }
    }
  }

  return {
    id: row.id,
    name: row.name,
    lastDone: row.last_done,
    interval,
    note: row.note,
    category: row.category,
    pinned: !!row.pinned,
    archived: !!row.archived,
    completedBy: row.last_done_by_email
      ? { email: row.last_done_by_email, name: row.last_done_by_name }
      : null,
  }
}

// All six interval columns always move together — writing one without clearing
// the others would leave a weekly task carrying a stale monthly rule.
function intervalColumns(interval = {}) {
  const monthly = interval.type === 'monthly'
  const yearly = monthly && interval.unit === 'year'

  return {
    type: interval.type,
    n: interval.type === 'everyNDays' ? (interval.n ?? null) : null,
    startsOn: interval.type === 'manual' ? null : (interval.startsOn ?? null),
    weekdays:
      interval.type === 'weekly' && interval.weekdays?.length
        ? JSON.stringify(interval.weekdays)
        : null,
    // Cleared for a yearly rhythm: the anchor holds the month and the day, so a
    // stored rule could only contradict it.
    day: monthly && !yearly ? serializeMonthlyDay(interval.day) : null,
    every: monthly ? normaliseEvery(interval.every) : null,
    unit: monthly ? (yearly ? 'year' : 'month') : null,
  }
}

async function getTaskRow(env, id) {
  return env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first()
}

export async function listTasks(env) {
  const { results } = await env.DB.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all()
  return results.map(serializeTask)
}

export async function createTask(env, draft, user) {
  const id = crypto.randomUUID()
  const interval = intervalColumns(draft.interval)

  await env.DB.prepare(
    `INSERT INTO tasks (id, name, last_done, interval_type, interval_n, interval_starts_on, interval_weekdays, interval_day, interval_every, interval_unit, note, category, pinned, archived, created_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      draft.name,
      draft.lastDone ?? null,
      interval.type,
      interval.n,
      interval.startsOn,
      interval.weekdays,
      interval.day,
      interval.every,
      interval.unit,
      draft.note ?? '',
      draft.category,
      draft.pinned ? 1 : 0,
      draft.archived ? 1 : 0,
      user.email
    )
    .run()

  return serializeTask(await getTaskRow(env, id))
}

export async function updateTask(env, id, patch) {
  const fields = []
  const values = []

  if ('name' in patch) {
    fields.push('name = ?')
    values.push(patch.name)
  }
  if ('interval' in patch) {
    const interval = intervalColumns(patch.interval)
    fields.push(
      'interval_type = ?',
      'interval_n = ?',
      'interval_starts_on = ?',
      'interval_weekdays = ?',
      'interval_day = ?',
      'interval_every = ?',
      'interval_unit = ?'
    )
    values.push(
      interval.type,
      interval.n,
      interval.startsOn,
      interval.weekdays,
      interval.day,
      interval.every,
      interval.unit
    )
  }
  // The rhythm editor lets you correct when something was last done — the whole
  // schedule is counted from it, so it has to be editable rather than only
  // settable by tapping "Zrobione".
  if ('lastDone' in patch) {
    fields.push('last_done = ?')
    values.push(patch.lastDone || null)
  }
  if ('note' in patch) {
    fields.push('note = ?')
    values.push(patch.note)
  }
  if ('category' in patch) {
    fields.push('category = ?')
    values.push(patch.category)
  }
  if ('pinned' in patch) {
    fields.push('pinned = ?')
    values.push(patch.pinned ? 1 : 0)
  }
  if ('archived' in patch) {
    fields.push('archived = ?')
    values.push(patch.archived ? 1 : 0)
  }

  const existing = await getTaskRow(env, id)
  if (!existing) return null
  if (fields.length === 0) return serializeTask(existing)

  fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
  values.push(id)
  await env.DB.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  return serializeTask(await getTaskRow(env, id))
}

export async function deleteTask(env, id) {
  await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
}

export async function completeTask(env, id, user, date) {
  const existing = await getTaskRow(env, id)
  if (!existing) return null

  const completedDate = date || new Date().toISOString().slice(0, 10)

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO completions (id, task_id, completed_by_email, completed_by_name, completed_date)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), id, user.email, user.name, completedDate),
    env.DB.prepare(
      `UPDATE tasks
       SET last_done = ?, last_done_by_email = ?, last_done_by_name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`
    ).bind(completedDate, user.email, user.name, id),
  ])

  return serializeTask(await getTaskRow(env, id))
}

/**
 * Undo, within the few seconds the dashboard offers it. `completions` is the
 * history of who actually did what, and a tap taken back immediately was never
 * part of that history — so the row goes, and `tasks.last_done_by_*` (only ever
 * a cache of the newest row) is recomputed from whatever remains rather than
 * being blanked.
 */
export async function undoLatestCompletion(env, id) {
  const existing = await getTaskRow(env, id)
  if (!existing) return null

  const latest = await env.DB.prepare(
    'SELECT id FROM completions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1'
  )
    .bind(id)
    .first()

  if (latest) {
    await env.DB.prepare('DELETE FROM completions WHERE id = ?').bind(latest.id).run()
  }

  const previous = await env.DB.prepare(
    `SELECT completed_date, completed_by_email, completed_by_name
     FROM completions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1`
  )
    .bind(id)
    .first()

  await env.DB.prepare(
    `UPDATE tasks
     SET last_done = ?, last_done_by_email = ?, last_done_by_name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  )
    .bind(
      previous?.completed_date ?? null,
      previous?.completed_by_email ?? null,
      previous?.completed_by_name ?? null,
      id
    )
    .run()

  return serializeTask(await getTaskRow(env, id))
}

/**
 * "Ten tydzień: 11 rzeczy ogarniętych, Anna 6 · Kuba 5". Has to come from
 * `completions` rather than `tasks.last_done`: the cache only remembers the
 * newest completion, so anything done more than once in a week would undercount.
 */
export async function weekStats(env) {
  const { results } = await env.DB.prepare(
    `SELECT completed_by_email AS email,
            COALESCE(completed_by_name, completed_by_email) AS name,
            COUNT(*) AS count
     FROM completions
     WHERE completed_date >= date('now', '-6 days')
     GROUP BY completed_by_email
     ORDER BY count DESC`
  ).all()

  return {
    total: results.reduce((sum, row) => sum + row.count, 0),
    byPerson: results.map((row) => ({ name: row.name, count: row.count })),
  }
}

export async function listUsers(env) {
  const { results } = await env.DB.prepare(
    'SELECT email, name, role, status, color, created_at FROM users ORDER BY created_at ASC'
  ).all()
  return results
}

export async function getUserByEmail(env, email) {
  return env.DB.prepare(
    'SELECT email, name, role, status, color, onboarded_at, created_at FROM users WHERE email = ?'
  )
    .bind(email)
    .first()
}

// Avatar colours the onboarding wizard offers. A palette key, not a hex value —
// the frontend owns the actual colours so dark mode can pick different ones.
export const AVATAR_COLORS = ['forest', 'leaf', 'clay', 'sand']

// Self-service profile updates from onboarding: display name, avatar colour,
// and the one-way "onboarded" flag. Deliberately cannot touch role or status —
// those stay behind requireAdmin. Returns the fresh row, or null when there is
// no row to update (only reachable under the dev bypass, which never writes a
// users row on purpose).
export async function updateUserProfile(env, email, { name, color, onboarded }) {
  const fields = []
  const values = []

  if (name !== undefined) {
    fields.push('name = ?')
    values.push(name)
  }
  if (color !== undefined) {
    fields.push('color = ?')
    values.push(color)
  }
  if (onboarded) {
    // COALESCE keeps the original completion time if the wizard somehow runs
    // twice — the flag is one-way by design.
    fields.push("onboarded_at = COALESCE(onboarded_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
  }

  if (fields.length > 0) {
    await env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE email = ?`)
      .bind(...values, email)
      .run()
  }

  return getUserByEmail(env, email)
}

// Who invited this person — shown on the onboarding welcome step ("Wchodzisz na
// zaproszenie od Anny"). Prefers the inviter's display name, falls back to
// their email, and returns null when there's no inviter (the out-of-band first
// admin from `npm run admin:grant` has none).
export async function getInviterName(env, email) {
  const row = await env.DB.prepare(
    `SELECT inviter.name AS name, inviter.email AS email
     FROM users
     LEFT JOIN users AS inviter ON inviter.email = users.invited_by
     WHERE users.email = ?`
  )
    .bind(email)
    .first()

  return row?.name ?? row?.email ?? null
}

// The single place that decides whether an email is allowed to exist as an
// identity at all. `authorize()` in auth.js is still the security boundary for
// *access* — this gate exists so a stranger signing in with Google can't create
// rows in our database at will.
//
// Since ADR 0012 removed the bootstrap, the rule here is simply "a non-revoked
// row exists". That is also the whole of authorize()'s rule, so the two can no
// longer disagree — previously both re-derived the same empty-table condition
// and had to be kept in step by hand.
export async function resolveInvite(env, email) {
  const existing = await getUserByEmail(env, email)
  if (existing) {
    if (existing.status === 'revoked') return { allowed: false, role: null }
    return { allowed: true, role: existing.role }
  }

  return { allowed: false, role: null }
}

// Admin invited someone — this records the pending row. Better Auth has no
// concept of them yet; that happens on their first Google sign-in, which is
// also what flips this row to active (see activateUser).
export async function inviteUser(env, email, role, invitedByEmail) {
  await env.DB.prepare(
    `INSERT INTO users (email, role, status, invited_by) VALUES (?, ?, 'pending', ?)
     ON CONFLICT(email) DO UPDATE SET role = excluded.role, status = 'pending'`
  )
    .bind(email, role, invitedByEmail)
    .run()

  return getUserByEmail(env, email)
}

// Called from Better Auth's user.create.after hook — the moment an invited
// person first signs in with Google. Replaces the Clerk `user.created` webhook.
// A pending row becoming active is the whole transition; there's no provider ID
// to record, since Better Auth's own `user` table holds it.
export async function activateUser(env, email) {
  await env.DB.prepare("UPDATE users SET status = 'active' WHERE email = ? AND status = 'pending'")
    .bind(email)
    .run()
}

export async function setUserStatus(env, email, status) {
  await env.DB.prepare('UPDATE users SET status = ? WHERE email = ?').bind(status, email).run()
}

// Role changes guard the invariant that a household always has someone able to
// manage it: the last active gospodarz cannot be demoted. Returns null when the
// user doesn't exist and { error } when the guard bites, so the route can map
// each to the right status code.
export async function setUserRole(env, email, role) {
  const target = await getUserByEmail(env, email)
  if (!target) return null

  if (target.role === 'admin' && role !== 'admin') {
    const { count } = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status != 'revoked'"
    ).first()
    if (count <= 1) return { error: 'last-admin' }
  }

  await env.DB.prepare('UPDATE users SET role = ? WHERE email = ?').bind(role, email).run()
  return { user: await getUserByEmail(env, email) }
}

// --- Home settings and categories (Panel domu) ---

function serializeHomeSettings(row) {
  return {
    name: row.name,
    weekStart: row.week_start,
    defaultRhythm: row.default_rhythm,
    remindMorning: !!row.remind_morning,
    remindOverdue: !!row.remind_overdue,
  }
}

export async function getHomeSettings(env) {
  const row = await env.DB.prepare('SELECT * FROM home_settings WHERE id = 1').first()
  return serializeHomeSettings(row)
}

export async function updateHomeSettings(env, patch) {
  const fields = []
  const values = []

  if ('name' in patch) {
    fields.push('name = ?')
    values.push(String(patch.name).trim() || 'Nasz dom')
  }
  if ('weekStart' in patch) {
    fields.push('week_start = ?')
    values.push(patch.weekStart === 7 ? 7 : 1)
  }
  if ('defaultRhythm' in patch) {
    fields.push('default_rhythm = ?')
    values.push(['manual', 'weekly', 'monthly'].includes(patch.defaultRhythm) ? patch.defaultRhythm : 'weekly')
  }
  if ('remindMorning' in patch) {
    fields.push('remind_morning = ?')
    values.push(patch.remindMorning ? 1 : 0)
  }
  if ('remindOverdue' in patch) {
    fields.push('remind_overdue = ?')
    values.push(patch.remindOverdue ? 1 : 0)
  }

  if (fields.length > 0) {
    fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    await env.DB.prepare(`UPDATE home_settings SET ${fields.join(', ')} WHERE id = 1`)
      .bind(...values)
      .run()
  }

  return getHomeSettings(env)
}

export async function listCategories(env) {
  const { results } = await env.DB.prepare(
    'SELECT key, label FROM categories ORDER BY position ASC, created_at ASC'
  ).all()
  return results
}

// Keys are slugs of the label so they read sensibly in exports and stay stable
// under a later rename. Collisions get a numeric suffix rather than an error —
// two categories may legitimately share a label prefix.
function slugify(label) {
  const base = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/ł/g, 'l') // ł survives NFD
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'kategoria'
}

export async function createCategory(env, label) {
  const trimmed = String(label).trim()
  if (!trimmed) return null

  const existing = (await listCategories(env)).map((c) => c.key)
  let key = slugify(trimmed)
  for (let i = 2; existing.includes(key); i++) key = `${slugify(trimmed)}-${i}`

  const { max } = await env.DB.prepare('SELECT MAX(position) AS max FROM categories').first()
  await env.DB.prepare('INSERT INTO categories (key, label, position) VALUES (?, ?, ?)')
    .bind(key, trimmed, (max ?? 0) + 1)
    .run()

  return { key, label: trimmed }
}

// Deleting a category never deletes tasks — they fall back into 'home', which
// is why 'home' itself is not deletable (the fallback has to exist).
export async function removeCategory(env, key) {
  if (key === 'home') return { error: 'home-is-fallback' }

  const existing = await env.DB.prepare('SELECT key FROM categories WHERE key = ?').bind(key).first()
  if (!existing) return null

  await env.DB.batch([
    env.DB.prepare("UPDATE tasks SET category = 'home' WHERE category = ?").bind(key),
    env.DB.prepare('DELETE FROM categories WHERE key = ?').bind(key),
  ])
  return { removed: key }
}

// --- Dane domu ---

export async function exportAll(env) {
  const [tasks, categories, settings, users, completions] = await Promise.all([
    listTasks(env),
    listCategories(env),
    getHomeSettings(env),
    listUsers(env),
    env.DB.prepare(
      'SELECT task_id, completed_by_email, completed_by_name, completed_at, completed_date FROM completions ORDER BY completed_at ASC'
    )
      .all()
      .then(({ results }) => results),
  ])
  return { exportedAt: new Date().toISOString(), home: settings, categories, users, tasks, completions }
}

export async function emptyArchive(env) {
  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM tasks WHERE archived = 1').first()
  await env.DB.prepare('DELETE FROM tasks WHERE archived = 1').run()
  return { removed: count }
}

export async function trimHistory(env) {
  const { count } = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM completions WHERE completed_date < date('now', '-1 year')"
  ).first()
  await env.DB.prepare("DELETE FROM completions WHERE completed_date < date('now', '-1 year')").run()
  return { removed: count }
}

// "Usuń dom na zawsze". Clears the household's data and everyone's access —
// including Better Auth's identities, so no session survives it — but leaves
// the schema in place. The route requires an explicit confirm token so a
// stray client call can't do this by accident.
export async function deleteHomeData(env) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM completions'),
    env.DB.prepare('DELETE FROM tasks'),
    env.DB.prepare('DELETE FROM users'),
    env.DB.prepare('DELETE FROM session'),
    env.DB.prepare('DELETE FROM account'),
    env.DB.prepare('DELETE FROM user'),
    env.DB.prepare("DELETE FROM categories WHERE key NOT IN ('plants', 'equipment', 'home', 'health')"),
    env.DB.prepare(
      "UPDATE home_settings SET name = 'Nasz dom', week_start = 1, default_rhythm = 'weekly', remind_morning = 1, remind_overdue = 0 WHERE id = 1"
    ),
  ])
  return { deleted: true }
}

// --- Better Auth's own tables ---
// The two functions below are the only place this app reads or writes Better
// Auth's schema directly. Everything else goes through `auth.api.*`. They exist
// because the admin plugin authorizes its endpoints against *its* user.role, so
// that column has to be kept in step with ours (ADR 0009).

export async function getAuthUserIdByEmail(env, email) {
  const row = await env.DB.prepare('SELECT id FROM user WHERE email = ?').bind(email).first()
  return row?.id ?? null
}

export async function syncAuthUserRole(env, email, role) {
  await env.DB.prepare('UPDATE user SET role = ? WHERE email = ?').bind(role, email).run()
}
