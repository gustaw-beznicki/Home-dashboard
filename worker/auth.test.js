import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetSession = vi.fn()

// betterAuth.js imports `cloudflare:workers`, which doesn't resolve outside the
// Workers runtime — mocking it here keeps that module out of the test graph
// entirely, which is also why the real one can safely build at module scope.
vi.mock('./betterAuth.js', () => ({
  auth: { api: { getSession: mockGetSession } },
}))

const { authorize, requireAdmin, verifySession } = await import('./auth.js')
const { resolveInvite } = await import('./db.js')

function makeStatement(sql, db, boundArgs = []) {
  return {
    bind: (...args) => makeStatement(sql, db, args),
    first: async () => db._execFirst(sql, boundArgs),
    run: async () => db._execRun(sql, boundArgs),
  }
}

function createFakeDb(initialUsers = []) {
  const users = new Map(initialUsers.map((u) => [u.email, { role: 'member', ...u }]))
  const authUsers = new Map()
  const statements = []

  return {
    users,
    authUsers,
    statements,
    prepare(sql) {
      return makeStatement(sql, this)
    },
    _execFirst(sql, args) {
      statements.push({ sql, args })
      if (sql.includes('SELECT COUNT(*)')) return { count: users.size }
      if (sql.includes('FROM users WHERE email')) return users.get(args[0]) ?? null
      if (sql.includes('SELECT id FROM user WHERE email')) return authUsers.get(args[0]) ?? null
      return null
    },
    _execRun(sql, args) {
      statements.push({ sql, args })
      if (sql.startsWith('INSERT INTO users')) {
        const [email, name] = args
        users.set(email, {
          email,
          name,
          role: 'admin',
          status: 'active',
          invited_by: 'bootstrap',
        })
      }
      if (sql.startsWith('UPDATE user SET role')) {
        const [role, email] = args
        authUsers.set(email, { id: `auth_${email}`, role })
      }
      return { success: true }
    },
  }
}

describe('authorize', () => {
  it('returns the user and role when active', async () => {
    const db = createFakeDb([
      { email: 'a@example.com', name: 'Alice', role: 'member', status: 'active' },
    ])
    const result = await authorize({ email: 'a@example.com', name: 'Alice' }, { DB: db })
    expect(result).toEqual({ email: 'a@example.com', name: 'Alice', role: 'member' })
  })

  it('rejects a revoked user', async () => {
    const db = createFakeDb([
      { email: 'a@example.com', name: 'Alice', role: 'member', status: 'revoked' },
    ])
    const result = await authorize({ email: 'a@example.com', name: 'Alice' }, { DB: db })
    expect(result).toBeNull()
  })

  it('rejects a pending user who has not signed in yet', async () => {
    const db = createFakeDb([
      { email: 'new@example.com', name: null, role: 'member', status: 'pending' },
    ])
    const result = await authorize({ email: 'new@example.com' }, { DB: db })
    expect(result).toBeNull()
  })

  it('rejects an unknown email when the table is non-empty', async () => {
    const db = createFakeDb([
      { email: 'a@example.com', name: 'Alice', role: 'member', status: 'active' },
    ])
    const result = await authorize({ email: 'stranger@example.com' }, { DB: db })
    expect(result).toBeNull()
  })

  it('bootstraps the first user as admin only if it matches INITIAL_ADMIN_EMAIL', async () => {
    const db = createFakeDb([])
    const env = { DB: db, INITIAL_ADMIN_EMAIL: 'admin@example.com' }

    const rejected = await authorize({ email: 'someone-else@example.com' }, env)
    expect(rejected).toBeNull()

    const bootstrapped = await authorize({ email: 'admin@example.com', name: 'Admin' }, env)
    expect(bootstrapped).toEqual({ email: 'admin@example.com', name: 'Admin', role: 'admin' })
  })

  it('does not re-bootstrap once a user already exists', async () => {
    const db = createFakeDb([
      { email: 'admin@example.com', name: 'Admin', role: 'admin', status: 'active' },
    ])
    const env = { DB: db, INITIAL_ADMIN_EMAIL: 'admin@example.com' }
    const result = await authorize({ email: 'second@example.com' }, env)
    expect(result).toBeNull()
  })
})

