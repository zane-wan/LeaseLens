import Link from "next/link"

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-3">
            <p className="text-lg font-semibold tracking-tight">LeaseLens</p>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Clear lease review for Ontario renters with secure accounts,
              support replies, and direct access to the policies that explain
              how the service works.
            </p>
          </div>

          <nav className="grid gap-3 text-sm sm:grid-cols-3 md:grid-cols-1">
            <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-muted-foreground transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/contact" className="text-muted-foreground transition-colors hover:text-foreground">
              Contact
            </Link>
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Questions and account help: devtest.io@yahoo.com</p>
          <p>LeaseLens</p>
        </div>
      </div>
    </footer>
  )
}
