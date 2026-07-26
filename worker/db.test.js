import { describe, expect, it } from 'vitest'

const { completeTask, createTask, listTasks, undoLatestCompletion, updateTask, weekStats } =
  await import('./db.js')

const USER = { email: 'anna@example.com', name: 'Anna' }

// Mirrors the column order in db.js's INSERT. Coupling the fake to that order
// is the point: a mis-bound interval column is exactly the failure this file
// exists to catch.
const INSERT_COLUMNS = [
  'id',
  'name',
  'last_done',
  'interval_type',
  'interval_n',
  'interval_starts_on',
  'interval_weekdays',
  'interval_day',
  'note',
  'category',
  'pinned',
  'archived',
  'created_by_email',
]

function createFakeDb() {
  const tasks = new Map()
  const completions = []

  // Several statements in db.js are multi-line template literals, so match
  // against a whitespace-normalised form rather than the raw text.
  const exec = (raw, args) => {
    const sql = raw.replace(/\s+/g, ' ').trim()

    if (sql.startsWith('INSERT INTO tasks')) {
      const row = Object.fromEntries(INSERT_COLUMNS.map((col, i) => [col, args[i]]))
      tasks.set(row.id, { ...row, created_at: '2026-07-01T00:00:00.000Z' })
      return { success: true }
    }

    if (sql.startsWith('UPDATE tasks SET')) {
      // Field names in binding order; `updated_at = strftime(...)` has no `?`.
      const assignments = sql.slice(sql.indexOf('SET') + 3, sql.lastIndexOf('WHERE')).split(',')
      const columns = assignments
        .filter((part) => part.includes('?'))
        .map((part) => part.split('=')[0].trim())
      const id = args[args.length - 1]
      const row = tasks.get(id)
      columns.forEach((column, i) => {
        row[column] = args[i]
      })
      return { success: true }
    }

    if (sql.startsWith('INSERT INTO completions')) {
      const [id, taskId, email, name, date] = args
      completions.push({
        id,
        task_id: taskId,
        completed_by_email: email,
        completed_by_name: name,
        completed_date: date,
        completed_at: `2026-07-24T00:00:0${completions.length}.000Z`,
      })
      return { success: true }
    }

    if (sql.startsWith('DELETE FROM completions')) {
      const index = completions.findIndex((c) => c.id === args[0])
      if (index >= 0) completions.splice(index, 1)
      return { success: true }
    }

    if (sql.includes('SELECT * FROM tasks WHERE id')) return tasks.get(args[0]) ?? null

    if (sql.includes('FROM completions WHERE task_id')) {
      const rows = completions
        .filter((c) => c.task_id === args[0])
        .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
      return rows[0] ?? null
    }

    return null
  }

  const statement = (raw, args = []) => ({
    bind: (...bound) => statement(raw, bound),
    first: async () => exec(raw, args),
    run: async () => exec(raw, args),
    all: async () => {
      const sql = raw.replace(/\s+/g, ' ').trim()
      if (sql.includes('SELECT * FROM tasks ORDER BY')) return { results: [...tasks.values()] }
      if (sql.includes('FROM completions')) {
        const byPerson = new Map()
        for (const completion of completions) {
          const current = byPerson.get(completion.completed_by_email) ?? {
            name: completion.completed_by_name,
            count: 0,
          }
          current.count += 1
          byPerson.set(completion.completed_by_email, current)
        }
        return { results: [...byPerson.values()] }
      }
      return { results: [] }
    },
  })

  return {
    tasks,
    completions,
    prepare: (sql) => statement(sql),
    batch: async (statements) => Promise.all(statements.map((s) => s.run())),
  }
}

function makeEnv() {
  return { DB: createFakeDb() }
}

async function roundTrip(env, interval) {
  const created = await createTask(
    env,
    { name: 'Test', category: 'home', note: '', interval },
    USER
  )
  const [listed] = await listTasks(env)
  expect(listed.interval).toEqual(created.interval)
  return created.interval
}

