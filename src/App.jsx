import { Dashboard } from './components/Dashboard'
import { AdminPortal } from './components/AdminPortal'
import { HomePanel } from './components/HomePanel'
import { LoginScreen } from './components/LoginScreen'
import { Onboarding } from './components/Onboarding'
import { useSession } from './lib/authClient'
import { updateCachedUser, useCurrentUser } from './hooks/useCurrentUser'
import { useDarkMode } from './hooks/useDarkMode'
import { COPY } from './lib/constants'

export default function App() {
  const isAdminPath = window.location.pathname === '/admin'
  const isPanelPath = window.location.pathname === '/panel'
  const { data: session, isPending } = useSession()
  // Applies the saved/system theme on every screen, not just the dashboard —
  // without this, onboarding, /panel and /admin loaded direct never get the
  // `dark` class. Dashboard's own instance keeps owning the toggle.
  useDarkMode()
  // Fires alongside the session check (a 401 while logged out is harmless) and
  // is a shared cache, so the sidebar's own useCurrentUser costs nothing extra.
  const { user, isLoading: userLoading } = useCurrentUser()

  // Without this the login screen flashes on every load while the session
  // request is in flight.
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-moss-100 text-[15px] text-moss-600 dark:bg-bark-900 dark:text-moss-500">
        {COPY.loading}
      </div>
    )
  }

  if (!session) return <LoginScreen />

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-moss-100 text-[15px] text-moss-600 dark:bg-bark-900 dark:text-moss-500">
        {COPY.loading}
      </div>
    )
  }

  // First visit after accepting an invite: the wizard runs once, then PATCH
  // /api/me stamps onboarded_at and the fresh row lands back in the cache.
  if (user && !user.onboardedAt) {
    return <Onboarding user={user} onFinish={updateCachedUser} />
  }

  // Same client-side gating as /admin: non-admins simply get the dashboard,
  // and every panel API call is enforced server-side by requireAdmin anyway.
  if (isPanelPath) return <HomePanel />
  return isAdminPath ? <AdminPortal /> : <Dashboard />
}