// The admin plugin authorizes its own endpoints against Better Auth's user.role,
// so the two copies drifting would 403 admin API calls while the portal still
// rendered. authorize() repairs it on the way through.
describe('authorize role reconciliation', () => {
  it('repairs Better Auth’s role when it disagrees with ours', async () => {
    const db = createFakeDb([
      { email: 'a@example.com', name: 'Alice', role: 'admin', status: 'active' },
    ])
    const result = await authorize({ email: 'a@example.com', role: 'member' }, { DB: db })

    expect(result.role).toBe('admin')
    expect(db.authUsers.get('a@example.com')).toEqual({ id: 'auth_a@example.com', role: 'admin' })
  })

  it('writes nothing when the roles already agree', async () => {
    const db = createFakeDb([
      { email: 'a@example.com', name: 'Alice', role: 'member', status: 'active' },
    ])
    await authorize({ email: 'a@example.com', role: 'member' }, { DB: db })
    expect(db.statements.some((s) => s.sql.startsWith('UPDATE user SET role'))).toBe(false)
  })

  it('writes nothing when the session carries no role yet', async () => {
    const db = createFakeDb([
      { email: 'a@example.com', name: 'Alice', role: 'admin', status: 'active' },
    ])
    await authorize({ email: 'a@example.com', role: null }, { DB: db })
    expect(db.statements.some((s) => s.sql.startsWith('UPDATE user SET role'))).toBe(false)
  })
})

// The gate that stops an uninvited Google account creating rows in our database.
// authorize() independently refuses it *access*, so a bypass here would mean junk
// rows rather than an authorization hole — but it should hold.
describe('resolveInvite', () => {
  it('denies an email with no users row', async () => {
    const db = createFakeDb([{ email: 'a@example.com', role: 'member', status: 'active' }])
    await expect(resolveInvite({ DB: db }, 'stranger@example.com')).resolves.toEqual({
      allowed: false,
      role: null,
    })
  })

  it('allows an invited (pending) email and carries its role through', async () => {
    const db = createFakeDb([{ email: 'new@example.com', role: 'admin', status: 'pending' }])
    await expect(resolveInvite({ DB: db }, 'new@example.com')).resolves.toEqual({
      allowed: true,
      role: 'admin',
    })
  })

  it('denies a revoked email', async () => {
    const db = createFakeDb([{ email: 'gone@example.com', role: 'member', status: 'revoked' }])
    await expect(resolveInvite({ DB: db }, 'gone@example.com')).resolves.toEqual({
      allowed: false,
      role: null,
    })
  })

  it('allows the bootstrap admin only while the table is empty', async () => {
    const empty = { DB: createFakeDb([]), INITIAL_ADMIN_EMAIL: 'admin@example.com' }
    await expect(resolveInvite(empty, 'admin@example.com')).resolves.toEqual({
      allowed: true,
      role: 'admin',
    })

    const populated = {
      DB: createFakeDb([{ email: 'someone@example.com', role: 'member', status: 'active' }]),
      INITIAL_ADMIN_EMAIL: 'admin@example.com',
    }
    await expect(resolveInvite(populated, 'admin@example.com')).resolves.toEqual({
      allowed: false,
      role: null,
    })
  })

  it('denies the bootstrap path when INITIAL_ADMIN_EMAIL is unset', async () => {
    await expect(resolveInvite({ DB: createFakeDb([]) }, 'anyone@example.com')).resolves.toEqual({
      allowed: false,
      role: null,
    })
  })
})

describe('requireAdmin', () => {
  it('allows an admin through', () => {
    expect(requireAdmin({ user: { role: 'admin' } })).toEqual({})
  })

  it('rejects a non-admin with 403', async () => {
    const result = requireAdmin({ user: { role: 'member' } })
    expect(result.response.status).toBe(403)
    expect(await result.response.json()).toEqual({ error: 'Admin only' })
  })
})

describe('verifySession', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
  })

  it('returns null when there is no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await verifySession(new Request('http://localhost/api/tasks'))
    expect(result).toBeNull()
  })

  it('returns null when the session has no email', async () => {
    mockGetSession.mockResolvedValue({ user: { name: 'No Email' } })
    const result = await verifySession(new Request('http://localhost/api/tasks'))
    expect(result).toBeNull()
  })

  it('maps email, name and the mirrored role for a signed-in request', async () => {
    mockGetSession.mockResolvedValue({
      user: { email: 'dev@example.com', name: 'Dev User', role: 'admin' },
    })
    const result = await verifySession(new Request('http://localhost/api/tasks'))
    expect(result).toEqual({ email: 'dev@example.com', name: 'Dev User', role: 'admin' })
  })

  it('passes the request headers through to Better Auth', async () => {
    mockGetSession.mockResolvedValue({ user: { email: 'dev@example.com' } })
    const request = new Request('http://localhost/api/tasks', { headers: { cookie: 'a=b' } })
    await verifySession(request)
    expect(mockGetSession).toHaveBeenCalledWith({ headers: request.headers })
  })
})