describe('interval round-trip', () => {
  it('keeps the anchor on every recurring rhythm', async () => {
    const env = makeEnv()
    expect(await roundTrip(env, { type: 'daily', startsOn: '2026-07-03' })).toEqual({
      type: 'daily',
      startsOn: '2026-07-03',
    })
  })

  it('keeps n for everyNDays', async () => {
    const env = makeEnv()
    expect(await roundTrip(env, { type: 'everyNDays', n: 3, startsOn: '2026-07-03' })).toEqual({
      type: 'everyNDays',
      n: 3,
      startsOn: '2026-07-03',
    })
  })

  it('keeps the weekday list for weekly', async () => {
    const env = makeEnv()
    expect(
      await roundTrip(env, { type: 'weekly', weekdays: [1, 4], startsOn: '2026-07-03' })
    ).toEqual({ type: 'weekly', weekdays: [1, 4], startsOn: '2026-07-03' })
  })

  it.each([
    ['first', 'first'],
    ['last', 'last'],
    ['a day number', 15],
    ['an nth weekday', { nth: 1, weekday: 6 }],
  ])('keeps the monthly rule when it is %s', async (_label, day) => {
    const env = makeEnv()
    expect(await roundTrip(env, { type: 'monthly', day, startsOn: '2026-07-03' })).toEqual({
      type: 'monthly',
      day,
      startsOn: '2026-07-03',
    })
  })

  it('carries no anchor on a manual rhythm', async () => {
    const env = makeEnv()
    expect(await roundTrip(env, { type: 'manual' })).toEqual({ type: 'manual' })
  })
})

describe('updateTask', () => {
  it('clears the columns the new rhythm does not use', async () => {
    const env = makeEnv()
    const task = await createTask(
      env,
      {
        name: 'Test',
        category: 'home',
        interval: { type: 'monthly', day: 'last', startsOn: '2026-07-03' },
      },
      USER
    )

    const updated = await updateTask(env, task.id, {
      interval: { type: 'weekly', weekdays: [2], startsOn: '2026-07-05' },
    })

    // A stale monthly rule left behind here would resurface the moment the
    // rhythm was switched back.
    expect(updated.interval).toEqual({ type: 'weekly', weekdays: [2], startsOn: '2026-07-05' })
    expect(env.DB.tasks.get(task.id).interval_day).toBeNull()
  })

  it('accepts lastDone, which the rhythm editor needs to be correctable', async () => {
    const env = makeEnv()
    const task = await createTask(
      env,
      { name: 'Test', category: 'home', interval: { type: 'daily', startsOn: '2026-07-03' } },
      USER
    )

    expect((await updateTask(env, task.id, { lastDone: '2026-07-20' })).lastDone).toBe('2026-07-20')
    expect((await updateTask(env, task.id, { lastDone: null })).lastDone).toBeNull()
  })
})

describe('undoLatestCompletion', () => {
  it('drops the newest completion and recomputes the cache from what is left', async () => {
    const env = makeEnv()
    const task = await createTask(
      env,
      { name: 'Test', category: 'home', interval: { type: 'daily', startsOn: '2026-07-03' } },
      USER
    )

    await completeTask(env, task.id, USER, '2026-07-20')
    await completeTask(env, task.id, { email: 'kuba@example.com', name: 'Kuba' }, '2026-07-24')

    const undone = await undoLatestCompletion(env, task.id)

    expect(env.DB.completions).toHaveLength(1)
    expect(undone.lastDone).toBe('2026-07-20')
    expect(undone.completedBy).toEqual({ email: USER.email, name: USER.name })
  })

  it('clears the cache when the undone completion was the only one', async () => {
    const env = makeEnv()
    const task = await createTask(
      env,
      { name: 'Test', category: 'home', interval: { type: 'daily', startsOn: '2026-07-03' } },
      USER
    )
    await completeTask(env, task.id, USER, '2026-07-24')

    const undone = await undoLatestCompletion(env, task.id)

    expect(env.DB.completions).toHaveLength(0)
    expect(undone.lastDone).toBeNull()
    expect(undone.completedBy).toBeNull()
  })

  it('reports a missing task rather than inventing one', async () => {
    expect(await undoLatestCompletion(makeEnv(), 'nope')).toBeNull()
  })
})

describe('weekStats', () => {
  it('counts every completion, not just the newest one per task', async () => {
    const env = makeEnv()
    const task = await createTask(
      env,
      { name: 'Test', category: 'home', interval: { type: 'daily', startsOn: '2026-07-03' } },
      USER
    )

    await completeTask(env, task.id, USER, '2026-07-22')
    await completeTask(env, task.id, USER, '2026-07-23')
    await completeTask(env, task.id, { email: 'kuba@example.com', name: 'Kuba' }, '2026-07-24')

    expect(await weekStats(env)).toEqual({
      total: 3,
      byPerson: [
        { name: 'Anna', count: 2 },
        { name: 'Kuba', count: 1 },
      ],
    })
  })
})
