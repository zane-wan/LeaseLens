import { redirect } from "next/navigation"
import { LoginForm } from "@/features/auth/components/AuthForms"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function LoginPage() {
  const user = await getAuthUserFromServer()
  if (user) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <LoginForm />
    </main>
  )
}
