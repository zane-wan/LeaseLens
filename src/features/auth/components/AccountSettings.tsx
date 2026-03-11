"use client"

import { FormEvent, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface AccountUser {
  id: string
  email: string
  name: string | null
  role: "OWNER" | "ADMIN" | "USER"
}

export function AccountSettings() {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    if (email.trim()) payload.email = email.trim()
    if (currentPassword) payload.currentPassword = currentPassword
    if (newPassword) payload.newPassword = newPassword

    const res = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setLoading(false)

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setError(json?.error ?? "Failed to update account")
      return
    }

    setUser(json.user)
    setName(json.user?.name ?? "")
    setEmail(json.user?.email ?? "")
    setCurrentPassword("")
    setNewPassword("")
    setMessage("Account updated")
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
          <label htmlFor="name" className="text-sm font-medium">Name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
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
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-green-600">{message}</p> : null}

        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </div>
  )
}
