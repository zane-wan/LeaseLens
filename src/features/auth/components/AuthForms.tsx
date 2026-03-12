"use client"

import Link from "next/link"
import { FormEvent, type ReactNode, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

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
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { res, json } = await postJson("/api/auth/login", { username, password })
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
          <label htmlFor="username" className="text-sm font-medium">Username</label>
          <input
            id="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-3 text-sm">
        <Link href="/forgot-password" className="underline text-muted-foreground">
          Forget about password?
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
  const [username, setUsername] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { res, json } = await postJson("/api/auth/signup", {
      username,
      name: name || undefined,
      email: email || undefined,
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
          <label htmlFor="username" className="text-sm font-medium">Username</label>
          <input
            id="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">Display name (optional)</label>
          <input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">Email (optional)</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Use 12-64 characters and avoid common passwords.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>

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
  const [username, setUsername] = useState("")
  const [emailHint, setEmailHint] = useState<string | null>(null)
  const [email, setEmail] = useState("")
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

    const { res, json } = await postJson("/api/auth/password-reset/start", { username })
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

    const { res, json } = await postJson("/api/auth/password-reset/send-code", { username, email })
    setLoading(false)

    if (!res.ok) {
      setError(json?.error ?? "Failed to send code")
      return
    }
    setMessage("Verification code sent to your attached email")
  }

  async function confirmReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { res, json } = await postJson("/api/auth/password-reset/confirm", {
      username,
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
    <AuthCard title="Reset password" subtitle="Username is required, and this account must have an attached email.">
      <form onSubmit={startFlow} className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">Username</label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit" disabled={loading || !username.trim()}>
          {loading ? "Checking..." : "Continue"}
        </Button>
      </form>

      {emailHint ? (
        <div className="mt-6 rounded-lg border p-4">
          <p className="text-sm font-medium">Confirm attached email</p>
          <p className="text-xs text-muted-foreground">
            Type full email matching hint: <span className="font-mono">{emailHint}</span>
          </p>
          <form onSubmit={sendCode} className="mt-3 space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
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
