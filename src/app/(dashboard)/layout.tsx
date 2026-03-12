import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/auth/LogoutButton"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUserFromServer()
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-semibold">
              LeaseLens
            </Link>
            <span className="text-xs text-muted-foreground">{user.role}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/account">
              <Button variant="outline" size="sm">Account</Button>
            </Link>
            <Link href="/support">
              <Button variant="outline" size="sm">Support</Button>
            </Link>
            {user.role === "ADMIN" || user.role === "OWNER" ? (
              <Link href="/admin/users">
                <Button variant="outline" size="sm">Admin</Button>
              </Link>
            ) : null}
            <LogoutButton identifier={user.username} />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
