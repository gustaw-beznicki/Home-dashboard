import { Show } from '@clerk/react'
import { Dashboard } from './components/Dashboard'
import { AdminPortal } from './components/AdminPortal'
import { LoginScreen } from './components/LoginScreen'

export default function App() {
  const isAdminPath = window.location.pathname === '/admin'

  return (
    <>
      <Show when="signed-out">
        <LoginScreen />
      </Show>
      <Show when="signed-in">{isAdminPath ? <AdminPortal /> : <Dashboard />}</Show>
    </>
  )
}
