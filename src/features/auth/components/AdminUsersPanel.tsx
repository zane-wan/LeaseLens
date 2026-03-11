"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type UserRole = "OWNER" | "ADMIN" | "USER"

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

    const meJson = await meRes.json().catch(() => ({ user: null }))
    setMe(meJson.user ?? null)
    if (!usersRes.ok) {
      const err = await usersRes.json().catch(() => null)
      setError(err?.error ?? "Failed to load users")
      return
    }

    const usersJson = await usersRes.json()
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
      const json = await res.json().catch(() => null)
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
              <p className="text-xs text-muted-foreground">{u.email}</p>
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
