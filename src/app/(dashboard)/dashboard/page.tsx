"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useChat, type Message } from "ai/react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { DropZone } from "@/features/upload/components/DropZone"
import { AgreementList } from "@/features/upload/components/AgreementList"
import { useUpload } from "@/features/upload/hooks/useUpload"
import { AgreementItem } from "@/features/upload/types"
import { ClauseCard, type ClauseResultData } from "@/features/analysis/components/ClauseCard"
import { RiskScoreRing } from "@/features/analysis/components/RiskScoreRing"
import { Send, Loader2, Bot, User as UserIcon, RotateCcw } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionAnalysis {
  status: string
  overallSummary: string | null
  riskScore: number | null
  clauseResults: ClauseResultData[]
}

interface SessionAgreement {
  id: string
  fileName: string
  analysis: SessionAnalysis | null
}

interface SessionMessage {
  id: string
  role: "USER" | "ASSISTANT" | "SYSTEM"
  content: string
  createdAt: string
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { uploadState, uploadMany, reset } = useUpload()
  const [agreements, setAgreements] = useState<AgreementItem[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionAgreements, setSessionAgreements] = useState<SessionAgreement[]>([])
  const [initialMessages, setInitialMessages] = useState<Message[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [analyzeTriggered, setAnalyzeTriggered] = useState(false)
  const creatingSession = useRef(false)

  // ── Init: try session restore, then load unlinked agreements ──
  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/chats/sessions/latest")
        if (sessionRes.ok) {
          const session = await sessionRes.json()
          setSessionId(session.id)
          setSessionAgreements(session.agreements)
          setInitialMessages(
            session.messages
              .filter((m: SessionMessage) => m.role !== "SYSTEM")
              .map((m: SessionMessage) => ({
                id: m.id,
                role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
                content: m.content,
                createdAt: new Date(m.createdAt),
              })),
          )
        } else {
          const agRes = await fetch("/api/agreements")
          if (agRes.ok) setAgreements(await agRes.json())
        }
      } catch {
        setPageError("Failed to load data")
      } finally {
        setInitialLoading(false)
      }
    }
    init()
  }, [])

  const fetchAgreements = useCallback(async () => {
    const res = await fetch("/api/agreements")
    if (res.ok) setAgreements(await res.json())
  }, [])

  // ── Poll while any agreement is PROCESSING ──
  useEffect(() => {
    if (sessionId) return
    const hasProcessing = agreements.some((a) => a.status === "PROCESSING")
    if (!hasProcessing) return
    const timer = setInterval(fetchAgreements, 3000)
    return () => clearInterval(timer)
  }, [agreements, fetchAgreements, sessionId])

  // ── Auto-create session when all analyses finish ──
  useEffect(() => {
    if (!analyzeTriggered || sessionId || agreements.length === 0 || creatingSession.current) return
    const allDone = agreements.every((a) => a.status === "COMPLETED" || a.status === "FAILED")
    const anyCompleted = agreements.some((a) => a.status === "COMPLETED")
    if (!allDone || !anyCompleted) return

    creatingSession.current = true
    const completedIds = agreements.filter((a) => a.status === "COMPLETED").map((a) => a.id)

    fetch("/api/chats/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Lease Review", agreementIds: completedIds }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to create session")
        return fetch("/api/chats/sessions/latest")
      })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load session")
        return res.json()
      })
      .then((session) => {
        setSessionId(session.id)
        setSessionAgreements(session.agreements)
        setInitialMessages([])
      })
      .catch(() => {
        setPageError("Failed to create chat session")
        creatingSession.current = false
      })
  }, [agreements, analyzeTriggered, sessionId])

  // ── Handlers ──

  async function handleFilesDrop(files: File[]) {
    const results = await uploadMany(files)
    if (results.length > 0) fetchAgreements()
  }

  async function handleAnalyzeAll() {
    const pending = agreements.filter((a) => a.status === "PENDING")
    if (pending.length === 0) return
    setAnalyzeTriggered(true)
    setPageError(null)
    await Promise.all(
      pending.map((a) =>
        fetch(`/api/agreements/${a.id}/analyze`, { method: "POST" }).catch(() => null),
      ),
    )
    fetchAgreements()
  }

  async function handleAnalyze(id: string) {
    const res = await fetch(`/api/agreements/${id}/analyze`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      setPageError(err?.error ?? "Failed to start analysis")
      return
    }
    setAnalyzeTriggered(true)
    fetchAgreements()
  }

  async function handleCancel(id: string) {
    const res = await fetch(`/api/agreements/${id}/cancel`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      setPageError(err?.error ?? "Failed to cancel")
      return
    }
    fetchAgreements()
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/agreements/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      setPageError(err?.error ?? "Failed to delete")
      return
    }
    fetchAgreements()
  }

  async function handleNewSession() {
    setSessionId(null)
    setSessionAgreements([])
    setInitialMessages([])
    setAnalyzeTriggered(false)
    setPageError(null)
    creatingSession.current = false
    const res = await fetch("/api/agreements")
    if (res.ok) setAgreements(await res.json())
    else setAgreements([])
  }

  // ── Loading ──

  if (initialLoading) {
    return (
      <main className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const hasPending = agreements.some((a) => a.status === "PENDING")
  const hasProcessing = agreements.some((a) => a.status === "PROCESSING")

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Agreements</h1>
        {sessionId && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleNewSession}>
            <RotateCcw className="size-3" />
            New Session
          </Button>
        )}
      </div>

      {/* ── Upload Phase (no session yet) ── */}
      {!sessionId && (
        <>
          <DropZone uploadState={uploadState} onFilesDrop={handleFilesDrop} onReset={reset} />

          <AgreementList
            agreements={agreements}
            onAnalyze={handleAnalyze}
            onCancel={handleCancel}
            onDelete={handleDelete}
          />

          {/* Analyze All */}
          {hasPending && (
            <Button onClick={handleAnalyzeAll} className="w-full" disabled={hasProcessing}>
              {hasProcessing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze All"
              )}
            </Button>
          )}

          {/* Analyzing spinner (all triggered, waiting) */}
          {!hasPending && hasProcessing && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Analyzing your leases...</span>
            </div>
          )}
        </>
      )}

      {pageError && <p className="text-sm text-destructive">{pageError}</p>}

      {/* ── Analysis Results (session exists) ── */}
      {sessionId && sessionAgreements.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">Analysis Results</h2>
          {sessionAgreements.map((ag) => (
            <div key={ag.id} className="space-y-3">
              <h3 className="font-medium">{ag.fileName}</h3>

              {ag.analysis?.status === "COMPLETED" ? (
                <div className="space-y-3">
                  {/* Summary card */}
                  <Card className="p-4">
                    <div className="flex items-center gap-6">
                      <RiskScoreRing score={ag.analysis.riskScore ?? 0} size={80} />
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold text-green-500">
                              {ag.analysis.clauseResults.filter((c) => c.compliance === "COMPLIANT").length}
                            </p>
                            <p className="text-xs text-muted-foreground">Compliant</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-amber-500">
                              {ag.analysis.clauseResults.filter((c) => c.compliance === "NEEDS_REVIEW").length}
                            </p>
                            <p className="text-xs text-muted-foreground">Review</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-red-500">
                              {ag.analysis.clauseResults.filter((c) => c.compliance === "NON_COMPLIANT").length}
                            </p>
                            <p className="text-xs text-muted-foreground">Non-compliant</p>
                          </div>
                        </div>
                        {ag.analysis.overallSummary && (
                          <p className="text-sm text-muted-foreground">{ag.analysis.overallSummary}</p>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Clause cards */}
                  {ag.analysis.clauseResults.map((r) => (
                    <ClauseCard key={r.id} result={r} />
                  ))}
                </div>
              ) : (
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">
                    {ag.analysis?.status === "FAILED"
                      ? "Analysis failed for this file."
                      : "No analysis available."}
                  </p>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Chat (session exists) ── */}
      {sessionId && <ChatSection sessionId={sessionId} initialMessages={initialMessages} />}
    </main>
  )
}

// ─── Chat Section ─────────────────────────────────────────────────────────────

function ChatSection({ sessionId, initialMessages }: { sessionId: string; initialMessages: Message[] }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: `/api/chats/sessions/${sessionId}/chat`,
  })

  useEffect(() => {
    if (!initialized.current && initialMessages.length > 0) {
      setMessages(initialMessages)
      initialized.current = true
    }
  }, [initialMessages, setMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold border-b pb-2">Chat</h2>

      {/* Suggested starters */}
      {messages.length === 0 && (
        <div className="text-center space-y-3 py-4">
          <p className="text-sm text-muted-foreground">Ask a question about your lease to get started.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Is the no-pets clause enforceable?",
              "Can my landlord increase rent mid-lease?",
              "What are my rights regarding entry notice?",
            ].map((q) => (
              <button
                key={q}
                className="rounded-lg border bg-background px-3 py-2 text-xs hover:bg-muted transition-colors"
                onClick={() =>
                  handleInputChange({ target: { value: q } } as React.ChangeEvent<HTMLInputElement>)
                }
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
            )}
            <Card className={`max-w-[85%] ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>
              <CardContent className="px-3 py-2">
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
                <UserIcon className="size-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <Card className="bg-muted/50">
              <CardContent className="px-3 py-2">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about your lease..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={isLoading || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
