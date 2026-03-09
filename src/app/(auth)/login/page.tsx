import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <div className="grid flex-1 lg:grid-cols-2" style={{ minHeight: "calc(100vh - 5rem)" }}>
      {/* Left: Promotion / marketing */}
      <div className="flex flex-col justify-between bg-muted p-6 md:p-10 lg:p-12">
        <div className="space-y-6">
          <blockquote className="space-y-2 border-l-4 border-primary pl-6 text-lg italic text-muted-foreground md:text-xl">
            <p>
              &ldquo;LeaseLens transformed how I review rental agreements. What
              used to take hours of legal research now takes minutes. The
              Ontario-specific clauses and red flags are incredibly accurate.&rdquo;
            </p>
            <footer className="text-sm font-medium not-italic text-foreground">
              — Tenant, Toronto
            </footer>
          </blockquote>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-powered lease agreement analysis for Ontario residential tenancy law.
        </p>
      </div>

      {/* Right: Login form */}
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
