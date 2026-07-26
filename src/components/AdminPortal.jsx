import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, Mail, ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { COPY } from '../lib/constants'

// Status as a word in a chip, never colour alone — and the literal class
// strings live here so Tailwind's JIT scanner can see them.
const STATUS_CHIP_CLASS = {
  pending: 'bg-amber-100 text-amber-500 dark:bg-[#332a19] dark:text-[#e0b073]',
  revoked: 'bg-clay-100 text-clay-700 dark:bg-[#3a2018] dark:text-[#f0a58a]',
  active: 'bg-moss-200 text-moss-700 dark:bg-bark-700 dark:text-moss-400',
  self: 'bg-moss-200 text-moss-700 dark:bg-bark-700 dark:text-moss-400',
}

const RESULT_CLASS = {
  emailed: 'bg-moss-100 text-moss-800 dark:bg-bark-700 dark:text-moss-300',
  'no-email': 'bg-amber-100 text-amber-500 dark:bg-[#332a19] dark:text-[#e0b073]',
  error: 'bg-clay-100 text-clay-700 dark:bg-[#3a2018] dark:text-[#f0a58a]',
}

function statusChip(user, isSelf) {
  if (isSelf) return { key: 'self', text: COPY.admin.you }
  if (user.status === 'pending') return { key: 'pending', text: COPY.admin.pending }
  if (user.status === 'revoked') return { key: 'revoked', text: COPY.admin.revoked }
  return { key: 'active', text: COPY.admin.active }
}

/**
 * Domownicy — invitations, roles and access. Self-contained: fetches its own
 * list, so the standalone /admin page and the Panel domu section (via
 * `embedded`) stay one component rather than two drifting lists.
 *
 * There is deliberately no MFA control and no password-reset action here.
 * Google is the only sign-in method, so two-factor enrolment and account
 * recovery both belong to the Google account and aren't ours to manage — see
 * ADR 0009.
 */
