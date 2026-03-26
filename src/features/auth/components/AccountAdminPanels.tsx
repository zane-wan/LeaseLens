"use client"

import { FormEvent, useEffect, useState } from "react"
import type { UserRole } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

async function readJsonSafely<T>(res: Response): Promise<T | null> {
  return res.json().catch(() => null)
}

interface AccountUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  subscriptionStatus: string | null
}

interface AdminUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  emailVerified: boolean
  createdAt: string
}

interface MeResponse {
  user: {
    id: string
    role: UserRole
  } | null
}

function canEditTarget(me: NonNullable<MeResponse["user"]>, target: AdminUser) {
  if (me.role === "OWNER") return true
  if (me.role === "ADMIN") {
    if (me.id === target.id) return true
    return target.role === "USER"
  }
  return false
}

function canAssignTargetRole(
  me: NonNullable<MeResponse["user"]>,
  target: AdminUser,
  nextRole: UserRole
) {
  if (!canEditTarget(me, target)) return false
  if (me.role === "OWNER") return true
  if (me.role === "ADMIN") return nextRole === "USER"
  return false
}

function canDeleteTarget(me: NonNullable<MeResponse["user"]>, target: AdminUser) {
  if (me.role === "OWNER") {
    return me.id !== target.id
  }
  if (me.role === "ADMIN") {
    return me.id !== target.id && target.role === "USER"
  }
  return false
}

export function AccountSettings({ initialStatus }: { initialStatus?: string }) {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [subMessage, setSubMessage] = useState<string | null>(null)
  const [subError, setSubError] = useState<string | null>(null)

  useEffect(() => {
    if (initialStatus === "success") {
      setSubMessage("Subscription updated successfully!")
    } else if (initialStatus === "canceled") {
      setSubError("Subscription checkout was canceled.")
    }
  }, [initialStatus])

  useEffect(() => {
    let active = true
    fetch("/api/auth/account")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return
        setUser(json.user)
        setName(json.user?.name ?? "")
        setEmail(json.user?.email ?? "")
      })
      .catch(() => {
        if (!active) return
        setError("Failed to load account")
      })

    return () => {
      active = false
    }
  }, [])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const payload: Record<string, string> = {}
    if (name.trim()) payload.name = name.trim()
    if (email.trim() !== (user?.email ?? "")) {
      payload.email = email.trim()
    }
    if (currentPassword) payload.currentPassword = currentPassword
    if (newPassword) payload.newPassword = newPassword

    const res = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setLoading(false)

    const json = await readJsonSafely<{ error?: string; user?: AccountUser }>(res)
    if (!res.ok) {
      setError(json?.error ?? "Failed to update account")
      return
    }

    const updatedUser = json?.user
    if (!updatedUser) {
      setError("Unexpected response from server")
      return
    }

    setUser(updatedUser)
    setName(updatedUser.name ?? "")
    setEmail(updatedUser.email)
    setCurrentPassword("")
    setNewPassword("")
    setMessage("Account updated")
  }

  async function onDeleteAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setDeleting(true)
    setError(null)
    setMessage(null)

    const res = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: deletePassword,
        confirmation: deleteConfirm,
      }),
    })
    setDeleting(false)

    const json = await readJsonSafely<{ error?: string }>(res)
    if (!res.ok) {
      setError(json?.error ?? "Failed to delete account")
      return
    }

    window.location.href = "/signup"
  }

  async function onUpgrade() {
    setSubscribing(true)
    setSubError(null)
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" })
      const json = await readJsonSafely<{ url?: string; error?: string }>(res)
      if (!res.ok || !json?.url) {
        setSubError(json?.error ?? "Failed to start checkout")
        return
      }
      window.location.href = json.url
    } catch {
      setSubError("Failed to start checkout")
    } finally {
      setSubscribing(false)
    }
  }

  async function onManageSubscription() {
    setSubscribing(true)
    setSubError(null)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const json = await readJsonSafely<{ url?: string; error?: string }>(res)
      if (!res.ok || !json?.url) {
        setSubError(json?.error ?? "Failed to open billing portal")
        return
      }
      window.location.href = json.url
    } catch {
      setSubError("Failed to open billing portal")
    } finally {
      setSubscribing(false)
    }
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground">Loading account...</p>
  }

  const isPro = user.subscriptionStatus === "active"

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Account settings</h1>
          {isPro ? <Badge className="text-xs">PRO</Badge> : null}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-muted-foreground">{user.email}</span>
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {user.role}
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Subscription</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPro
                ? "You are on the Pro plan."
                : "Upgrade to Pro to support LeaseLens."}
            </p>
          </div>
          {isPro ? (
            <Badge variant="outline" className="px-3 py-1 text-sm">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              Free
            </Badge>
          )}
        </div>
        {subError ? <p className="mt-3 text-sm text-destructive">{subError}</p> : null}
        {subMessage ? <p className="mt-3 text-sm text-green-600">{subMessage}</p> : null}
        <div className="mt-4">
          {isPro ? (
            <Button variant="outline" onClick={onManageSubscription} disabled={subscribing}>
              {subscribing ? "Opening portal..." : "Manage subscription"}
            </Button>
          ) : (
            <Button onClick={onUpgrade} disabled={subscribing}>
              {subscribing ? "Redirecting..." : "Upgrade to Pro"}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Profile details</h2>
        <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">Name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="current-password" className="text-sm font-medium">Current password</label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="new-password" className="text-sm font-medium">New password</label>
          <input
            id="new-password"
            type="password"
            minLength={12}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Use 12-64 characters and avoid common passwords.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-green-600">{message}</p> : null}

        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save changes"}
        </Button>
        </form>
      </div>

      <div className="rounded-xl border border-destructive/20 bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-destructive">Danger zone</h2>
        <form onSubmit={onDeleteAccount} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            This permanently deletes your account and all related data.
          </p>
          <div className="space-y-1">
            <label htmlFor="delete-password" className="text-sm font-medium">Current password</label>
            <input
              id="delete-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Required for password-based accounts; optional for Google-only accounts.
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor="delete-confirm" className="text-sm font-medium">Type DELETE to confirm</label>
            <input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              required
            />
          </div>
          <Button type="submit" variant="destructive" disabled={deleting}>
            {deleting ? "Deleting..." : "Delete account"}
          </Button>
        </form>
      </div>
    </div>
  )
}

