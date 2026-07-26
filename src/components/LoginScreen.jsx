import { useState } from 'react'
import { Sprout, Droplets } from 'lucide-react'
import { Logo } from './Logo'
import { signInWithGoogle } from '../lib/authClient'
import { COPY } from '../lib/constants'

// The teaser strip on the right-hand panel — static by design: this screen
// renders before any session exists, so it shows the *shape* of the product,
// not live data.
const TEASE_BARS = [14, 44, 12, 28, 12, 36, 12, 22, 12, 32, 12, 20]
const TEASE_LABELS = ['pt', 'sob', 'nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sob', 'nd', 'pn', 'wt']

// Google is the only sign-in method, so this is a single button rather than a
// form. There's deliberately no sign-up path: the admin portal invites people by
// writing a `users` row, and the Worker refuses to create an identity without
// one (ADR 0009). The desktop layout doesn't centre a card — the right panel
// previews what's waiting inside, so the first impression shows the product.
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
    <div className="min-h-screen bg-moss-100 font-sans lg:flex dark:bg-bark-900">
      <main className="flex min-h-screen flex-col px-6.5 lg:min-h-0 lg:flex-1 lg:justify-center lg:px-[76px] lg:py-12">
        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center lg:mx-0 lg:max-w-[520px] lg:flex-none">
          <div className="mb-5.5 lg:mb-7">
            <Logo size={null} className="h-auto w-full max-w-[168px] text-forest-600 lg:max-w-[112px] dark:text-lime-400" />
          </div>

          <h1 className="text-pretty text-[34px] leading-[1.1] text-moss-900 lg:max-w-[12ch] lg:text-[46px] lg:leading-[1.08] dark:text-moss-100">
            {COPY.login.tagline}
          </h1>
          <p className="mt-3 max-w-[42ch] text-[15px] leading-[1.55] text-moss-800 lg:mt-4 lg:text-[16px] lg:leading-[1.6] dark:text-moss-400">
            {COPY.login.lead}
            <span className="hidden lg:inline"> Bez kont, bez haseł, bez zapisów.</span>
          </p>

          {(rejected || failed) && (
            <div className="mt-5.5 flex max-w-[460px] items-start gap-3 rounded-card bg-clay-100 px-4.5 py-4 lg:mt-6 dark:bg-[#3a2018]">
              <CircleX />
              <p className="text-[13.5px] leading-relaxed text-clay-700 dark:text-[#f0a58a]">
                {rejected ? COPY.login.denied : COPY.login.failed}
              </p>
            </div>
          )}

          <div className="mt-7 flex flex-col items-stretch gap-3.5 lg:mt-8 lg:flex-row lg:items-center lg:gap-4">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isBusy}
              className="flex h-14 items-center justify-center gap-3 rounded-full bg-forest-600 px-7 text-[15px] font-medium text-moss-100 transition hover:bg-forest-700 disabled:opacity-60 dark:bg-[#3a5842]"
            >
              <GoogleMark />
              {isBusy ? COPY.login.redirecting : COPY.login.button}
            </button>
            <p className="text-center text-[12.5px] leading-relaxed text-moss-600 lg:max-w-[24ch] lg:text-left lg:text-[13px]">
              <span className="lg:hidden">{COPY.login.noSignup} </span>
              {COPY.login.invited}
            </p>
          </div>
        </div>

        <footer className="flex items-center justify-center gap-2 pb-6.5 text-[12px] text-moss-500 lg:hidden">
          <Logo size={16} className="text-moss-500" label="" />
          {COPY.appName}
        </footer>
      </main>

      {/* Desktop only: a preview of what's inside instead of empty space. */}
      <aside className="hidden w-[520px] shrink-0 flex-col justify-center gap-4 bg-forest-600 px-12 py-14 text-moss-100 lg:flex">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-[#a9c9a5]">Dziś w domu</p>

        <div className="rounded-card bg-white/[.07] px-5 py-4.5">
          <p className="mb-3.5 text-[22px] leading-[1.3]">Zostały dwie rzeczy i jedna zaległość.</p>
          <div className="flex h-[66px] items-end gap-[5px]">
            {TEASE_BARS.map((height, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 self-stretch justify-end">
                <span
                  className={[
                    'w-full rounded-[5px]',
                    i === 0 ? 'bg-[#e8875f]' : i === 1 ? 'bg-lime-400' : 'bg-[#456b50]',
                  ].join(' ')}
                  style={{ height: `${height}px` }}
                />
                <span className="text-[9.5px] text-[#7d9c79]">{TEASE_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <TeaseRow
          icon={Sprout}
          tile="bg-lime-400/15 text-lime-400"
          name="Podlać monsterę"
          meta="co 3 dni · tylko letnia woda"
        />
        <TeaseRow
          icon={Droplets}
          tile="bg-[#e8875f]/[.16] text-[#e8875f]"
          name="Wymienić filtr w kranie"
          meta="25 dni po terminie"
          metaClass="text-[#e8875f]"
        />
      </aside>
    </div>
  )
}

function TeaseRow({ icon: Icon, tile, name, meta, metaClass = 'text-[#a9c9a5]' }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-white/[.07] px-4 py-3.5">
      <span className={['grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[14px]', tile].join(' ')}>
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-medium">{name}</p>
        <p className={['text-[12px]', metaClass].join(' ')}>{meta}</p>
      </div>
    </div>
  )
}

function CircleX() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="mt-0.5 shrink-0 text-clay-500 dark:text-[#f0a58a]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#EA4335" d="M9 3.5c1.5 0 2.5.6 3.1 1.2l2.3-2.2C12.9 1.2 11.1.5 9 .5 5.6.5 2.7 2.4 1.3 5.2l2.7 2.1C4.6 5.1 6.6 3.5 9 3.5z" />
      <path fill="#4285F4" d="M17.3 9.2c0-.6-.1-1.1-.2-1.6H9v3.2h4.7c-.2 1-.8 1.9-1.7 2.5l2.6 2c1.5-1.4 2.7-3.5 2.7-6.1z" />
      <path fill="#FBBC05" d="M4 10.7a5.5 5.5 0 0 1 0-3.4L1.3 5.2a8.5 8.5 0 0 0 0 7.6L4 10.7z" />
      <path fill="#34A853" d="M9 17.5c2.3 0 4.2-.8 5.6-2.1l-2.6-2c-.7.5-1.7.9-3 .9-2.4 0-4.4-1.6-5.1-3.7l-2.7 2.1C2.7 15.6 5.6 17.5 9 17.5z" />
    </svg>
  )
}
