import { SignIn } from '@clerk/react'

export function LoginScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <SignIn />
    </div>
  )
}
