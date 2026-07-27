import { useEffect, useState } from 'react'
import { Check, ChevronLeft, Sprout } from 'lucide-react'
import { AVATAR_COLORS, COPY } from '../lib/constants'
import { useHomeSettings } from '../hooks/useHomeSettings'
import { LogoBadge } from './Logo'

const O = COPY.onboarding
const LAST = O.steps.length - 1

/**
 * Six steps for a new domownik, between their first Google sign-in and the
 * list. Runs once — App gates on `onboardedAt`, and finishing PATCHes
 * /api/me with the name, colour and the one-way onboarded flag.
 *
 * The check-off in step four is a local demo on purpose: marking a *real*
 * task done during a tutorial would tell the household something happened
 * that didn't. The draft from step five, though, becomes a real task
 * (rhythm-less — the sheet is where rhythms are learned).
 */
export function Onboarding({ user, onFinish }) {
  const settings = useHomeSettings()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(user?.name ?? '')
  const [color, setColor] = useState(user?.color ?? 'leaf')
  const [tryDone, setTryDone] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [taskCount, setTaskCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/tasks')
      .then((res) => (res.ok ? res.json() : []))
      .then((tasks) => {
        if (!cancelled && Array.isArray(tasks)) {
          setTaskCount(tasks.filter((t) => !t.archived).length)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const inviter = user?.invitedBy ?? null
  const displayName = name.trim() || user?.name || user?.email?.split('@')[0] || ''
  const initial = (displayName || '?')[0].toUpperCase()
  const swatch = AVATAR_COLORS.find((c) => c.key === color) ?? AVATAR_COLORS[1]
  const hero = step === 0 || step === LAST
  const go = (n) => setStep(Math.max(0, Math.min(LAST, n)))

  async function finish() {
    if (saving) return
    setSaving(true)
    try {
      // The draft is a courtesy — a failed save must not trap someone in the
      // wizard, so it is fired and forgotten. The profile PATCH is what ends
      // onboarding; on failure we stay here so the flag can't be lost.
      if (draft.trim()) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: draft.trim(),
            category: 'home',
            interval: { type: 'manual' },
          }),
        }).catch(() => {})
      }

      const body = { color, onboarded: true }
      if (name.trim()) body.name = name.trim()
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) onFinish(await res.json())
    } finally {
      setSaving(false)
    }
  }

  const primaryLabel =
    step === 0 ? O.welcomeCta
    : step === LAST ? O.doneCta
    : step === 3 && !tryDone ? O.tryCta
    : O.next

  return (
    <div
      className={`flex min-h-screen flex-col lg:flex-row ${
        hero ? 'bg-hero' : 'bg-moss-100 dark:bg-bark-900'
      }`}
    >
      {/* Desktop rail: where you are and how much is left. */}
      <aside className="hidden w-[340px] flex-none flex-col bg-hero px-8 py-10 text-moss-200 lg:flex">
        <div className="mb-7 flex items-center gap-2.5">
          <LogoBadge size={30} className="text-moss-200" />
          <span className="text-[15px] font-medium">{settings.name}</span>
        </div>
        <p className="text-[28px] leading-tight text-pretty">{O.railTitle(inviter)}</p>
        <p className="mt-2.5 text-[14px] leading-relaxed text-lime-400">{O.railLead}</p>
        <nav className="mt-6.5 flex flex-col gap-0.5">
          {O.steps.map((label, k) => (
            <button
              key={label}
              type="button"
              onClick={() => go(k)}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                k === step ? 'bg-white/10' : ''
              }`}
            >
              <span
                className={`grid h-6.5 w-6.5 flex-none place-items-center rounded-full text-[12px] font-medium ${
                  k === step
                    ? 'bg-lime-400 text-hero'
                    : k < step
                      ? 'bg-lime-400/20 text-lime-400'
                      : 'bg-white/10 text-lime-400'
                }`}
              >
                {k < step ? <Check size={13} strokeWidth={3} /> : k + 1}
              </span>
              <span
                className={`flex-1 text-[14px] ${
                  k === step ? 'font-medium text-moss-100' : 'text-lime-400'
                }`}
              >
                {label}
              </span>
            </button>
          ))}
        </nav>
        <p className="mt-auto text-[12.5px] leading-relaxed text-[#99ad7a]">{O.railFootnote}</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone: back, segmented progress, skip. */}
        <div className="flex items-center gap-2.5 px-5.5 pt-5 lg:hidden">
          <button
            type="button"
            aria-label={O.back}
            onClick={() => go(step - 1)}
            className={`grid h-9 w-9 flex-none place-items-center rounded-full ${
              step === 0 ? 'opacity-35' : ''
            } ${
              hero
                ? 'bg-white/10 text-lime-400'
                : 'bg-moss-200 text-moss-700 dark:bg-bark-700 dark:text-moss-400'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex flex-1 gap-1.5">
            {O.steps.map((label, k) => (
              <span
                key={label}
                className={`h-1 flex-1 rounded-full ${
                  k === step
                    ? 'bg-lime-400'
                    : k < step
                      ? hero
                        ? 'bg-lime-400/45'
                        : 'bg-brand-leaf'
                      : hero
                        ? 'bg-white/15'
                        : 'bg-moss-300 dark:bg-bark-600'
                }`}
              />
            ))}
          </div>
          {step !== LAST && (
            <button
              type="button"
              onClick={() => go(LAST)}
              className={`text-[12.5px] ${hero ? 'text-lime-400' : 'text-moss-500'}`}
            >
              {O.skip}
            </button>
          )}
        </div>

        <main className="flex-1 px-5.5 py-7 lg:px-11 lg:py-12">
          <div className="mx-auto max-w-[560px] lg:mx-0">
            {step === 0 && (
              <div className="text-center lg:text-left">
                <div className="mb-6 flex justify-center lg:justify-start">
                  <span className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-hero bg-lime-400 text-[24px] font-medium text-hero">
                    {(inviter ?? settings.name)[0].toUpperCase()}
                  </span>
                  <span
                    className={`-ml-4 grid h-16 w-16 place-items-center rounded-full border-[3px] border-hero text-[24px] font-medium ${swatch.className}`}
                  >
                    {initial}
                  </span>
                </div>
                <p className="text-[11px] uppercase tracking-[0.15em] text-lime-400">
                  {O.welcomeEyebrow(inviter, settings.name)}
                </p>
                <h1 className="mt-2.5 text-[32px] leading-tight text-moss-100 text-pretty">
                  {O.welcomeTitle}
                </h1>
                <p className="mt-3.5 text-[15px] leading-relaxed text-lime-400">{O.welcomeLead}</p>
                {taskCount > 0 && (
                  <p className="mt-6 rounded-card bg-white/8 px-4 py-3.5 text-[13px] leading-relaxed text-lime-400">
                    {O.welcomeCount(taskCount)}
                  </p>
                )}
              </div>
            )}

            {step === 1 && (
              <div>
                <h1 className="text-[28px] leading-tight text-moss-900 dark:text-moss-100 lg:text-[34px]">
                  {O.nameTitle}
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-moss-500 lg:text-[15px]">
                  {O.nameLead}
                </p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={O.namePlaceholder}
                  className="mt-6 w-full border-b-[1.5px] border-moss-300 bg-transparent pb-3 text-[26px] text-moss-900 outline-hidden placeholder:text-moss-400 focus:border-brand-forest dark:border-bark-600 dark:text-moss-100 lg:text-[30px]"
                />
                <p className="mb-2.5 mt-7 text-[13px] font-medium text-moss-700 dark:text-moss-300">
                  {O.colorLabel}
                </p>
                <div className="flex gap-2.5">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-label={c.aria}
                      aria-pressed={color === c.key}
                      onClick={() => setColor(c.key)}
                      className={`grid h-[52px] w-[52px] place-items-center rounded-full ${c.className} ${
                        color === c.key
                          ? 'outline-solid outline-2 outline-offset-2 outline-forest-600'
                          : ''
                      }`}
                    >
                      {color === c.key && <Check size={18} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
                <div className="mt-7 flex max-w-[400px] items-center gap-3.5 rounded-card bg-white px-4 py-3.5 shadow-card dark:bg-bark-700">
                  <span
                    className={`grid h-10 w-10 flex-none place-items-center rounded-full text-[15px] font-medium ${swatch.className}`}
                  >
                    {initial}
                  </span>
                  <p className="text-[13.5px] leading-relaxed text-moss-500 dark:text-moss-400">
                    {O.colorPreview(displayName || O.namePlaceholder)}
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 className="text-[28px] leading-tight text-moss-900 dark:text-moss-100 lg:text-[34px]">
                  {O.stopsTitle}
                </h1>
                <p className="mb-5 mt-2 text-[14px] leading-relaxed text-moss-500 lg:text-[15px]">
                  {O.stopsLead}
                </p>
                <div className="flex flex-col gap-2.5">
                  {O.stops.map((s) => (
                    <div
                      key={s.status}
                      className="flex items-start gap-3.5 rounded-card bg-white p-4 shadow-card dark:bg-bark-700"
                    >
                      <span
                        className={`mt-1.5 inline-block h-2.5 w-2.5 flex-none ${
                          s.status === 'overdue'
                            ? 'rounded-[3px] bg-clay-500'
                            : s.status === 'due'
                              ? 'rounded-full bg-brand-forest dark:bg-lime-400'
                              : 'rounded-full bg-moss-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15.5px] font-medium text-moss-900 dark:text-moss-100">
                          {s.title}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-moss-500 dark:text-moss-400">
                          {s.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 rounded-card bg-moss-200 p-4 text-[13px] leading-relaxed text-moss-700 dark:bg-bark-700 dark:text-moss-300">
                  {O.stopsNote}
                </p>
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 className="text-[28px] leading-tight text-moss-900 dark:text-moss-100 lg:text-[34px]">
                  {tryDone ? O.tryTitleDone : O.tryTitle}
                </h1>
                <p className="mb-5 mt-2 max-w-[46ch] text-[14px] leading-relaxed text-moss-500 lg:text-[15px]">
                  {tryDone ? O.tryLeadDone : O.tryLead}
                </p>
                <div
                  className={`flex max-w-[480px] items-center gap-3.5 rounded-card bg-white px-4 py-3.5 shadow-card dark:bg-bark-700 ${
                    tryDone ? 'opacity-65' : ''
                  }`}
                >
                  <span className="grid h-[46px] w-[46px] flex-none place-items-center rounded-2xl bg-plant-100 text-plant-500">
                    <Sprout size={21} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[16px] font-medium text-moss-900 dark:text-moss-100 ${
                        tryDone ? 'line-through' : ''
                      }`}
                    >
                      {O.tryTaskName}
                    </p>
                    <p className="text-[12.5px] text-moss-500 dark:text-moss-400">
                      {tryDone ? O.tryTaskMetaDone(displayName || O.namePlaceholder) : O.tryTaskMeta}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={COPY.done}
                    onClick={() => setTryDone(true)}
                    className={`grid h-[46px] w-[46px] flex-none place-items-center rounded-full ${
                      tryDone
                        ? 'bg-cta text-onaccent'
                        : 'border-2 border-moss-300 text-moss-400 dark:border-bark-600'
                    }`}
                  >
                    <Check size={21} strokeWidth={2.6} />
                  </button>
                </div>
                {tryDone && (
                  <div className="mt-3 flex max-w-[480px] items-center gap-3 rounded-card bg-hero px-4 py-3.5 animate-riseIn">
                    <p className="flex-1 text-[13px] leading-relaxed text-moss-200">{O.tryToast}</p>
                    <button
                      type="button"
                      onClick={() => setTryDone(false)}
                      className="flex-none rounded-full bg-lime-400 px-3.5 py-2 text-[12.5px] font-medium text-hero"
                    >
                      {COPY.undo}
                    </button>
                  </div>
                )}
                <p className="mt-5 max-w-[46ch] text-[12.5px] leading-relaxed text-moss-400 dark:text-moss-500">
                  {O.tryHint}
                </p>
              </div>
            )}

            {step === 4 && (
              <div>
                <h1 className="text-[28px] leading-tight text-moss-900 dark:text-moss-100 lg:text-[34px]">
                  {O.draftTitle}
                </h1>
                <p className="mb-5 mt-2 max-w-[46ch] text-[14px] leading-relaxed text-moss-500 lg:text-[15px]">
                  {O.draftLead}
                </p>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={O.draftPlaceholder}
                  className="h-[54px] w-full max-w-[520px] rounded-full bg-white px-5 text-[14.5px] text-moss-900 shadow-card outline-hidden placeholder:text-moss-400 dark:bg-bark-700 dark:text-moss-100"
                />
                {!draft.trim() && (
                  <div className="mt-3 flex max-w-[520px] flex-wrap gap-1.5">
                    {O.draftExamples.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setDraft(ex)}
                        className="rounded-full bg-moss-200 px-3.5 py-2 text-[12.5px] text-moss-700 dark:bg-bark-700 dark:text-moss-300"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === LAST && (
              <div className="text-center lg:text-left">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-lime-400/15 text-lime-400 lg:mx-0">
                  <Check size={30} strokeWidth={2.4} />
                </div>
                <h1 className="text-[32px] leading-tight text-moss-100 text-pretty">
                  {O.doneTitle}
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-lime-400">
                  {O.doneLead(Boolean(draft.trim()))}
                </p>
              </div>
            )}
          </div>
        </main>

        <div
          className={`px-5.5 pb-7 lg:border-t lg:px-11 lg:py-4.5 ${
            hero ? 'lg:border-white/10' : 'lg:border-moss-300 lg:dark:border-bark-600'
          }`}
        >
          <div className="mx-auto flex max-w-[560px] flex-col items-stretch gap-2 lg:mx-0 lg:max-w-none lg:flex-row lg:items-center lg:gap-3.5">
            <button
              type="button"
              onClick={() => go(step - 1)}
              className={`hidden h-12 rounded-full border px-5 text-[13.5px] lg:block ${
                step === 0 ? 'opacity-35' : ''
              } ${
                hero
                  ? 'border-white/20 text-lime-400'
                  : 'border-moss-300 text-moss-700 dark:border-bark-600 dark:text-moss-300'
              }`}
            >
              {O.back}
            </button>
            <span
              className={`hidden text-[12.5px] lg:block ${
                hero ? 'text-lime-400' : 'text-moss-500'
              }`}
            >
              {O.stepOf(step + 1, O.steps.length)}
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => (step === LAST ? finish() : go(step + 1))}
              className={`h-[54px] rounded-full text-[15px] font-medium transition-colors lg:ml-auto lg:h-12 lg:px-7 ${
                hero
                  ? 'bg-cta text-onaccent hover:bg-cta-hover'
                  : 'bg-hero text-moss-100'
              } ${saving ? 'opacity-60' : ''}`}
            >
              {primaryLabel}
            </button>
            {step === 4 && (
              <button
                type="button"
                onClick={() => go(LAST)}
                className="h-11 text-[13.5px] text-moss-500 lg:order-first lg:ml-4"
              >
                {O.draftSkip}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
