import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'

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
            ? `Zaproszenie wysłane na ${data.email}.`
            : `${data.email} dodany. E-mail nie został wysłany — przekaż zaproszenie samodzielnie.`
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
    <div className="mx-auto min-h-screen max-w-2xl bg-gray-50 px-4 py-4 dark:bg-gray-900">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Panel administracyjny</h1>
        <a href="/" className="text-sm underline text-gray-500 dark:text-gray-400">
          Wróć do pulpitu
        </a>
      </header>

      <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">Użytkownicy</h2>

        <form onSubmit={handleInvite} className="mb-4 flex gap-2">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="np. partner@gmail.com"
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="member">Domownik</option>
            <option value="admin">Administrator</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Zaproś
          </button>
        </form>

        {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Ładowanie…</p>}
        {error && (
          <p className="mb-2 text-sm text-red-600 dark:text-red-400">
            Coś poszło nie tak. Spróbuj ponownie.
          </p>
        )}
        {notice && (
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">{notice}</p>
        )}

        <ul className="flex flex-col gap-3">
          {users.map((u) => {
            const isSelf = u.email === currentUser?.email
            const isBusy = busyEmail === u.email

            return (
              <li
                key={u.email}
                className="flex flex-col gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700 dark:text-gray-100"
              >
                <div className="flex items-center justify-between">
                  <span>
                    {u.name || u.email} — {u.role === 'admin' ? 'Administrator' : 'Domownik'}
                    {u.status === 'pending' && ' (zaproszony, jeszcze się nie logował)'}
                    {u.status === 'revoked' && ' (zablokowany)'}
                    {isSelf && ' (Ty)'}
                  </span>
                  {!isSelf && u.status !== 'pending' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setStatus(u.email, u.status === 'active')}
                      className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      {u.status === 'active' ? 'Zablokuj' : 'Odblokuj'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
