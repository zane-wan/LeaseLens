import { redirect } from "next/navigation"
import { AuthPageShell, LoginForm } from "@/features/auth/components/AuthForms"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function LoginPage() {
  const user = await getAuthUserFromServer()
  if (user) {
    redirect("/dashboard")
  }

  return (
    <AuthPageShell
      title="Welcome back"
      description="Sign in to review leases, track analyses, and continue your Ontario compliance workflow."
      quote="LeaseLens transformed how I review rental agreements. What used to take hours of legal research now takes minutes."
      attribution="Tenant, Toronto"
    >
      <LoginForm />
    </AuthPageShell>
  )
}
