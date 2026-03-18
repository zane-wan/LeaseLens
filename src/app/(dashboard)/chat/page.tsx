"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useChat, type Message } from "ai/react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare, Send, Plus, Loader2, Bot, User } from "lucide-react"

interface SessionAgreement {
  id: string
  fileName: string
  status: string
  analysis?: {
    overallSummary: string | null
    riskScore: number | null
  } | null
}

interface ChatSession {
  id: string
  title: string
  agreements: SessionAgreement[]
  messages: {
    id: string
    role: "USER" | "ASSISTANT" | "SYSTEM"
    content: string
    createdAt: string
  }[]
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionAgreements, setSessionAgreements] = useState<SessionAgreement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: isSending,
    setMessages,
  } = useChat({
    api: sessionId ? `/api/chats/sessions/${sessionId}/chat` : "/api/chats/sessions",
  })

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load latest session on mount
  useEffect(() => {
    loadLatestSession()
  }, [])

  async function loadLatestSession() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/chats/sessions/latest")
      if (res.status === 404) {
        // No session exists
        setSessionId(null)
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error("Failed to load session")

      const session: ChatSession = await res.json()
      setSessionId(session.id)
      setSessionAgreements(session.agreements)

      // Convert DB messages to useChat format
      const chatMessages: Message[] = session.messages
        .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
        .map((m) => ({
          id: m.id,
          role: m.role === "USER" ? "user" : "assistant",
          content: m.content,
          createdAt: new Date(m.createdAt),
        }))
      setMessages(chatMessages)
    } catch {
      setError("Failed to load chat session")
    } finally {
      setLoading(false)
    }
  }

  async function createNewSession() {
    setError(null)
    try {
      // Fetch all user's agreements (including session-linked) to find completed ones
      const agRes = await fetch("/api/agreements?all=true")
      if (!agRes.ok) throw new Error("Failed to fetch agreements")
      const agreements: { id: string; fileName: string; status: string }[] = await agRes.json()

      const completed = agreements.filter((a) => a.status === "COMPLETED")
      if (completed.length === 0) {
        setError("No analyzed agreements yet. Upload and analyze a lease first.")
        return
      }

      const res = await fetch("/api/chats/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Lease Review Chat",
          agreementIds: completed.map((a) => a.id),
        }),
      })
      if (!res.ok) throw new Error("Failed to create session")

      const session = await res.json()
      setSessionId(session.id)
      setSessionAgreements(session.agreements ?? completed)
      setMessages([])
    } catch {
      setError("Failed to create chat session")
    }
  }

  // Loading state
  if (loading) {
    return (
      <main className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  // No session — empty state
  if (!sessionId) {
    return (
      <main className="flex h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="size-8 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Chat about your leases</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Ask questions about your analyzed lease agreements. The AI assistant has context of your
          lease clauses, analysis results, and relevant Ontario tenancy law.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={createNewSession} className="gap-2">
          <Plus className="size-4" />
          New Chat
        </Button>
      </main>
    )
  }

  // Chat UI
  return (
    <main className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Lease Chat</h1>
          <p className="text-xs text-muted-foreground">
            {sessionAgreements.map((a) => a.fileName).join(", ")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => {
            setSessionId(null)
            setMessages([])
            setSessionAgreements([])
            createNewSession()
          }}
        >
          <Plus className="size-3" />
          New Chat
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Bot className="size-10 opacity-50" />
            <p className="text-sm">Ask a question about your lease to get started.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Is the no-pets clause enforceable?",
                "Can my landlord increase rent mid-lease?",
                "What are my rights regarding entry notice?",
              ].map((q) => (
                <button
                  key={q}
                  className="rounded-lg border bg-background px-3 py-2 text-xs hover:bg-muted transition-colors"
                  onClick={() => {
                    handleInputChange({ target: { value: q } } as React.ChangeEvent<HTMLInputElement>)
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-4 text-primary" />
                </div>
              )}
              <Card
                className={`max-w-[85%] py-0 ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50"
                }`}
              >
                <CardContent className="px-3 py-1.5">
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{m.content}</p>
                  )}
                </CardContent>
              </Card>
              {m.role === "user" && (
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="size-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isSending && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
              <Card className="bg-muted/50 py-0">
                <CardContent className="px-3 py-1.5">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {error && (
        <p className="px-4 text-sm text-destructive">{error}</p>
      )}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t px-4 py-3"
      >
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about your lease..."
          disabled={isSending}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={isSending || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </main>
  )
}
