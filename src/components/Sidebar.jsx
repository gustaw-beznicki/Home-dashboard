import { LogOut, Settings2, Shield } from 'lucide-react'
import { CategoryFilter } from './CategoryFilter'
import { LogoBadge } from './Logo'
import { COPY, VIEWS } from '../lib/constants'

function initialOf(user) {
  return (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()
}

/**
 * Desktop-only left rail. The four old tabs live on here as list filters —
 * same rules as before, just no longer competing with the urgency grouping
 * that structures the page on a phone.
 */
export function Sidebar({ activeView, onViewChange, activeCategory, onCategoryChange, counts, user, onSignOut }) {
  return (
    <aside className="hidden w-[210px] flex-none flex-col gap-5 border-r border-moss-300 bg-moss-200 px-4 py-5.5 lg:flex dark:border-bark-600 dark:bg-bark-800">
      <div className="flex items-center gap-2.5">
        <LogoBadge size={30} />
        <span className="text-[15px] font-medium text-moss-900 dark:text-moss-100">
          {COPY.appName}
        </span>
      </div>

      <nav className="flex flex-col gap-[3px]">
        {VIEWS.map((view) => {
          const active = activeView === view.key
          return (
            <button
              key={view.key}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onViewChange(view.key)}
              className={[
                'flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[13.5px] transition',
                active
                  ? 'bg-forest-600 font-medium text-onaccent'
                  : 'text-moss-700 hover:bg-moss-300 dark:text-moss-400 dark:hover:bg-bark-700',
              ].join(' ')}
            >
              {view.label}
              <span className={['ml-auto', active ? 'text-onaccent/70' : 'text-moss-500'].join(' ')}>
                {counts[view.key]}
              </span>
            </button>
          )
        })}
      </nav>

      <div>
        <p className="mb-2.5 text-[10px] uppercase tracking-[0.15em] text-moss-500">
          {COPY.categoriesLabel}
        </p>
        <CategoryFilter activeCategory={activeCategory} onChange={onCategoryChange} />
      </div>

      <div className="mt-auto flex flex-col gap-2.5 text-[12.5px] text-moss-700 dark:text-moss-400">
        {user?.role === 'admin' && (
          <>
            <a href="/admin" className="flex items-center gap-2 hover:underline">
              <Shield size={14} strokeWidth={1.8} />
              {COPY.admin.title}
            </a>
            <a href="/panel" className="flex items-center gap-2 hover:underline">
              <Settings2 size={14} strokeWidth={1.8} />
              {COPY.panel.title}
            </a>
          </>
        )}
        <div className="flex items-center gap-2.5">
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-cta text-[11px] text-onaccent">
            {initialOf(user)}
          </span>
          <span className="truncate">{user?.name || user?.email}</span>
          <button
            type="button"
            onClick={onSignOut}
            aria-label={COPY.signOut}
            className="ml-auto shrink-0 text-moss-600 hover:text-moss-800 dark:hover:text-moss-200"
          >
            <LogOut size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </aside>
  )
}
