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
      const day = parseMonthlyDay(row.interval_day)
      if (day !== undefined) interval.day = day
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

// The four interval columns always move together — writing one without
// clearing the others would leave a weekly task carrying a stale monthly rule.
function intervalColumns(interval = {}) {
  return {
    type: interval.type,
    n: interval.type === 'everyNDays' ? (interval.n ?? null) : null,
    startsOn: interval.type === 'manual' ? null : (interval.startsOn ?? null),
    weekdays:
      interval.type === 'weekly' && interval.weekdays?.length
        ? JSON.stringify(interval.weekdays)
        : null,
    day: interval.type === 'monthly' ? serializeMonthlyDay(interval.day) : null,
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
    `INSERT INTO tasks (id, name, last_done, interval_type, interval_n, interval_starts_on, interval_weekdays, interval_day, note, category, pinned, archived, created_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      'interval_day = ?'
    )
    values.push(interval.type, interval.n, interval.startsOn, interval.weekdays, interval.day)
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
    'SELECT email, name, role, status, created_at FROM users ORDER BY created_at ASC'
  ).all()
  return results
}

export async function getUserByEmail(env, email) {
  return env.DB.prepare(
    'SELECT email, name, role, status, created_at FROM users WHERE email = ?'
  )
    .bind(email)
    .first()
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
