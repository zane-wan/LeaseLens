import { SignupForm } from "./signup-form"

export default function SignupPage() {
  return (
    <div className="grid flex-1 lg:grid-cols-2" style={{ minHeight: "calc(100vh - 5rem)" }}>
      {/* Left: Promotion / marketing */}
      <div className="flex flex-col justify-between bg-muted p-6 md:p-10 lg:p-12">
        <div className="space-y-6">
          <blockquote className="space-y-2 border-l-4 border-primary pl-6 text-lg italic text-muted-foreground md:text-xl">
            <p>
              &ldquo;As a landlord, LeaseLens gives me confidence that every
              clause in my lease is compliant with Ontario law. It&apos;s like
              having a lawyer review every agreement in seconds.&rdquo;
            </p>
            <footer className="text-sm font-medium not-italic text-foreground">
              — Landlord, Ottawa
            </footer>
          </blockquote>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-powered lease agreement analysis for Ontario residential tenancy law.
        </p>
      </div>

      {/* Right: Signup form */}
      <div className="flex flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
            <p className="text-sm text-muted-foreground">
              Start analysing your lease agreements today
            </p>
          </div>
          <SignupForm />
        </div>
      </div>
    </div>
  )
}
