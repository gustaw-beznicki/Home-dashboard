// Maps between the D1 row shape and the JSON shape the frontend already expects
// (matching the original localStorage task shape, plus additive `completedBy`).
function serializeTask(row) {
  const interval =
    row.interval_type === 'everyNDays'
      ? { type: 'everyNDays', n: row.interval_n }
      : { type: row.interval_type }

  return {
    id: row.id,
    name: row.name,
    lastDone: row.last_done,
    interval,
    priority: row.priority,
    note: row.note,
    category: row.category,
    pinned: !!row.pinned,
    archived: !!row.archived,
    completedBy: row.last_done_by_email
      ? { email: row.last_done_by_email, name: row.last_done_by_name }
      : null,
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
  const intervalType = draft.interval?.type
  const intervalN = intervalType === 'everyNDays' ? draft.interval?.n ?? null : null

  await env.DB.prepare(
    `INSERT INTO tasks (id, name, last_done, interval_type, interval_n, priority, note, category, pinned, archived, created_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      draft.name,
      draft.lastDone ?? null,
      intervalType,
      intervalN,
      draft.priority ?? 'medium',
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
    fields.push('interval_type = ?', 'interval_n = ?')
    values.push(patch.interval.type, patch.interval.type === 'everyNDays' ? patch.interval.n ?? null : null)
  }
  if ('priority' in patch) {
    fields.push('priority = ?')
    values.push(patch.priority)
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
// rows in our database at will. Both read the same rule, so keep them in sync
// by calling this rather than re-deriving the condition.
export async function resolveInvite(env, email) {
  const existing = await getUserByEmail(env, email)
  if (existing) {
    if (existing.status === 'revoked') return { allowed: false, role: null }
    return { allowed: true, role: existing.role }
  }

  // Bootstrap: only while the table is empty, and only for INITIAL_ADMIN_EMAIL.
  // Same condition authorize() uses — a stale row here silently prevents it.
  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()
  if (count === 0 && env.INITIAL_ADMIN_EMAIL && email === env.INITIAL_ADMIN_EMAIL) {
    return { allowed: true, role: 'admin' }
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
