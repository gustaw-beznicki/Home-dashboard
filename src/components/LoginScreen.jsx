import { useState } from 'react'
import { Home } from 'lucide-react'
import { signInWithGoogle } from '../lib/authClient'
import { COPY } from '../lib/constants'

// Google is the only sign-in method, so this is a single button rather than a
// form. There's deliberately no sign-up path: the admin portal invites people by
// writing a `users` row, and the Worker refuses to create an identity without
// one (ADR 0009).
export function LoginScreen() {
  const [isBusy, setIsBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // Set by authClient's errorCallbackURL when the invite gate rejects someone.
  const rejected = new URLSearchParams(window.location.search).get('error') === 'not-invited'

  // Surface failures rather than just un-pressing the button. Swallowing this
  // made a server-side 500 look like a dead button, with the real cause visible
  // only in devtools.
  const handleSignIn = async () => {
    setIsBusy(true)
    setFailed(false)
    try {
      const result = await signInWithGoogle()
      // better-auth's client resolves with { error } rather than throwing on a
      // non-2xx, so awaiting alone isn't enough to notice a failure.
      if (result?.error) throw new Error(result.error.message || 'Sign-in failed')
    } catch (err) {
      console.error('Google sign-in failed', err)
      setFailed(true)
      setIsBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-moss-100 px-4.5 dark:bg-bark-900">
      <div className="w-full max-w-sm rounded-hero bg-white p-6.5 shadow-card dark:bg-bark-800">
        <span className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-forest-600 text-lime-400">
          <Home size={21} strokeWidth={1.8} />
        </span>

        <h1 className="text-[26px] leading-[1.2] text-moss-900 sm:text-[30px] dark:text-moss-100">
          {COPY.login.tagline}
        </h1>
        <p className="mb-5.5 mt-2 text-[13.5px] leading-relaxed text-moss-600 dark:text-moss-500">
          {COPY.login.lead}
        </p>

        {(rejected || failed) && (
          <p className="mb-4.5 rounded-2xl bg-clay-100 px-4 py-3.5 text-[13px] leading-relaxed text-clay-500 dark:bg-[#3a2018] dark:text-[#f0a58a]">
            {rejected ? COPY.login.denied : COPY.login.failed}
          </p>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={isBusy}
          className="h-[54px] w-full rounded-full bg-forest-600 text-[14.5px] font-medium text-moss-100 disabled:opacity-50"
        >
          {isBusy ? COPY.login.redirecting : COPY.login.button}
        </button>
      </div>
    </div>
  )
}
