"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useChat, type Message } from "ai/react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DropZone } from "@/features/upload/components/DropZone"
import { AgreementList } from "@/features/upload/components/AgreementList"
import { useUpload } from "@/features/upload/hooks/useUpload"
import { AgreementItem } from "@/features/upload/types"
import { ClauseCard, type ClauseResultData } from "@/features/analysis/components/ClauseCard"
import { RiskScoreRing } from "@/features/analysis/components/RiskScoreRing"
import {
  Bot,
  ChevronDown,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  Plus,
  Send,
  Trash2,
  User as UserIcon,
} from "lucide-react"

interface SessionAnalysis {
  status: string
  overallSummary: string | null
  riskScore: number | null
  clauseResults: ClauseResultData[]
}

interface SessionAgreement extends AgreementItem {
  analysis: SessionAnalysis | null
}

interface SessionMessage {
  id: string
  role: "USER" | "ASSISTANT" | "SYSTEM"
  content: string
  createdAt: string
}

interface SessionListItem {
  id: string
  title: string
  agreements: { id: string; fileName: string; status: string }[]
  createdAt: string
  updatedAt: string
}

interface SessionDetail {
  id: string
  title: string
  agreements: SessionAgreement[]
  messages: SessionMessage[]
  createdAt: string
  updatedAt: string
}

function toChatMessages(messages: SessionMessage[]): Message[] {
  return messages
    .filter((message) => message.role !== "SYSTEM")
    .map((message) => ({
      id: message.id,
      role: message.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: message.content,
      createdAt: new Date(message.createdAt),
    }))
}

