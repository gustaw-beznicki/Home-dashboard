// Grants (or adjusts) a household member's access directly in D1.
//
//   npm run admin:list                                  # local
//   npm run admin:list -- --remote                      # production
//   npm run admin:grant -- you@example.com              # local, as admin
//   npm run admin:grant -- them@example.com --role member --remote
//   npm run admin:grant -- them@example.com --status revoked --remote
//
// This replaces the INITIAL_ADMIN_EMAIL bootstrap (ADR 0012). That mechanism
// granted admin as a *side effect of a login attempt*, gated on the `users`
// table being empty — a condition that closes silently, exactly once, and can
// never help you again. Locking yourself out then required hand-written SQL.
//
// This is the opposite: explicit, idempotent, re-runnable, and just as useful
// for recovery on day 400 as for setup on day 0. Everything it does is
// something an admin can also do from /admin; it exists for the case where
// nobody can reach /admin yet.
//
// D1's CLI has no bind parameters, so the address is validated strictly and the
// statement is written to a temp file rather than interpolated into a shell
// command.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DB = 'home-dashboard-db'
const ROLES = new Set(['admin', 'member'])
const STATUSES = new Set(['active', 'pending', 'revoked'])

// Deliberately narrower than RFC 5322: no quotes, semicolons, backslashes or
// whitespace can reach the SQL text. Anything this rejects is not an address
// anyone in a household actually has.
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

// Single pass so `--role member` can't have its value mistaken for the address.
const VALUE_FLAGS = new Set(['--role', '--status'])
const options = {}
const positional = []

for (let i = 0; i < process.argv.length - 2; i++) {
  const arg = process.argv[i + 2]
  if (VALUE_FLAGS.has(arg)) {
    options[arg.slice(2)] = process.argv[i + 3]
    i++
  } else if (arg.startsWith('--')) {
    options[arg.slice(2)] = true
  } else {
    positional.push(arg)
  }
}

const flag = (name) => (typeof options[name] === 'string' ? options[name] : null)
const has = (name) => name in options

const remote = has('remote')
const target = remote ? '--remote' : '--local'
const email = positional[0]

// Invoked through node directly rather than `npx … { shell: true }`: no shell
// means nothing to escape, and Node 24 rightly warns about the alternative.
const WRANGLER = path.join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js')
if (!existsSync(WRANGLER)) {
  console.error(`Cannot find wrangler at ${WRANGLER}. Run \`npm install\` first.`)
  process.exit(1)
}

function run(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), 'grant-admin-'))
  const file = path.join(dir, 'stmt.sql')
  try {
    writeFileSync(file, sql, 'utf8')
    return execFileSync(
      process.execPath,
      [WRANGLER, 'd1', 'execute', DB, target, '--file', file, '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function rowsFrom(output) {
  const start = output.indexOf('[')
  if (start === -1) return []
  try {
    return JSON.parse(output.slice(start))[0]?.results ?? []
  } catch {
    return []
  }
}

function list() {
  const rows = rowsFrom(run('SELECT email, role, status, invited_by FROM users ORDER BY created_at;'))
  if (!rows.length) {
    console.log(`\n(no rows in \`users\` — ${remote ? 'production' : 'local'})`)
    console.log('Nobody can sign in until someone is granted access. That is the intended')
    console.log('fail-closed state; run this script with an address to fix it.\n')
    return rows
  }
  console.log(`\n\`users\` — ${remote ? 'PRODUCTION' : 'local'}\n`)
  for (const r of rows) {
    const flags = [r.role, r.status].join(', ')
    console.log(`  ${r.email.padEnd(34)} ${flags}${r.invited_by ? `   (via ${r.invited_by})` : ''}`)
  }
  const admins = rows.filter((r) => r.role === 'admin' && r.status === 'active')
  console.log(`\n  ${rows.length} row(s), ${admins.length} active admin(s)`)
  if (!admins.length) {
    console.log('  ⚠ No active admin — nobody can reach /admin to invite or unblock anyone.')
  }
  console.log()
  return rows
}

if (has('list') || !email) {
  if (!email && !has('list')) {
    console.log('Usage: npm run admin:grant -- <email> [--role admin|member] [--status active|revoked] [--remote]')
    console.log('       npm run admin:list [-- --remote]')
  }
  list()
  process.exit(0)
}

const role = flag('role') ?? 'admin'
const status = flag('status') ?? 'active'

if (!EMAIL.test(email)) {
  console.error(`Refusing to use "${email}" — not a plain email address.`)
  process.exit(1)
}
if (!ROLES.has(role)) {
  console.error(`--role must be one of: ${[...ROLES].join(', ')}`)
  process.exit(1)
}
if (!STATUSES.has(status)) {
  console.error(`--status must be one of: ${[...STATUSES].join(', ')}`)
  process.exit(1)
}

if (remote) {
  console.log('\n⚠ Writing to PRODUCTION D1.\n')
}

// Idempotent: safe to re-run, and equally usable to promote, demote, revoke or
// restore. `invited_by` records that this came from the CLI rather than from a
// person clicking "Zaproś", which is worth being able to tell apart later.
run(`
INSERT INTO users (email, role, status, invited_by)
VALUES ('${email}', '${role}', '${status}', 'cli')
ON CONFLICT(email) DO UPDATE SET role = '${role}', status = '${status}';
`)

console.log(`${email} → role=${role}, status=${status}`)

const rows = list()

// Better Auth mirrors our role into its own `user` table so the admin plugin can
// authorise its endpoints. If an identity already exists, the two are now out of
// step until authorize() repairs it on that person's next request.
const identities = rowsFrom(run(`SELECT email FROM user WHERE email = '${email}';`))
if (identities.length) {
  console.log('Note: this address has already signed in, so Better Auth holds its own copy of')
  console.log('the role. It is repaired automatically on their next request — one reload.\n')
}

if (!rows.some((r) => r.role === 'admin' && r.status === 'active')) {
  process.exitCode = 1
}
