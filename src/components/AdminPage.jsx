import { useCallback, useEffect, useState } from 'react'

export function AdminPage({ currentUserEmail }) {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    fetch('/api/users')
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

  const handleAdd = (e) => {
    e.preventDefault()
    const email = newEmail.trim()
    if (!email) return
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then((res) => (res.ok ? null : Promise.reject(new Error('Failed to add user'))))
      .then(() => {
        setNewEmail('')
        load()
      })
      .catch(setError)
  }

  const handleRevoke = (email) => {
    fetch(`/api/users/${encodeURIComponent(email)}`, { method: 'DELETE' })
      .then(() => load())
      .catch(setError)
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">Użytkownicy</h2>

      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="np. partner@gmail.com"
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Dodaj
        </button>
      </form>

      {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Ładowanie…</p>}
      {error && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">
          Coś poszło nie tak. Spróbuj ponownie.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li
            key={u.email}
            className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700 dark:text-gray-100"
          >
            <span>
              {u.name || u.email}
              {u.status === 'revoked' && ' (odwołano)'}
              {u.email === currentUserEmail && ' (Ty)'}
            </span>
            {u.status === 'active' && u.email !== currentUserEmail && (
              <button
                type="button"
                onClick={() => handleRevoke(u.email)}
                className="text-red-600 hover:underline dark:text-red-400"
              >
                Odwołaj
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
