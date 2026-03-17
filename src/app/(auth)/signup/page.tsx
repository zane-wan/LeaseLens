import { redirect } from "next/navigation"
import { AuthPageShell, SignupForm } from "@/features/auth/components/AuthForms"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function SignupPage() {
  const user = await getAuthUserFromServer()
  if (user) {
    redirect("/dashboard")
  }

  return (
    <AuthPageShell
      title="Create your workspace"
      description="Register with email or continue with Google, then start analyzing agreements in a user-isolated workspace."
      quote="LeaseLens gives me confidence that every clause in my lease is compliant with Ontario law. It's like having a lawyer review every agreement in seconds."
      attribution="Landlord, Ottawa"
    >
      <SignupForm />
    </AuthPageShell>
  )
}
