import { redirect } from "next/navigation"
import { SignupForm } from "@/features/auth/components/AuthForms"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function SignupPage() {
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
              Grounded analysis
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Upload once and review the risky language that matters
            </h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Create an account to analyze additional terms across many files,
              keep your results in one place, and use a flow designed around
              grounded legal context instead of open ended chat alone.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-sm font-medium">Additional terms</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Target schedules and custom clauses that often hide the real surprises.
              </p>
            </div>
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-sm font-medium">Grounded results</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Combine retrieval and model analysis to keep outputs tied to Ontario sources.
              </p>
            </div>
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-sm font-medium">One click review</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Run analysis across many lease documents without repeating the same flow.
              </p>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Terms, privacy, contact details, and account access are all available before signup.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
            <p className="text-sm text-muted-foreground">
              Start reviewing lease files with grounded Ontario context
            </p>
          </div>
          <SignupForm />
        </div>
      </div>
    </div>
  )
}
