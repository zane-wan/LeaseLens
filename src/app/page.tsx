import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function Home() {
  const user = await getAuthUserFromServer()

  return (
    <main className="flex min-h-[calc(100vh-4.5rem)] items-center px-6 py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Ontario residential tenancy
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
              AI-powered lease review that stays scoped to each user's workspace.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Upload agreements, trigger clause analysis, and manage results through
              an email-based multi-user system with Google sign-in support and
              per-user data isolation.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button size="lg">Go to dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="lg">Sign in</Button>
                </Link>
                <Link href="/signup">
                  <Button size="lg" variant="outline">Create account</Button>
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border bg-card/60 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border bg-background/80 p-4">
                <p className="text-sm text-muted-foreground">Login options</p>
                <p className="mt-2 text-xl font-semibold">Email or Google</p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-4">
                <p className="text-sm text-muted-foreground">Isolation</p>
                <p className="mt-2 text-xl font-semibold">Per-user files and chats</p>
              </div>
            </div>
            <blockquote className="space-y-3 border-l-4 border-primary/60 pl-5 text-base italic leading-7 text-muted-foreground">
              <p>
                &ldquo;LeaseLens transformed how I review rental agreements. The
                Ontario-specific clause checks surface issues fast without mixing my
                workspace with anyone else's.&rdquo;
              </p>
              <footer className="text-sm font-medium not-italic text-foreground">
                Tenant, Toronto
              </footer>
            </blockquote>
          </div>
        </section>
      </div>
    </main>
  )
}