export function AdminPortal({ embedded = false }) {
  const { user: currentUser } = useCurrentUser()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')

  const [busyEmail, setBusyEmail] = useState(null)
  // { kind: 'emailed' | 'no-email' | 'error', text }
  const [result, setResult] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    fetch('/api/admin/users')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load users'))))
      .then((data) => {
        setUsers(data)
        setError(null)
      })
      .catch(setError)
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleInvite = (e) => {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return
    fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: inviteRole }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to invite user'))))
      .then((data) => {
        setInviteEmail('')
        setInviteRole('member')
        // The invite is the D1 row; the email is a courtesy that can fail
        // independently, so say which happened rather than implying both.
        setResult(
          data.emailed
            ? { kind: 'emailed', text: COPY.admin.invitedEmailed(data.email) }
            : { kind: 'no-email', text: COPY.admin.invitedNoEmail(data.email) }
        )
        load()
      })
      .catch(() => setResult({ kind: 'error', text: COPY.admin.error }))
  }

  const setStatus = (email, blocked) => {
    setBusyEmail(email)
    fetch(`/api/admin/users/${encodeURIComponent(email)}/${blocked ? 'block' : 'unblock'}`, {
      method: 'POST',
    })
      .then((res) => (res.ok ? load() : Promise.reject(new Error('Failed to update user'))))
      .catch(setError)
      .finally(() => setBusyEmail(null))
  }

  const setRole = (email, role) => {
    setBusyEmail(email)
    fetch(`/api/admin/users/${encodeURIComponent(email)}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
      .then((res) => {
        if (res.ok) return load()
        // The one refusal worth its own words: the last gospodarz stays one.
        if (res.status === 409) {
          setResult({ kind: 'error', text: COPY.admin.lastAdmin })
          return
        }
        return Promise.reject(new Error('Failed to update role'))
      })
      .catch(setError)
      .finally(() => setBusyEmail(null))
  }

  const body = (
    <>
      {!embedded && (
        <a
          href="/"
          className="mb-4.5 inline-flex items-center gap-2 text-[13.5px] text-moss-700 hover:text-moss-900 dark:text-moss-400 dark:hover:text-moss-200"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          {COPY.admin.back}
        </a>
      )}

      <h1 className="text-[28px] leading-[1.15] text-moss-900 lg:text-[30px] dark:text-moss-100">
        {COPY.admin.title}
      </h1>
      <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-moss-600 dark:text-moss-500">
        {COPY.admin.subtitle}
      </p>

      <form onSubmit={handleInvite} className="mt-4.5 rounded-hero bg-white p-4 sm:p-5 dark:bg-bark-800">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-moss-300 px-3.5 py-3 focus-within:border-forest-500 sm:min-w-[260px] dark:border-bark-600">
            <Mail size={16} strokeWidth={1.8} className="shrink-0 text-moss-600" />
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={COPY.admin.emailPlaceholder}
              aria-label={COPY.admin.emailPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-moss-900 outline-none placeholder:text-moss-500 dark:text-moss-100"
            />
          </label>
          <div className="flex gap-1.5">
            {[
              { key: 'member', label: COPY.admin.roleMember },
              { key: 'admin', label: COPY.admin.roleAdmin },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={inviteRole === r.key}
                onClick={() => setInviteRole(r.key)}
                className={[
                  'flex-1 rounded-2xl px-4 py-3 text-[13.5px] transition sm:flex-none',
                  inviteRole === r.key
                    ? 'bg-forest-600 font-medium text-moss-100 dark:bg-[#3a5842]'
                    : 'bg-moss-100 text-moss-700 hover:bg-moss-200 dark:bg-bark-700 dark:text-moss-400',
                ].join(' ')}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="w-full rounded-full bg-lime-400 px-6.5 py-3 text-[14.5px] font-medium text-[#20321f] transition hover:bg-lime-300 sm:w-auto sm:rounded-2xl sm:text-[14px]"
          >
            {COPY.admin.invite}
          </button>
        </div>

        {result && (
          <p
            aria-live="polite"
            className={['mt-3 flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed', RESULT_CLASS[result.kind]].join(' ')}
          >
            {result.kind === 'emailed' ? (
              <Check size={16} strokeWidth={1.9} className="mt-0.5 shrink-0" />
            ) : (
              <TriangleAlert size={16} strokeWidth={1.9} className="mt-0.5 shrink-0" />
            )}
            {result.text}
          </p>
        )}
        <p className="mt-2.5 hidden text-[12px] text-moss-500 sm:block">{COPY.admin.emailNote}</p>
      </form>

      {isLoading && (
        <p className="py-8 text-center text-[13.5px] text-moss-600 dark:text-moss-500">
          {COPY.admin.loading}
        </p>
      )}
      {error && (
        <div className="mt-4 rounded-hero bg-white px-4 py-5 text-center dark:bg-bark-800">
          <p className="text-[14px] text-moss-900 dark:text-moss-100">{COPY.admin.error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-full bg-forest-600 px-5 py-2.5 text-[13.5px] font-medium text-moss-100 dark:bg-[#3a5842]"
          >
            {COPY.retry}
          </button>
        </div>
      )}

      {/* Standalone /admin lays the household out two-up on a wide screen; the
          panel's embedded list stays one column to leave room for the role
          action, exactly as the design splits them. */}
      <ul className={['mt-4.5 gap-2.5', embedded ? 'flex flex-col' : 'grid lg:grid-cols-2'].join(' ')}>
        {users.map((user) => {
          const isSelf = user.email === currentUser?.email
          const isBusy = busyEmail === user.email
          const blocked = user.status === 'revoked'
          const chip = statusChip(user, isSelf)

          return (
            <li
              key={user.email}
              className="flex items-center gap-3.5 rounded-card bg-white px-4 py-3.5 dark:bg-bark-800"
            >
              <span
                className={[
                  'grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-moss-200 text-[15px] text-moss-700 dark:bg-bark-700 dark:text-moss-400',
                  blocked ? 'opacity-50' : '',
                ].join(' ')}
              >
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-moss-900 dark:text-moss-100">
                  {user.name || user.email}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-moss-600 dark:text-moss-500">
                  {user.role === 'admin' ? COPY.admin.roleAdmin : COPY.admin.roleMember}
                  <span className={['rounded-full px-2 py-0.5 text-[11.5px]', STATUS_CHIP_CLASS[chip.key]].join(' ')}>
                    {chip.text}
                  </span>
                </p>
              </div>

              {/* Own row has no actions — an admin can't lock themselves out. */}
              {!isSelf && (
                <div className="flex shrink-0 items-center gap-2">
                  {embedded && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setRole(user.email, user.role === 'admin' ? 'member' : 'admin')}
                      className="hidden h-[38px] items-center rounded-full bg-moss-50 px-3.5 text-[12.5px] text-moss-700 transition hover:bg-moss-200 disabled:opacity-50 sm:flex dark:bg-bark-700 dark:text-moss-400 dark:hover:bg-bark-600"
                    >
                      {user.role === 'admin' ? COPY.admin.makeMember : COPY.admin.makeAdmin}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setStatus(user.email, !blocked)}
                    aria-label={blocked ? COPY.admin.unblock : COPY.admin.block}
                    title={blocked ? COPY.admin.unblock : COPY.admin.block}
                    className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-moss-50 transition hover:bg-moss-200 disabled:opacity-50 sm:h-[38px] sm:w-auto sm:gap-2 sm:px-3.5 dark:bg-bark-700 dark:hover:bg-bark-600"
                  >
                    {blocked ? (
                      <ShieldCheck size={16} strokeWidth={1.8} className="text-moss-700 dark:text-moss-400" />
                    ) : (
                      <ShieldOff size={16} strokeWidth={1.8} className="text-clay-500 dark:text-[#f0a58a]" />
                    )}
                    <span className={['hidden text-[12.5px] sm:inline', blocked ? 'text-moss-700 dark:text-moss-400' : 'text-clay-500 dark:text-[#f0a58a]'].join(' ')}>
                      {blocked ? COPY.admin.unblock : COPY.admin.block}
                    </span>
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )

  // Embedded in Panel domu it renders just the section; standalone /admin gets
  // the full page shell.
  if (embedded) return <section>{body}</section>

  return (
    <div className="min-h-screen bg-moss-100 font-sans text-moss-900 dark:bg-bark-900 dark:text-moss-100">
      <div className="mx-auto max-w-[980px] px-4.5 py-5.5 sm:px-6">{body}</div>
    </div>
  )
}
