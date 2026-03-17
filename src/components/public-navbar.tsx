"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, LayoutDashboard, LogIn, UserPlus } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

const protectedPrefixes = [
  "/dashboard",
  "/account",
  "/admin",
  "/support",
  "/agreements",
]

function shouldHideOnPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix))
}

export function PublicNavbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname()

  if (shouldHideOnPath(pathname)) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <FileText className="size-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span>LeaseLens</span>
            <span className="text-[0.7rem] font-normal text-muted-foreground">
              Ontario lease analysis
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="outline" className="gap-2">
                <LayoutDashboard className="size-4" />
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="gap-2">
                  <LogIn className="size-4" />
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="gap-2">
                  <UserPlus className="size-4" />
                  Create account
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