export default function DashboardPage() {
  const { uploadState, upload, reset } = useUpload()
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<SessionDetail | null>(null)
  const [initialMessages, setInitialMessages] = useState<Message[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingSession, setLoadingSession] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)

  const activeAgreement = activeSession?.agreements[0] ?? null

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/chats/sessions")
    if (!res.ok) {
      throw new Error("Failed to load sessions")
    }
    const json = (await res.json()) as SessionListItem[]
    setSessions(json)
    return json
  }, [])

  const loadSession = useCallback(async (sessionId: string) => {
    setLoadingSession(true)
    const res = await fetch(`/api/chats/sessions/${sessionId}`)
    if (!res.ok) {
      setLoadingSession(false)
      throw new Error("Failed to load session")
    }

    const session = (await res.json()) as SessionDetail
    setActiveSessionId(session.id)
    setActiveSession(session)
    setInitialMessages(toChatMessages(session.messages))
    setLoadingSession(false)
    return session
  }, [])

  const syncSessions = useCallback(
    async (preferredSessionId?: string | null) => {
      const list = await fetchSessions()
      const nextSessionId =
        preferredSessionId && list.some((session) => session.id === preferredSessionId)
          ? preferredSessionId
          : list[0]?.id ?? null

      if (!nextSessionId) {
        setActiveSessionId(null)
        setActiveSession(null)
        setInitialMessages([])
        return
      }

      await loadSession(nextSessionId)
    },
    [fetchSessions, loadSession]
  )

  useEffect(() => {
    async function init() {
      try {
        await syncSessions()
      } catch {
        setPageError("Failed to load sessions")
      } finally {
        setInitialLoading(false)
      }
    }

    init()
  }, [syncSessions])

  useEffect(() => {
    if (!activeSessionId || activeAgreement?.status !== "PROCESSING") return

    const timer = setInterval(() => {
      void Promise.all([fetchSessions(), loadSession(activeSessionId)]).catch(() => null)
    }, 3000)

    return () => clearInterval(timer)
  }, [activeAgreement?.status, activeSessionId, fetchSessions, loadSession])

  async function handleCreateSession() {
    setCreatingSession(true)
    setPageError(null)

    try {
      const res = await fetch("/api/chats/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Session" }),
      })
      if (!res.ok) {
        throw new Error("Failed to create session")
      }

      const session = (await res.json()) as SessionListItem
      reset()
      await syncSessions(session.id)
    } catch {
      setPageError("Failed to create session")
    } finally {
      setCreatingSession(false)
    }
  }

  async function handleSelectSession(sessionId: string) {
    setPageError(null)

    try {
      await loadSession(sessionId)
    } catch {
      setPageError("Failed to load session")
    }
  }

  async function handleDeleteSession(sessionId: string) {
    const confirmed = window.confirm("Delete this session and its uploaded file?")
    if (!confirmed) return

    setBusySessionId(sessionId)
    setPageError(null)

    try {
      const res = await fetch(`/api/chats/sessions/${sessionId}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? "Failed to delete session")
      }

      const nextPreferred = activeSessionId === sessionId ? null : activeSessionId
      reset()
      await syncSessions(nextPreferred)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to delete session")
    } finally {
      setBusySessionId(null)
    }
  }

  async function handleFilesDrop(files: File[]) {
    if (!activeSessionId) {
      setPageError("Create or select a session first")
      return
    }
    if (files.length !== 1) {
      setPageError("Each session can only contain one PDF file")
      return
    }
    if (activeAgreement) {
      setPageError("This session already has a file. Create a new session to upload another lease.")
      return
    }

    setPageError(null)

    try {
      const result = await upload(files[0], activeSessionId)
      if (!result) return
      reset()
      await syncSessions(activeSessionId)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Upload failed")
    }
  }

  async function handleAnalyze(id: string) {
    const res = await fetch(`/api/agreements/${id}/analyze`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      setPageError(err?.error ?? "Failed to start analysis")
      return
    }
    if (activeSessionId) {
      await syncSessions(activeSessionId)
    }
  }

  async function handleCancel(id: string) {
    const res = await fetch(`/api/agreements/${id}/cancel`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      setPageError(err?.error ?? "Failed to cancel")
      return
    }
    if (activeSessionId) {
      await syncSessions(activeSessionId)
    }
  }

  async function handleDeleteAgreement(id: string) {
    const res = await fetch(`/api/agreements/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      setPageError(err?.error ?? "Failed to delete file")
      return
    }
    reset()
    if (activeSessionId) {
      await syncSessions(activeSessionId)
    }
  }

  if (initialLoading) {
    return (
      <main className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lease Sessions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One session can hold zero or one lease file.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-8 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <History className="size-4" />
              Past Sessions
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 min-w-80">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Session Manager</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuItem
                onClick={handleCreateSession}
                disabled={creatingSession}
                className="gap-2"
              >
                {creatingSession ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                New Session
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {sessions.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  No sessions yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {sessions.map((session) => {
                    const sessionAgreement = session.agreements[0]
                    const isActive = session.id === activeSessionId

                    return (
                      <div
                        key={session.id}
                        className={`flex items-center gap-2 rounded-md px-2 py-2 ${
                          isActive ? "bg-muted" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectSession(session.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-medium">{session.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {sessionAgreement ? sessionAgreement.fileName : "No file uploaded"}
                          </p>
                        </button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          disabled={busySessionId === session.id}
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          {busySessionId === session.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3" />
                          )}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            className="gap-1"
            onClick={handleCreateSession}
            disabled={creatingSession}
          >
            {creatingSession ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            New Session
          </Button>
        </div>
      </div>

      <section className="space-y-6">
        {pageError ? <p className="text-sm text-destructive">{pageError}</p> : null}

        {!activeSessionId ? (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <MessageSquarePlus className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Create a session to begin</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Each session behaves like an individual lease workspace and can hold zero or one file.
            </p>
            <Button type="button" className="mt-4 gap-2" onClick={handleCreateSession} disabled={creatingSession}>
              <Plus className="size-4" />
              New Session
            </Button>
          </div>
        ) : loadingSession ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{activeSession?.title ?? "New Session"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeAgreement
                      ? `Current file: ${activeAgreement.fileName}`
                      : "This session is empty. Upload one PDF to attach it to this session."}
                  </p>
                </div>
                {activeSession ? (
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(activeSession.updatedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            </div>

            {!activeAgreement ? (
              <div className="space-y-4 rounded-2xl border bg-card p-6">
                <div>
                  <h3 className="text-lg font-semibold">Upload Lease</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This workspace accepts one PDF. Create another session for another lease.
                  </p>
                </div>
                <DropZone
                  uploadState={uploadState}
                  onFilesDrop={handleFilesDrop}
                  onReset={reset}
                  multiple={false}
                  maxFiles={1}
                />
              </div>
            ) : (
              <>
                <div className="rounded-2xl border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Lease File</h3>
                  </div>
                  <AgreementList
                    agreements={[activeAgreement]}
                    onAnalyze={handleAnalyze}
                    onCancel={handleCancel}
                    onDelete={handleDeleteAgreement}
                  />
                </div>

                <AnalysisSection agreement={activeAgreement} />

                <ChatSection
                  key={activeSessionId}
                  sessionId={activeSessionId}
                  initialMessages={initialMessages}
                />
              </>
            )}
          </>
        )}
      </section>
    </main>
  )
}

function AnalysisSection({ agreement }: { agreement: SessionAgreement }) {
  if (agreement.analysis?.status === "COMPLETED") {
    return (
      <div className="space-y-6">
        <h2 className="border-b pb-2 text-lg font-semibold">Analysis Results</h2>

        <Card className="p-4">
          <div className="flex items-center gap-6">
            <RiskScoreRing score={agreement.analysis.riskScore ?? 0} size={80} />
            <div className="flex-1 space-y-2">
              <div className="flex gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-green-500">
                    {agreement.analysis.clauseResults.filter((item) => item.compliance === "COMPLIANT").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Compliant</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-500">
                    {agreement.analysis.clauseResults.filter((item) => item.compliance === "NEEDS_REVIEW").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Review</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-500">
                    {agreement.analysis.clauseResults.filter((item) => item.compliance === "NON_COMPLIANT").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Non-compliant</p>
                </div>
              </div>
              {agreement.analysis.overallSummary ? (
                <p className="text-sm text-muted-foreground">{agreement.analysis.overallSummary}</p>
              ) : null}
            </div>
          </div>
        </Card>

        {agreement.analysis.clauseResults.map((result) => (
          <ClauseCard key={result.id} result={result} />
        ))}
      </div>
    )
  }

  if (agreement.status === "PROCESSING" || agreement.analysis?.status === "PROCESSING") {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <p className="text-sm">Analysis is running for this session.</p>
        </div>
      </Card>
    )
  }

  if (agreement.status === "PENDING" || agreement.analysis?.status === "QUEUED") {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          The file is uploaded but not analyzed yet. Use the file menu above to start analysis.
        </p>
      </Card>
    )
  }

  if (agreement.status === "FAILED" || agreement.analysis?.status === "FAILED") {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Analysis failed for this lease. Retry analysis from the file menu.
        </p>
      </Card>
    )
  }

  return null
}

function ChatSection({ sessionId, initialMessages }: { sessionId: string; initialMessages: Message[] }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: `/api/chats/sessions/${sessionId}/chat`,
  })

  useEffect(() => {
    if (!initialized.current) {
      setMessages(initialMessages)
      initialized.current = true
    }
  }, [initialMessages, setMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="space-y-4">
      <h2 className="border-b pb-2 text-lg font-semibold">Chat</h2>

      {messages.length === 0 ? (
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">Ask a question about this lease to get started.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Is the no-pets clause enforceable?",
              "Can my landlord increase rent mid-lease?",
              "What are my rights regarding entry notice?",
            ].map((question) => (
              <button
                key={question}
                className="rounded-lg border bg-background px-3 py-2 text-xs transition-colors hover:bg-muted"
                onClick={() =>
                  handleInputChange({
                    target: { value: question },
                  } as React.ChangeEvent<HTMLInputElement>)
                }
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" ? (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
            ) : null}

            <Card
              className={`max-w-[85%] py-0 ${
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50"
              }`}
            >
              <CardContent className="px-3 py-1.5">
                {message.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </CardContent>
            </Card>

            {message.role === "user" ? (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserIcon className="size-4 text-muted-foreground" />
              </div>
            ) : null}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" ? (
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
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about this lease..."
          className="h-11"
        />
        <Button type="submit" size="lg" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  )
}
