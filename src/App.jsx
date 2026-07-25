import { Dashboard } from './components/Dashboard'
import { AdminPortal } from './components/AdminPortal'
import { LoginScreen } from './components/LoginScreen'
import { useSession } from './lib/authClient'

export default function App() {
  const isAdminPath = window.location.pathname === '/admin'
  const { data: session, isPending } = useSession()

  // Without this the login screen flashes on every load while the session
  // request is in flight.
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        Ładowanie…
      </div>
    )
  }

  if (!session) return <LoginScreen />

  return isAdminPath ? <AdminPortal /> : <Dashboard />
}
