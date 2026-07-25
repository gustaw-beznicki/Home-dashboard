import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuthenticateRequest = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: mockAuthenticateRequest,
    users: { getUser: mockGetUser },
  }),
}))

const { authorize, requireAdmin, verifyClerkIdentity } = await import('./auth.js')

function makeStatement(sql, db, boundArgs = []) {
  return {
    bind: (...args) => makeStatement(sql, db, args),
    first: async () => db._execFirst(sql, boundArgs),
    run: async () => db._execRun(sql, boundArgs),
  }
}

function createFakeDb(initialUsers = []) {
  const users = new Map(initialUsers.map((u) => [u.email, { role: 'member', ...u }]))
  return {
    prepare(sql) {
      return makeStatement(sql, this)
    },
    _execFirst(sql, args) {
      if (sql.includes('SELECT COUNT(*)')) return { count: users.size }
      if (sql.includes('SELECT email, name, role, status FROM users WHERE email')) {
        return users.get(args[0]) ?? null
      }
      return null
    },
    _execRun(sql, args) {
      if (sql.startsWith('INSERT INTO users')) {
        const [email, name, clerkUserId] = args
        users.set(email, {
          email,
          name,
          role: 'admin',
          status: 'active',
          clerk_user_id: clerkUserId,
          invited_by: 'bootstrap',
        })
      }
      return { success: true }
    },
  }
}

describe('authorize', () => {
  it('returns the user and role when active', async () => {
    const db = createFakeDb([{ email: 'a@example.com', name: 'Alice', role: 'member', status: 'active' }])
    const result = await authorize({ email: 'a@example.com', name: 'Alice' }, { DB: db })
    expect(result).toEqual({ email: 'a@example.com', name: 'Alice', role: 'member' })
  })

  it('rejects a revoked user', async () => {
    const db = createFakeDb([{ email: 'a@example.com', name: 'Alice', role: 'member', status: 'revoked' }])
    const result = await authorize({ email: 'a@example.com', name: 'Alice' }, { DB: db })
    expect(result).toBeNull()
  })

  it('rejects an unknown email when the table is non-empty', async () => {
    const db = createFakeDb([{ email: 'a@example.com', name: 'Alice', role: 'member', status: 'active' }])
    const result = await authorize({ email: 'stranger@example.com' }, { DB: db })
    expect(result).toBeNull()
  })

  it('bootstraps the first user as admin only if it matches INITIAL_ADMIN_EMAIL', async () => {
    const db = createFakeDb([])
    const env = { DB: db, INITIAL_ADMIN_EMAIL: 'admin@example.com' }

    const rejected = await authorize({ email: 'someone-else@example.com' }, env)
    expect(rejected).toBeNull()

    const bootstrapped = await authorize(
      { email: 'admin@example.com', name: 'Admin', clerkUserId: 'user_admin' },
      env
    )
    expect(bootstrapped).toEqual({ email: 'admin@example.com', name: 'Admin', role: 'admin' })
  })

  it('does not re-bootstrap once a user already exists', async () => {
    const db = createFakeDb([{ email: 'admin@example.com', name: 'Admin', role: 'admin', status: 'active' }])
    const env = { DB: db, INITIAL_ADMIN_EMAIL: 'admin@example.com' }
    const result = await authorize({ email: 'second@example.com' }, env)
    expect(result).toBeNull()
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

describe('verifyClerkIdentity', () => {
  beforeEach(() => {
    mockAuthenticateRequest.mockReset()
    mockGetUser.mockReset()
  })

  it('returns null when the request is not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ isAuthenticated: false })
    const request = new Request('http://localhost/api/tasks')
    const result = await verifyClerkIdentity(request, {})
    expect(result).toBeNull()
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('resolves email/name/clerkUserId for an authenticated request', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: 'user_123' }),
    })
    mockGetUser.mockResolvedValue({
      id: 'user_123',
      firstName: 'Dev',
      lastName: 'User',
      primaryEmailAddressId: 'email_1',
      emailAddresses: [{ id: 'email_1', emailAddress: 'dev@example.com' }],
    })

    const request = new Request('http://localhost/api/tasks')
    const result = await verifyClerkIdentity(request, {})
    expect(result).toEqual({ email: 'dev@example.com', name: 'Dev User', clerkUserId: 'user_123' })
  })

  it('returns null when the Clerk user has no primary email address', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: 'user_123' }),
    })
    mockGetUser.mockResolvedValue({
      id: 'user_123',
      firstName: null,
      lastName: null,
      primaryEmailAddressId: null,
      emailAddresses: [],
    })

    const request = new Request('http://localhost/api/tasks')
    const result = await verifyClerkIdentity(request, {})
    expect(result).toBeNull()
  })
})
