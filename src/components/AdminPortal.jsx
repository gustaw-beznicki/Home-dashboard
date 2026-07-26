import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { COPY } from '../lib/constants'

function statusNote(user, isSelf) {
  const notes = []
  if (user.status === 'pending') notes.push(COPY.admin.pending)
  if (user.status === 'revoked') notes.push(COPY.admin.revoked)
  if (isSelf) notes.push(COPY.admin.you)
  return notes.join(' · ')
}

export function AdminPortal() {
  const { user: currentUser } = useCurrentUser()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')

  const [busyEmail, setBusyEmail] = useState(null)
  const [notice, setNotice] = useState(null)

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
        setNotice(
          data.emailed
            ? COPY.admin.invitedEmailed(data.email)
            : COPY.admin.invitedNoEmail(data.email)
        )
        load()
      })
      .catch(setError)
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

  // There is deliberately no MFA control and no password-reset action here.
  // Google is the only sign-in method, so two-factor enrolment and account
  // recovery both belong to the Google account and aren't ours to manage — see
  // ADR 0009.

  return (
    <div className="min-h-screen bg-moss-100 dark:bg-bark-900">
      <div className="mx-auto max-w-2xl px-4.5 py-5.5">
        <header className="mb-5.5 flex items-center justify-between gap-3">
          <h1 className="text-[26px] leading-[1.2] text-moss-900 dark:text-moss-100">
            {COPY.admin.title}
          </h1>
          <a
            href="/"
            className="flex items-center gap-1.5 text-[13px] text-moss-600 hover:underline dark:text-moss-500"
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            {COPY.admin.back}
          </a>
        </header>

        <form onSubmit={handleInvite} className="mb-5.5 flex flex-wrap gap-2">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={COPY.admin.emailPlaceholder}
            aria-label={COPY.admin.emailPlaceholder}
            className="h-[52px] min-w-0 flex-1 rounded-full bg-white px-4.5 text-[14px] text-moss-900 shadow-card outline-none placeholder:text-moss-500 focus:ring-2 focus:ring-forest-500 dark:bg-bark-800 dark:text-moss-100"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            aria-label="Rola"
            className="h-[52px] rounded-full bg-white px-4 text-[14px] text-moss-800 shadow-card outline-none dark:bg-bark-800 dark:text-moss-300"
          >
            <option value="member">{COPY.admin.roleMember}</option>
            <option value="admin">{COPY.admin.roleAdmin}</option>
          </select>
          <button
            type="submit"
            className="h-[52px] rounded-full bg-forest-600 px-6 text-[14.5px] font-medium text-moss-100"
          >
            {COPY.admin.invite}
          </button>
        </form>

        {isLoading && (
          <p className="text-[13.5px] text-moss-600 dark:text-moss-500">{COPY.admin.loading}</p>
        )}
        {error && <p className="mb-3 text-[13.5px] text-clay-500">{COPY.admin.error}</p>}
        {notice && (
          <p className="mb-3 rounded-2xl bg-moss-200 px-4 py-3 text-[13px] text-moss-800 dark:bg-bark-800 dark:text-moss-300">
            {notice}
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {users.map((user) => {
            const isSelf = user.email === currentUser?.email
            const isBusy = busyEmail === user.email
            const note = statusNote(user, isSelf)

            return (
              <li
                key={user.email}
                className="flex items-center gap-3.5 rounded-card bg-white px-4 py-3.5 shadow-card dark:bg-bark-800"
              >
                <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-2xl bg-moss-200 text-[15px] text-moss-700 dark:bg-bark-700 dark:text-moss-400">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-moss-900 dark:text-moss-100">
                    {user.name || user.email}
                  </p>
                  <p className="truncate text-[12.5px] text-moss-600 dark:text-moss-500">
                    {user.role === 'admin' ? COPY.admin.roleAdmin : COPY.admin.roleMember}
                    {note && ` · ${note}`}
                  </p>
                </div>

                {!isSelf && user.status !== 'pending' && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setStatus(user.email, user.status === 'active')}
                    className={[
                      'shrink-0 rounded-full px-4 py-2.5 text-[13px] font-medium disabled:opacity-50',
                      user.status === 'active'
                        ? 'bg-clay-100 text-clay-500 dark:bg-[#3a2018] dark:text-[#f0a58a]'
                        : 'bg-moss-100 text-moss-700 dark:bg-bark-700 dark:text-moss-400',
                    ].join(' ')}
                  >
                    {user.status === 'active' ? COPY.admin.block : COPY.admin.unblock}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
