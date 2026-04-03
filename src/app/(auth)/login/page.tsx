import { redirect } from "next/navigation"
import { LoginForm } from "@/features/auth/components/AuthForms"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function LoginPage() {
  const user = await getAuthUserFromServer()
  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="grid flex-1 lg:grid-cols-2" style={{ minHeight: "calc(100vh - 5rem)" }}>
      <div className="flex flex-col justify-between bg-muted p-6 md:p-10 lg:p-12">
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Additional terms
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Grounded review for the clauses that create real risk
            </h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              LeaseLens focuses on additional terms, schedules, and custom
              clauses. The analysis is grounded with retrieval from Ontario
              tenancy sources so results do more than act like a generic chat.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-sm font-medium">Custom clauses</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pull out additional terms that deserve a closer legal read.
              </p>
            </div>
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-sm font-medium">RAG grounding</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use Ontario source retrieval to reduce hallucination in the
                final explanation.
              </p>
            </div>
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-sm font-medium">Many files</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Review many lease files in one workspace and compare outcomes.
              </p>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Built for Ontario lease review with secure sign in and direct support replies.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access LeaseLens
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
