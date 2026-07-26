import { Dashboard } from './components/Dashboard'
import { AdminPortal } from './components/AdminPortal'
import { LoginScreen } from './components/LoginScreen'
import { useSession } from './lib/authClient'
import { COPY } from './lib/constants'

export default function App() {
  const isAdminPath = window.location.pathname === '/admin'
  const { data: session, isPending } = useSession()

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

  return isAdminPath ? <AdminPortal /> : <Dashboard />
}
