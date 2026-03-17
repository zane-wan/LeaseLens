import Link from "next/link"
import { FileText, LogIn, UserCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { getAuthUserFromServer } from "@/lib/auth"
import { LogoutButton } from "@/components/auth/LogoutButton"

export async function Navbar() {
  const user = await getAuthUserFromServer()

  return (
    <header className="sticky top-0 z-50 flex h-20 w-full shrink-0 items-center border-b bg-background/80 px-6 backdrop-blur-sm md:px-10 lg:px-16">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="size-4" />
          </div>
          LeaseLens
        </Link>
        {user && (
          <span className="text-xs text-muted-foreground">{user.role}</span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user ? (
          <>
            <Link href="/account">
              <Button variant="outline" size="sm" className="gap-2">
                <UserCircle2 className="size-4" />
                Account
              </Button>
            </Link>
            <Link href="/support">
              <Button variant="outline" size="sm">Support</Button>
            </Link>
            {user.role === "ADMIN" || user.role === "OWNER" ? (
              <Link href="/admin/users">
                <Button variant="outline" size="sm">Admin</Button>
              </Link>
            ) : null}
            <LogoutButton identifier={user.email} />
          </>
        ) : (
          <Link href="/login">
            <Button variant="outline" className="gap-2 px-6 h-11">
              <LogIn className="size-4" />
              Sign in
            </Button>
          </Link>
        )}
      </div>
    </header>
  )
}