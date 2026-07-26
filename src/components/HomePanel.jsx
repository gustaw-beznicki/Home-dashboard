import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  Database,
  Home,
  Plus,
  Tag,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { AdminPortal } from './AdminPortal'
import { CategoryIcon } from './CategoryIcon'
import { Logo } from './Logo'
import { CATEGORY_TILE_CLASS, COPY, STORAGE_KEY } from '../lib/constants'
import { countWith, FORMS } from '../lib/plural'
import { invalidateCategories } from '../hooks/useCategories'
import { invalidateHomeSettings } from '../hooks/useHomeSettings'

const SECTIONS = [
  { key: 'home', icon: Home, ...COPY.panel.sections.home },
  { key: 'people', icon: Users, ...COPY.panel.sections.people },
  { key: 'cats', icon: Tag, ...COPY.panel.sections.cats },
  { key: 'data', icon: Database, ...COPY.panel.sections.data },
]

const LEGACY_DISMISSED_KEY = 'home-dashboard:legacy-import-dismissed:v1'

/**
 * Panel domu — household management: name and rhythm defaults, the people
 * (the same AdminPortal the /admin page uses, embedded), the category list
 * and the data drawer with its quiet danger zone.
 */
export function HomePanel() {
  const [section, setSection] = useState('home')

  // Settings are edited optimistically: local state changes immediately, the
  // PATCH follows, and a failure reloads the server truth.
  const [settings, setSettings] = useState(null)
  const [userCount, setUserCount] = useState(null)

  const loadSettings = useCallback(() => {
    fetch('/api/home')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load settings'))))
      .then(setSettings)
      .catch(() => setSettings(null))
  }, [])

  useEffect(() => {
    loadSettings()
    fetch('/api/admin/users')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((users) => setUserCount(users.length))
      .catch(() => setUserCount(null))
  }, [loadSettings])

  const patchSettings = (patch) => {
    setSettings((prev) => ({ ...prev, ...patch }))
    fetch('/api/home', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to save settings'))))
      .then((saved) => {
        setSettings(saved)
        invalidateHomeSettings()
      })
      .catch(loadSettings)
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {SECTIONS.map((s) => {
        const Icon = s.icon
        const active = section === s.key
        return (
          <button
            key={s.key}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => setSection(s.key)}
            className={[
              'flex items-start gap-3 rounded-2xl px-3 py-3 text-left transition',
              active
                ? 'bg-forest-600 text-moss-100 dark:bg-[#3a5842]'
                : 'text-moss-700 hover:bg-moss-200/60 dark:text-moss-400 dark:hover:bg-bark-700',
            ].join(' ')}
          >
            <Icon size={17} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium">{s.label}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug opacity-70">{s.hint}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )

  const activeSection = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0]

  return (
    <div className="min-h-screen bg-moss-100 font-sans text-moss-900 dark:bg-bark-900 dark:text-moss-100">
      <div className="mx-auto max-w-[1180px] px-4.5 py-5.5 sm:px-6 lg:px-8">
        <div className="mb-4.5 flex items-center justify-between gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[13.5px] text-moss-700 hover:text-moss-900 dark:text-moss-400 dark:hover:text-moss-200"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            {COPY.admin.back}
          </a>
          <span className="hidden items-center gap-2 text-[12.5px] text-moss-500 sm:flex">
            <Logo size={16} label="" className="text-moss-500" />
            {COPY.appName}
          </span>
        </div>

        <h1 className="text-[28px] leading-[1.15] lg:text-[30px]">{COPY.panel.title}</h1>
        <p className="mt-1.5 text-[13.5px] text-moss-600 dark:text-moss-500">
          {settings?.name ?? '…'}
          {userCount != null && ` · ${countWith(userCount, FORMS.domownik)}`}
        </p>

        <div className="mt-4.5 flex flex-col gap-4.5 lg:flex-row lg:gap-0">
          {/* Phone: the sections are a tappable list above the content.
              Desktop: a persistent second-column nav. */}
          <div className="rounded-hero bg-white px-4 py-1 lg:hidden dark:bg-bark-800">
            {SECTIONS.map((s, i) => {
              const Icon = s.icon
              const active = section === s.key
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={[
                    'flex w-full items-center gap-3 py-3.5 text-left',
                    i > 0 ? 'border-t border-moss-200 dark:border-bark-700' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'grid h-10 w-10 shrink-0 place-items-center rounded-[14px]',
                      active
                        ? 'bg-forest-600 text-moss-100 dark:bg-[#3a5842]'
                        : 'bg-moss-50 text-moss-800 dark:bg-bark-700 dark:text-moss-300',
                    ].join(' ')}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{s.label}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-moss-600 dark:text-moss-500">
                      {s.hint}
                    </span>
                  </span>
                  <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-moss-500" />
                </button>
              )
            })}
          </div>

          <div className="hidden w-[236px] shrink-0 border-r border-moss-300 pr-4 lg:block dark:border-bark-600">
            <p className="mb-2.5 px-1 text-[10px] uppercase tracking-[0.15em] text-moss-500">
              {COPY.panel.title}
            </p>
            {nav}
          </div>

          <main className="min-w-0 flex-1 lg:pl-8">
            {/* Domownicy brings its own heading (it's the /admin page embedded),
                so the mobile eyebrow would double it up. */}
            {section !== 'people' && (
              <p className="mb-2.5 text-[10.5px] uppercase tracking-[0.15em] text-moss-500 lg:hidden">
                {activeSection.label}
              </p>
            )}

            {section === 'home' && settings && (
              <HomeSection settings={settings} onPatch={patchSettings} />
            )}
            {section === 'people' && <AdminPortal embedded />}
            {section === 'cats' && <CategoriesSection />}
            {section === 'data' && <DataSection />}
          </main>
        </div>
      </div>
    </div>
  )
}

function HomeSection({ settings, onPatch }) {
  const [name, setName] = useState(settings.name)

  // A failed PATCH reloads server truth into `settings`; follow it here too.
  useEffect(() => {
    setName(settings.name)
  }, [settings.name])

  return (
    <section>
      <h2 className="hidden text-[28px] leading-[1.15] lg:block lg:text-[30px]">
        {COPY.panel.sections.home.label}
      </h2>
      <p className="mb-5 mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-moss-600 dark:text-moss-500">
        {COPY.panel.homeIntro}
      </p>

      <div className="mb-3.5 rounded-hero bg-white p-5 dark:bg-bark-800">
        <label className="mb-2 block text-[13px] font-medium text-moss-800 dark:text-moss-300" htmlFor="home-name">
          {COPY.panel.homeName}
        </label>
        <input
          id="home-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== settings.name && onPatch({ name: name.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="mb-4.5 w-full rounded-2xl border border-moss-300 bg-transparent px-4 py-3.5 text-[15px] outline-none focus:border-forest-500 dark:border-bark-600"
        />

        <p className="text-[13px] font-medium text-moss-800 dark:text-moss-300">{COPY.panel.weekStart}</p>
        <p className="mb-2.5 mt-1 text-[12.5px] text-moss-600 dark:text-moss-500">{COPY.panel.weekStartHint}</p>
        <div className="mb-4.5 flex max-w-[280px] gap-1.5">
          {[
            { v: 1, label: COPY.panel.weekMonday },
            { v: 7, label: COPY.panel.weekSunday },
          ].map((w) => (
            <button
              key={w.v}
              type="button"
              aria-pressed={settings.weekStart === w.v}
              onClick={() => onPatch({ weekStart: w.v })}
              className={[
                'flex-1 rounded-2xl py-3 text-[13.5px] transition',
                settings.weekStart === w.v
                  ? 'bg-forest-600 font-medium text-moss-100 dark:bg-[#3a5842]'
                  : 'bg-moss-100 text-moss-700 hover:bg-moss-200 dark:bg-bark-700 dark:text-moss-400',
              ].join(' ')}
            >
              {w.label}
            </button>
          ))}
        </div>

        <p className="text-[13px] font-medium text-moss-800 dark:text-moss-300">{COPY.panel.defaultRhythm}</p>
        <p className="mb-2.5 mt-1 text-[12.5px] text-moss-600 dark:text-moss-500">{COPY.panel.defaultRhythmHint}</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { v: 'manual', label: 'bez rytmu' },
            { v: 'weekly', label: 'co tydzień' },
            { v: 'monthly', label: 'co miesiąc' },
          ].map((r) => (
            <button
              key={r.v}
              type="button"
              aria-pressed={settings.defaultRhythm === r.v}
              onClick={() => onPatch({ defaultRhythm: r.v })}
              className={[
                'rounded-full px-3.5 py-2.5 text-[13.5px] transition',
                settings.defaultRhythm === r.v
                  ? 'bg-forest-600 font-medium text-moss-100 dark:bg-[#3a5842]'
                  : 'bg-moss-100 text-moss-700 hover:bg-moss-200 dark:bg-bark-700 dark:text-moss-400',
              ].join(' ')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-hero bg-white px-5 py-4 dark:bg-bark-800">
        <p className="mb-1 text-[13px] font-medium text-moss-800 dark:text-moss-300">{COPY.panel.reminders}</p>
        {[
          { key: 'remindMorning', label: COPY.panel.remindMorning, hint: COPY.panel.remindMorningHint },
          { key: 'remindOverdue', label: COPY.panel.remindOverdue, hint: COPY.panel.remindOverdueHint },
        ].map((t) => {
          const on = !!settings[t.key]
          return (
            <div key={t.key} className="flex items-center gap-3.5 border-t border-moss-200 py-3.5 first:border-t-0 dark:border-bark-700">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px]">{t.label}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-moss-600 dark:text-moss-500">{t.hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={t.label}
                onClick={() => onPatch({ [t.key]: !on })}
                className={[
                  'relative h-[27px] w-[46px] shrink-0 rounded-full transition',
                  on ? 'bg-forest-600 dark:bg-[#3a5842]' : 'bg-moss-300 dark:bg-bark-600',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-[3px] h-[21px] w-[21px] rounded-full transition-all',
                    on ? 'left-[22px] bg-lime-400' : 'left-[3px] bg-white dark:bg-moss-500',
                  ].join(' ')}
                />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CategoriesSection() {
  const [categories, setCategories] = useState([])
  const [counts, setCounts] = useState({})
  const [newLabel, setNewLabel] = useState('')
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    fetch('/api/categories')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setCategories)
      .catch(() => setError(COPY.admin.error))
    fetch('/api/tasks')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((tasks) => {
        const byCategory = {}
        for (const task of tasks) {
          if (task.archived) continue
          byCategory[task.category] = (byCategory[task.category] ?? 0) + 1
        }
        setCounts(byCategory)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = () => {
    const label = newLabel.trim()
    if (!label) return
    fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(() => {
        setNewLabel('')
        setError(null)
        invalidateCategories()
        load()
      })
      .catch(() => setError(COPY.admin.error))
  }

  const remove = (category) => {
    fetch(`/api/categories/${encodeURIComponent(category.key)}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) return Promise.reject(new Error())
        setError(null)
        invalidateCategories()
        load()
      })
      .catch(() => setError(COPY.admin.error))
  }

  return (
    <section>
      <h2 className="hidden text-[28px] leading-[1.15] lg:block lg:text-[30px]">
        {COPY.panel.sections.cats.label}
      </h2>
      <p className="mb-5 mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-moss-600 dark:text-moss-500">
        {COPY.panel.catsIntro}
      </p>

      {error && <p className="mb-3 text-[13px] text-clay-500 dark:text-[#f0a58a]">{error}</p>}

      <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
        {categories.map((c) => (
          <div key={c.key} className="flex items-center gap-3.5 rounded-card bg-white px-4 py-3.5 dark:bg-bark-800">
            <span
              className={[
                'grid h-11 w-11 shrink-0 place-items-center rounded-2xl',
                CATEGORY_TILE_CLASS[c.key] || CATEGORY_TILE_CLASS.home,
              ].join(' ')}
            >
              <CategoryIcon category={c.key} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{c.label}</p>
              <p className="text-[12.5px] text-moss-600 dark:text-moss-500">
                {countWith(counts[c.key] ?? 0, FORMS.rzecz)}
              </p>
            </div>
            {/* 'home' is the fallback bucket deleted categories empty into, so
                it has no remove action — the Worker refuses it anyway. */}
            {c.key !== 'home' && (
              <button
                type="button"
                aria-label={`Usuń kategorię ${c.label}`}
                onClick={() => remove(c)}
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-moss-50 text-moss-600 transition hover:bg-moss-200 dark:bg-bark-700 dark:text-moss-400 dark:hover:bg-bark-600"
              >
                <Trash2 size={16} strokeWidth={1.8} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex max-w-[520px] items-center gap-2.5 rounded-card bg-white px-4 py-3.5 dark:bg-bark-800">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={COPY.panel.catPlaceholder}
          aria-label={COPY.panel.catAdd}
          className="min-w-0 flex-1 rounded-2xl border border-moss-300 bg-transparent px-3.5 py-3 text-[14px] outline-none focus:border-forest-500 dark:border-bark-600"
        />
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-2 rounded-2xl bg-forest-600 px-5 py-3 text-[13.5px] font-medium text-moss-100 dark:bg-[#3a5842]"
        >
          <Plus size={15} strokeWidth={2.4} />
          {COPY.panel.catAdd}
        </button>
      </div>
      <p className="mt-2.5 text-[12px] text-moss-500">{COPY.panel.catRemoveNote}</p>
    </section>
  )
}

function DataSection() {
  const [legacyCount, setLegacyCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [busyAction, setBusyAction] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (window.localStorage.getItem(LEGACY_DISMISSED_KEY)) return
    try {
      const legacy = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
      if (Array.isArray(legacy) && legacy.length > 0) setLegacyCount(legacy.length)
    } catch {
      // Unreadable legacy data is the same as none.
    }
  }, [])

  const importLegacy = async () => {
    setImporting(true)
    try {
      const legacy = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
      for (const task of legacy) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        })
      }
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.setItem(LEGACY_DISMISSED_KEY, '1')
      setLegacyCount(0)
    } catch {
      setError(COPY.admin.error)
    } finally {
      setImporting(false)
    }
  }

  const dismissLegacy = () => {
    window.localStorage.setItem(LEGACY_DISMISSED_KEY, '1')
    setLegacyCount(0)
  }

  const runAction = (key, request) => {
    setBusyAction(key)
    setError(null)
    request()
      .catch(() => setError(COPY.admin.error))
      .finally(() => setBusyAction(null))
  }

  const exportData = () =>
    runAction('export', async () => {
      const res = await fetch('/api/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ogarniamy-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    })

  const emptyArchive = () =>
    runAction('empty', async () => {
      const res = await fetch('/api/archive/empty', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
    })

  const trimHistory = () =>
    runAction('trim', async () => {
      const res = await fetch('/api/history/trim', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
    })

  const deleteHome = () => {
    // Double gate: the admin confirms here and the Worker additionally requires
    // the explicit confirm flag in the body.
    if (!window.confirm(COPY.panel.dangerConfirm)) return
    runAction('delete', async () => {
      const res = await fetch('/api/home', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      if (!res.ok) throw new Error('Failed')
      // Every session and user row is gone; land on the login screen.
      window.location.href = '/'
    })
  }

  const rows = [
    { key: 'export', label: COPY.panel.exportLabel, hint: COPY.panel.exportHint, action: COPY.panel.exportAction, onClick: exportData },
    { key: 'empty', label: COPY.panel.emptyArchiveLabel, hint: COPY.panel.emptyArchiveHint, action: COPY.panel.emptyArchiveAction, onClick: emptyArchive },
    { key: 'trim', label: COPY.panel.trimLabel, hint: COPY.panel.trimHint, action: COPY.panel.trimAction, onClick: trimHistory },
  ]

  return (
    <section>
      <h2 className="hidden text-[28px] leading-[1.15] lg:block lg:text-[30px]">
        {COPY.panel.sections.data.label}
      </h2>
      <p className="mb-5 mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-moss-600 dark:text-moss-500">
        {COPY.panel.dataIntro}
      </p>

      {error && <p className="mb-3 text-[13px] text-clay-500 dark:text-[#f0a58a]">{error}</p>}

      {legacyCount > 0 && (
        <div className="mb-3.5 flex flex-wrap items-center gap-3.5 rounded-card bg-amber-100 px-4.5 py-4 dark:bg-[#332a19]">
          <TriangleAlert size={18} strokeWidth={1.8} className="shrink-0 text-amber-500 dark:text-[#e0b073]" />
          <p className="min-w-[200px] flex-1 text-[13.5px] leading-relaxed text-amber-500 dark:text-[#e0b073]">
            {COPY.importBanner.text(legacyCount)}
          </p>
          <button
            type="button"
            onClick={importLegacy}
            disabled={importing}
            className="rounded-full bg-forest-600 px-4.5 py-2.5 text-[13px] font-medium text-moss-100 disabled:opacity-60 dark:bg-[#3a5842]"
          >
            {importing ? COPY.importBanner.working : COPY.importBanner.confirm}
          </button>
          <button
            type="button"
            onClick={dismissLegacy}
            className="px-3 py-2.5 text-[13px] text-amber-500 dark:text-[#e0b073]"
          >
            {COPY.importBanner.dismiss}
          </button>
        </div>
      )}

      <div className="mb-3.5 rounded-hero bg-white px-5 py-1.5 dark:bg-bark-800">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-4 border-t border-moss-200 py-4 first:border-t-0 dark:border-bark-700">
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-medium">{row.label}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-moss-600 dark:text-moss-500">{row.hint}</p>
            </div>
            <button
              type="button"
              disabled={busyAction === row.key}
              onClick={row.onClick}
              className="shrink-0 rounded-full border border-moss-300 px-4 py-2.5 text-[13px] text-moss-700 transition hover:bg-moss-50 disabled:opacity-50 dark:border-bark-600 dark:text-moss-400 dark:hover:bg-bark-700"
            >
              {row.action}
            </button>
          </div>
        ))}
      </div>

      {/* The danger zone is quiet on purpose: an outline, not a red slab. */}
      <div className="rounded-hero border border-clay-300 p-5 dark:border-[#5a2f22]">
        <p className="mb-1.5 text-[14.5px] font-medium text-clay-700 dark:text-[#f0a58a]">
          {COPY.panel.dangerTitle}
        </p>
        <p className="mb-3.5 max-w-[56ch] text-[13px] leading-relaxed text-moss-600 dark:text-moss-500">
          {COPY.panel.dangerBody}
        </p>
        <button
          type="button"
          disabled={busyAction === 'delete'}
          onClick={deleteHome}
          className="rounded-full bg-clay-100 px-5 py-3 text-[13.5px] font-medium text-clay-700 transition hover:bg-clay-300/60 disabled:opacity-50 dark:bg-[#3a2018] dark:text-[#f0a58a]"
        >
          {COPY.panel.dangerAction}
        </button>
      </div>
    </section>
  )
}
