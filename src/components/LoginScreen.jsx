import { useState } from 'react'
import { signInWithGoogle } from '../lib/authClient'

// Google is the only sign-in method, so this is a single button rather than a
// form. There's deliberately no sign-up path: the admin portal invites people by
// writing a `users` row, and the Worker refuses to create an identity without
// one (ADR 0009).
export function LoginScreen() {
  const [isBusy, setIsBusy] = useState(false)

  // Set by authClient's errorCallbackURL when the invite gate rejects someone.
  const wasRejected = new URLSearchParams(window.location.search).get('error') === 'not-invited'

  const handleSignIn = () => {
    setIsBusy(true)
    signInWithGoogle().catch(() => setIsBusy(false))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Home Dashboard</h1>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          Zaloguj się, aby zobaczyć zadania domowe.
        </p>

        {wasRejected && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            To konto nie ma dostępu. Poproś administratora o zaproszenie.
          </p>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={isBusy}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isBusy ? 'Przekierowanie…' : 'Zaloguj się przez Google'}
        </button>
      </div>
    </div>
  )
}
