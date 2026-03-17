"use client"

import Link from "next/link"
import { FormEvent, type ReactNode, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

async function postJson(url: string, payload: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => null)
  return { res, json }
}

function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <Card className="mx-auto w-full max-w-md shadow-sm">
      <CardContent className="space-y-6 pt-6">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export function AuthPageShell({
  title,
  description,
  quote,
  attribution,
  children,
}: {
  title: string
  description: string
  quote: string
  attribution: string
  children: ReactNode
}) {
  return (
    <main className="min-h-[calc(100vh-4.5rem)]">
      <div className="grid min-h-[calc(100vh-4.5rem)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden border-r bg-muted/60 lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_45%),linear-gradient(160deg,rgba(255,255,255,0.25),transparent_60%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(160deg,rgba(255,255,255,0.04),transparent_60%)]" />
          <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Ontario lease review
              </p>
              <div className="max-w-xl space-y-4">
                <h2 className="text-4xl font-semibold tracking-tight text-balance">
                  {title}
                </h2>
                <p className="text-base leading-7 text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
            <blockquote className="max-w-xl space-y-4 border-l-4 border-primary/60 pl-6 text-lg italic leading-8 text-muted-foreground">
              <p>&ldquo;{quote}&rdquo;</p>
              <footer className="text-sm font-medium not-italic text-foreground">
                {attribution}
              </footer>
            </blockquote>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md space-y-4">
            <div className="space-y-2 text-center lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Ontario lease review
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}

function GoogleButton({ label }: { label: string }) {
  return (
    <a href="/api/auth/google" className="block">
      <Button type="button" variant="outline" className="w-full">
        <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {label}
      </Button>
    </a>
  )
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { res, json } = await postJson("/api/auth/login", { email, password })
    setLoading(false)

    if (!res.ok) {
      setError(json?.error ?? "Login failed")
      return
    }

    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <AuthCard title="Sign in" subtitle="Access your LeaseLens workspace">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="my-4 h-px w-full bg-border" />
      <GoogleButton label="Continue with Google" />

      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="underline text-muted-foreground">
          Forgot password?
        </Link>
      </p>

      <p className="mt-4 text-sm text-muted-foreground">
        Need an account?{" "}
        <Link href="/signup" className="underline">
          Create one
        </Link>
      </p>
    </AuthCard>
  )
}

export function SignupForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    const { res, json } = await postJson("/api/auth/signup", {
      name: name || undefined,
      email,
      password,
    })
    setLoading(false)

    if (!res.ok) {
      setError(json?.error ?? "Signup failed")
      return
    }

    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <AuthCard title="Create account" subtitle="Start analyzing your agreements">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">Display name (optional)</label>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Use 12-64 characters and avoid common passwords.
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>

      <div className="my-4 h-px w-full bg-border" />
      <GoogleButton label="Continue with Google" />

      <p className="mt-4 text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [emailHint, setEmailHint] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function startFlow(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { res, json } = await postJson("/api/auth/password-reset/start", { email })
    setLoading(false)
    if (!res.ok) {
      setError(json?.error ?? "Failed to start password reset")
      return
    }
    setEmailHint(json?.emailHint ?? null)
  }

  async function sendCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { res, json } = await postJson("/api/auth/password-reset/send-code", { email })
    setLoading(false)

    if (!res.ok) {
      setError(json?.error ?? "Failed to send code")
      return
    }
    setMessage("Verification code sent to your email")
  }

  async function confirmReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { res, json } = await postJson("/api/auth/password-reset/confirm", {
      email,
      code,
      newPassword,
    })
    setLoading(false)

    if (!res.ok) {
      setError(json?.error ?? "Failed to reset password")
      return
    }
    setMessage("Password reset complete. You can sign in with your new password.")
  }

  return (
    <AuthCard title="Reset password" subtitle="Use your account email to receive a verification code.">
      <form onSubmit={startFlow} className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Button type="submit" disabled={loading || !email.trim()}>
          {loading ? "Checking..." : "Continue"}
        </Button>
      </form>

      {emailHint ? (
        <div className="mt-6 rounded-lg border p-4">
          <p className="text-sm font-medium">Send verification code</p>
          <p className="text-xs text-muted-foreground">
            Account found: <span className="font-mono">{emailHint}</span>
          </p>
          <form onSubmit={sendCode} className="mt-3">
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? "Sending..." : "Send verification code"}
            </Button>
          </form>
        </div>
      ) : null}

      {emailHint ? (
        <form onSubmit={confirmReset} className="mt-6 space-y-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Reset with code</p>
          <Input
            placeholder="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={12}
            required
          />
          <p className="text-xs text-muted-foreground">
            Password must be 12-64 characters and not be a common password.
          </p>
          <Button type="submit" disabled={loading || !code || !newPassword}>
            {loading ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-green-600">{message}</p> : null}

      <p className="mt-6 text-sm text-muted-foreground">
        Back to{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
