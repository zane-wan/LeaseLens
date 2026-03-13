"use client"

import { FormEvent, useEffect, useState } from "react"
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

export function SupportInbox() {
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [reply, setReply] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function loadThreads() {
    const res = await fetch("/api/support/threads")
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? "Failed to load support threads")
      return
    }
    const json = await res.json()
    setThreads(json)
    if (!activeThreadId && json[0]) {
      setActiveThreadId(json[0].id)
    }
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
    if (!activeThreadId) return
    loadMessages(activeThreadId).catch(() => setError("Failed to load messages"))
  }, [activeThreadId])

  async function createThread(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const res = await fetch("/api/support/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? "Failed to create thread")
      return
    }
    setSubject("")
    setBody("")
    await loadThreads()
  }

  async function sendReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!activeThreadId) return
    setError(null)
    const res = await fetch(`/api/support/threads/${activeThreadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? "Failed to send message")
      return
    }
    setReply("")
    await loadMessages(activeThreadId)
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
      <section className="space-y-4 rounded-xl border p-4 md:col-span-1">
        <h1 className="text-lg font-semibold">Support threads</h1>
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No threads yet</p>
        ) : (
          <div className="space-y-2">
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveThreadId(t.id)}
                className={`w-full rounded-md border p-2 text-left text-sm ${
                  activeThreadId === t.id ? "border-primary" : ""
                }`}
              >
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {t.owner?.email ?? "You"} • {new Date(t.updatedAt).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={createThread} className="space-y-2 border-t pt-4">
          <h2 className="text-sm font-medium">New inquiry</h2>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            required
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe your issue"
            required
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" size="sm">Create thread</Button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border p-4 md:col-span-2">
        <h2 className="text-lg font-semibold">Conversation</h2>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-2">
          {messages.map((m) => (
            <article key={m.id} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {m.senderRole} • {m.direction} • {new Date(m.createdAt).toLocaleString()}
              </p>
              <p className="text-sm font-medium">{m.subject}</p>
              <p className="text-sm">{m.body}</p>
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
            <Button type="submit" size="sm">Send</Button>
          </form>
        ) : null}
      </section>
    </main>
  )
}
