"use client"

import Link from "next/link"
import { FormEvent, type ReactNode, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAppDispatch } from "@/store"
import { fetchCurrentUser } from "@/store/slices/authSlice"

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
    <div className="mx-auto w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  )
}

export function LoginForm() {
  const router = useRouter()
  const dispatch = useAppDispatch()
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

    dispatch(fetchCurrentUser())
    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <form onSubmit={onSubmit}>
          <CardContent className="pt-6 pb-6 space-y-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium leading-none"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            {/* Credentials submit */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>

            {/* Divider */}
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Link href="/api/auth/google" className="w-full">
              <Button type="button" variant="outline" className="w-full">
                <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>
            </Link>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

export function SignupForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { res, json } = await postJson("/api/auth/signup", {
      name: name || undefined,
      email,
      password,
      acceptedTerms,
      acceptedPrivacy,
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
    <div className="mx-auto w-full max-w-md">
      <Card>
        <form onSubmit={onSubmit}>
          <CardContent className="pt-6 pb-6 space-y-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {/* Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium leading-none">
                Display name (optional)
              </label>
              <Input
                id="name"
                autoComplete="name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none">
                Email
              </label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use 12-64 characters and avoid common passwords.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 size-4 rounded border"
                  required
                />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" className="font-medium text-primary underline-offset-4 hover:underline">
                    Terms
                  </Link>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  className="mt-1 size-4 rounded border"
                  required
                />
                <span>
                  I have read the{" "}
                  <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </Button>

            {/* Divider */}
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Link href="/api/auth/google" className="w-full">
              <Button type="button" variant="outline" className="w-full">
                <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>
            </Link>

            <p className="text-center text-sm text-muted-foreground mt-2">
              Already registered?{" "}
              <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
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
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
          <input
            placeholder="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={12}
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
