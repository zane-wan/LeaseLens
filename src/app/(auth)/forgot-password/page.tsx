import { redirect } from "next/navigation"
import { AuthPageShell, ForgotPasswordForm } from "@/features/auth/components/AuthForms"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function ForgotPasswordPage() {
  const user = await getAuthUserFromServer()
  if (user) {
    redirect("/dashboard")
  }

  return (
    <AuthPageShell
      title="Recover account access"
      description="Confirm your email address, receive a verification code, and reset your password without exposing other users' data."
      quote="The reset flow was straightforward and secure, and I was back in my account without having to contact support."
      attribution="Tenant, Mississauga"
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  )
}
