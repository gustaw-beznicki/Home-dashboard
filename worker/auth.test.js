import { describe, expect, it } from 'vitest'
import { authorize, verifyAccessIdentity } from './auth.js'

function makeStatement(sql, db, boundArgs = []) {
  return {
    bind: (...args) => makeStatement(sql, db, args),
    first: async () => db._execFirst(sql, boundArgs),
    run: async () => db._execRun(sql, boundArgs),
  }
}

function createFakeDb(initialUsers = []) {
  const users = new Map(initialUsers.map((u) => [u.email, { ...u }]))
  return {
    prepare(sql) {
      return makeStatement(sql, this)
    },
    _execFirst(sql, args) {
      if (sql.includes('SELECT COUNT(*)')) return { count: users.size }
      if (sql.includes('SELECT email, name, status FROM users WHERE email')) {
        return users.get(args[0]) ?? null
      }
      return null
    },
    _execRun(sql, args) {
      if (sql.startsWith('INSERT INTO users')) {
        const [email, name, status, invitedBy] = args
        users.set(email, { email, name, status, invited_by: invitedBy })
      }
      return { success: true }
    },
  }
}

describe('authorize', () => {
  it('returns the user when active', async () => {
    const db = createFakeDb([{ email: 'a@example.com', name: 'Alice', status: 'active' }])
    const result = await authorize({ email: 'a@example.com', name: 'Alice' }, { DB: db })
    expect(result).toEqual({ email: 'a@example.com', name: 'Alice' })
  })

  it('rejects a revoked user', async () => {
    const db = createFakeDb([{ email: 'a@example.com', name: 'Alice', status: 'revoked' }])
    const result = await authorize({ email: 'a@example.com', name: 'Alice' }, { DB: db })
    expect(result).toBeNull()
  })

  it('rejects an unknown email when the table is non-empty', async () => {
    const db = createFakeDb([{ email: 'a@example.com', name: 'Alice', status: 'active' }])
    const result = await authorize({ email: 'stranger@example.com' }, { DB: db })
    expect(result).toBeNull()
  })

  it('bootstraps the first user only if it matches INITIAL_ADMIN_EMAIL', async () => {
    const db = createFakeDb([])
    const env = { DB: db, INITIAL_ADMIN_EMAIL: 'admin@example.com' }

    const rejected = await authorize({ email: 'someone-else@example.com' }, env)
    expect(rejected).toBeNull()

    const bootstrapped = await authorize({ email: 'admin@example.com', name: 'Admin' }, env)
    expect(bootstrapped).toEqual({ email: 'admin@example.com', name: 'Admin' })
  })

  it('does not re-bootstrap once a user already exists', async () => {
    const db = createFakeDb([{ email: 'admin@example.com', name: 'Admin', status: 'active' }])
    const env = { DB: db, INITIAL_ADMIN_EMAIL: 'admin@example.com' }
    const result = await authorize({ email: 'second@example.com' }, env)
    expect(result).toBeNull()
  })
})

describe('verifyAccessIdentity', () => {
  it('returns a mock identity in dev mode without needing a real Access JWT', async () => {
    const request = new Request('http://localhost/api/tasks')
    const result = await verifyAccessIdentity(request, {
      ENVIRONMENT: 'development',
      DEV_MOCK_EMAIL: 'dev@example.com',
    })
    expect(result).toEqual({ email: 'dev@example.com', name: 'Dev User' })
  })

  it('returns null when no Access JWT header is present outside dev mode', async () => {
    const request = new Request('http://localhost/api/tasks')
    const result = await verifyAccessIdentity(request, { ENVIRONMENT: 'production' })
    expect(result).toBeNull()
  })
})
