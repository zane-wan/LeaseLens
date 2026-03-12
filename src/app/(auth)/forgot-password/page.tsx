import { redirect } from "next/navigation"
import { ForgotPasswordForm } from "@/features/auth/components/AuthForms"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function ForgotPasswordPage() {
  const user = await getAuthUserFromServer()
  if (user) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <ForgotPasswordForm />
    </main>
  )
}
