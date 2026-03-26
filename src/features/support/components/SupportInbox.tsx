"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"

interface ThreadItem {
  id: string
  ownerUserId: string
  subject: string
  status: "OPEN" | "CLOSED"
  createdAt: string
  updatedAt: string
  owner?: {
    email: string | null
    name: string | null
  }
}

interface MessageItem {
  id: string
  senderRole: "OWNER" | "ADMIN" | "USER"
  direction: "INBOUND" | "OUTBOUND"
  subject: string
  body: string
  createdAt: string
}

interface MeResponse {
  user: {
    id: string
    email: string
    role: "OWNER" | "ADMIN" | "USER"
  } | null
}

function getThreadStatusLabel(status: ThreadItem["status"]) {
  return status === "CLOSED" ? "Resolved" : "Unresolved"
}

export function SupportInbox() {
  const [me, setMe] = useState<MeResponse["user"]>(null)
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [reply, setReply] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads]
  )

  async function loadThreads() {
    const [meRes, threadsRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/support/threads"),
    ])

    const meJson = (await meRes.json().catch(() => null)) as MeResponse | null
    setMe(meJson?.user ?? null)

    if (!threadsRes.ok) {
      const json = await threadsRes.json().catch(() => null)
      setError(json?.error ?? "Failed to load support threads")
      return
    }

    const json = (await threadsRes.json()) as ThreadItem[]
    setThreads(json)
    setActiveThreadId((currentId) => {
      if (currentId && json.some((thread) => thread.id === currentId)) {
        return currentId
      }
      return json[0]?.id ?? null
    })
  }

  async function loadMessages(threadId: string) {
    const res = await fetch(`/api/support/threads/${threadId}/messages`)
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? "Failed to load messages")
      return
    }
    const json = await res.json()
    setMessages(json)
  }

  useEffect(() => {
    loadThreads().catch(() => setError("Failed to load support threads"))
  }, [])

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([])
      return
    }
    loadMessages(activeThreadId).catch(() => setError("Failed to load messages"))
  }, [activeThreadId])

  async function createThread(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setBusy("create")

    const res = await fetch("/api/support/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    })

    setBusy(null)
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? "Failed to create thread")
      return
    }

    const json = (await res.json()) as ThreadItem
    setSubject("")
    setBody("")
    await loadThreads()
    setActiveThreadId(json.id)
  }

  async function sendReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!activeThreadId) return

    setError(null)
    setBusy("reply")
    const res = await fetch(`/api/support/threads/${activeThreadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    })
    setBusy(null)

    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? "Failed to send message")
      return
    }

    setReply("")
    await Promise.all([loadMessages(activeThreadId), loadThreads()])
  }

  async function updateThreadStatus(status: ThreadItem["status"]) {
    if (!activeThreadId) return

    setError(null)
    setBusy("status")
    const res = await fetch(`/api/support/threads/${activeThreadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setBusy(null)

    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? "Failed to update thread status")
      return
    }

    await loadThreads()
  }

  async function deleteThread() {
    if (!activeThreadId || !activeThread) return
    const confirmed = window.confirm(`Delete support thread "${activeThread.subject}"?`)
    if (!confirmed) return

    setError(null)
    setBusy("delete")
    const res = await fetch(`/api/support/threads/${activeThreadId}`, {
      method: "DELETE",
    })
    setBusy(null)

    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? "Failed to delete thread")
      return
    }

    setMessages([])
    await loadThreads()
  }

  const canResolveThread = Boolean(activeThread && me && activeThread.ownerUserId === me.id)
  const canDeleteThread = Boolean(
    activeThread &&
      me &&
      (activeThread.ownerUserId === me.id || me.role === "ADMIN" || me.role === "OWNER")
  )

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
      <section className="space-y-4 rounded-xl border p-4 md:col-span-1">
        <h1 className="text-lg font-semibold">Support threads</h1>
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No threads yet</p>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => {
              const selected = activeThreadId === thread.id
              const threadOwnerLabel =
                me && thread.ownerUserId === me.id
                  ? "You"
                  : thread.owner?.email ?? "Unknown user"

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full rounded-md border p-3 text-left text-sm ${
                    selected ? "border-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{thread.subject}</p>
                    <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {getThreadStatusLabel(thread.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {threadOwnerLabel} • {new Date(thread.updatedAt).toLocaleString()}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        <form onSubmit={createThread} className="space-y-2 border-t pt-4">
          <h2 className="text-sm font-medium">New inquiry</h2>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            required
            minLength={3}
            maxLength={180}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe your issue"
            required
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" size="sm" disabled={busy === "create"}>
            {busy === "create" ? "Creating..." : "Create thread"}
          </Button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border p-4 md:col-span-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Conversation</h2>
              {activeThread ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground whitespace-pre-wrap">
                    Subject: {activeThread.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: {getThreadStatusLabel(activeThread.status)}
                  </p>
                </>
              ) : null}
            </div>

            {activeThread ? (
              <div className="flex flex-wrap gap-2">
                {canResolveThread ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === "status"}
                    onClick={() =>
                      updateThreadStatus(activeThread.status === "OPEN" ? "CLOSED" : "OPEN")
                    }
                  >
                    {busy === "status"
                      ? "Saving..."
                      : activeThread.status === "OPEN"
                        ? "Mark resolved"
                        : "Mark unresolved"}
                  </Button>
                ) : null}
                {canDeleteThread ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy === "delete"}
                    onClick={deleteThread}
                  >
                    {busy === "delete" ? "Deleting..." : "Delete thread"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-2">
          {messages.map((message) => (
            <article key={message.id} className="rounded-md border p-3">
              <p className="mb-1 text-xs text-muted-foreground">
                {message.senderRole} • {message.direction} • {new Date(message.createdAt).toLocaleString()}
              </p>
              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
            </article>
          ))}
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Select a thread to view messages.</p>
          ) : null}
        </div>

        {activeThreadId ? (
          <form onSubmit={sendReply} className="space-y-2 border-t pt-4">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply"
              required
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" disabled={busy === "reply"}>
              {busy === "reply" ? "Sending..." : "Send"}
            </Button>
          </form>
        ) : null}
      </section>
    </main>
  )
}