export function AdminUsersPanel() {
  const [me, setMe] = useState<MeResponse["user"]>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setError(null)
    const [meRes, usersRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/admin/users"),
    ])

    const meJson = (await readJsonSafely<MeResponse>(meRes)) ?? { user: null }
    setMe(meJson.user ?? null)
    if (!usersRes.ok) {
      const err = await readJsonSafely<{ error?: string }>(usersRes)
      setError(err?.error ?? "Failed to load users")
      return
    }

    const usersJson = (await readJsonSafely<AdminUser[]>(usersRes)) ?? []
    setUsers(usersJson)
  }

  useEffect(() => {
    load().catch(() => setError("Failed to load users"))
  }, [])

  async function updateRole(userId: string, role: UserRole) {
    setBusyId(userId)
    setError(null)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    setBusyId(null)
    if (!res.ok) {
      const json = await readJsonSafely<{ error?: string }>(res)
      setError(json?.error ?? "Failed to update role")
      return
    }
    await load()
  }

  async function deleteUser(userId: string, email: string) {
    const confirmed = window.confirm(`Delete account ${email}? This cannot be undone.`)
    if (!confirmed) return

    setBusyId(userId)
    setError(null)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    })
    setBusyId(null)
    if (!res.ok) {
      const json = await readJsonSafely<{ error?: string }>(res)
      setError(json?.error ?? "Failed to delete user")
      return
    }
    await load()
  }

  if (!me) {
    return <p className="text-sm text-muted-foreground">Loading admin users...</p>
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <h1 className="text-xl font-semibold">User administration</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Owners can manage all users except deleting their own owner account. Administrators can manage and delete normal users.
      </p>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,2fr)_minmax(110px,0.7fr)_minmax(140px,0.8fr)_auto] md:items-center"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{u.name ?? "Unnamed user"}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
            <p className="text-xs text-muted-foreground">{u.emailVerified ? "Verified" : "Unverified"}</p>
            <p className="text-xs text-muted-foreground">Current: {u.role}</p>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  busyId === u.id ||
                  !canAssignTargetRole(me, u, "USER") ||
                  u.role === "USER"
                }
                onClick={() => updateRole(u.id, "USER")}
              >
                USER
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  busyId === u.id ||
                  !canAssignTargetRole(me, u, "ADMIN") ||
                  u.role === "ADMIN"
                }
                onClick={() => updateRole(u.id, "ADMIN")}
              >
                ADMIN
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  busyId === u.id ||
                  !canAssignTargetRole(me, u, "OWNER") ||
                  u.role === "OWNER"
                }
                onClick={() => updateRole(u.id, "OWNER")}
              >
                OWNER
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busyId === u.id || !canDeleteTarget(me, u)}
                onClick={() => deleteUser(u.id, u.email)}
              >
                DELETE
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
