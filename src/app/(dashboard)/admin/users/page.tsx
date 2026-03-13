import { redirect } from "next/navigation"
import { AdminUsersPanel } from "@/features/auth/components/AccountAdminPanels"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function AdminUsersPage() {
  const user = await getAuthUserFromServer()
  if (!user) {
    redirect("/login")
  }
  if (user.role !== "ADMIN" && user.role !== "OWNER") {
    redirect("/dashboard")
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <AdminUsersPanel />
    </main>
  )
}
