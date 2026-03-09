import Link from "next/link"
import { FileText, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 flex h-20 w-full shrink-0 items-center border-b bg-background/80 px-6 backdrop-blur-sm md:px-10 lg:px-16">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileText className="size-4" />
        </div>
        LeaseLens
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {/* TODO: replace with real auth state */}
        <Link href="/login">
          <Button variant="outline" className="gap-2 px-6 h-11">
            <LogIn className="size-4" />
            Sign in
          </Button>
        </Link>
      </div>
    </header>
  )
}
