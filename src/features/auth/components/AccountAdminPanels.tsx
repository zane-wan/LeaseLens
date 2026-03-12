"use client"

import { FormEvent, useEffect, useState } from "react"
import type { UserRole } from "@prisma/client"
import { Button } from "@/components/ui/button"

async function readJsonSafely<T>(res: Response): Promise<T | null> {
  return res.json().catch(() => null)
}

interface AccountUser {
  id: string
  username: string
  email: string | null
  name: string | null
  role: UserRole
}

interface AdminUser {
  id: string
  username: string
  email: string | null
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

export function AccountSettings() {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [username, setUsername] = useState("")
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

  useEffect(() => {
    let active = true
    fetch("/api/auth/account")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return
        setUser(json.user)
        setUsername(json.user?.username ?? "")
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
    if (username.trim() && username.trim() !== user?.username) {
      payload.username = username.trim()
    }
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
    setUsername(updatedUser.username ?? "")
    setName(updatedUser.name ?? "")
    setEmail(updatedUser.email ?? "")
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

  if (!user) {
    return <p className="text-sm text-muted-foreground">Loading account...</p>
  }

  return (
    <div className="mx-auto max-w-xl rounded-xl border bg-card p-6">
      <h1 className="text-xl font-semibold">Account settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Role: {user.role}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-1">
          <label htmlFor="username" className="text-sm font-medium">Username</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
          <label htmlFor="email" className="text-sm font-medium">Email (optional)</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

      <form onSubmit={onDeleteAccount} className="mt-8 space-y-3 rounded-lg border border-destructive/40 p-4">
        <h2 className="text-sm font-semibold text-destructive">Delete account</h2>
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
            required
          />
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

  if (!me) {
    return <p className="text-sm text-muted-foreground">Loading admin users...</p>
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <h1 className="text-xl font-semibold">User administration</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Owners can manage all users. Administrators can manage normal users.
      </p>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 space-y-2">
        {users.map((u) => (
          <div key={u.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-5 md:items-center">
            <div className="md:col-span-2">
              <p className="text-sm font-medium">{u.name ?? "Unnamed user"}</p>
              <p className="text-xs text-muted-foreground">
                @{u.username} {u.email ? `• ${u.email}` : "• no email attached"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{u.emailVerified ? "Verified" : "Unverified"}</p>
            <p className="text-xs text-muted-foreground">Current: {u.role}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === u.id}
                onClick={() => updateRole(u.id, "USER")}
              >
                USER
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === u.id || me.role !== "OWNER"}
                onClick={() => updateRole(u.id, "ADMIN")}
              >
                ADMIN
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === u.id || me.role !== "OWNER"}
                onClick={() => updateRole(u.id, "OWNER")}
              >
                OWNER
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
