import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { streamText } from "ai"
import { modelConfig, systemPrompts } from "@/config/llm"
import { retrieveContext } from "@/lib/rag"
import { deleteS3Object } from "@/lib/s3"

const sessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  agreementIds: z.array(z.string().min(1)).max(1).optional(),
})

const renameSessionSchema = z.object({
  title: z.string().trim().min(1).max(120),
})

const messageSchema = z.object({
  role: z.enum(["USER", "ASSISTANT", "SYSTEM"]),
  content: z.string().trim().min(1),
  citations: z.array(z.string()).optional(),
})

const chatSchema = z.object({
  message: z.string().trim().min(1),
})

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

async function listSessions(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  const sessions = await prisma.chatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      agreements: { select: { id: true, fileName: true, status: true } },
      createdAt: true,
      updatedAt: true,
    },
  })
  return NextResponse.json(sessions)
}

async function getLatestSession(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  const session = await prisma.chatSession.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      agreements: {
        include: {
          analysis: {
            include: {
              clauseResults: { orderBy: { clauseIndex: "asc" } },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          citations: true,
          createdAt: true,
        },
      },
    },
  })

  if (!session) {
    return NextResponse.json({ error: "No sessions found" }, { status: 404 })
  }

  return NextResponse.json(session)
}

async function getSessionById(req: NextRequest, sessionId: string) {
  const user = await requireAuthFromRequest(req)
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: {
      agreements: {
        include: {
          analysis: {
            include: {
              clauseResults: { orderBy: { clauseIndex: "asc" } },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          citations: true,
          createdAt: true,
        },
      },
    },
  })

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  return NextResponse.json(session)
}

async function createChatSession(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  const body = await req.json()
  const parsed = sessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  // Validate all agreement IDs belong to this user
  if (parsed.data.agreementIds && parsed.data.agreementIds.length > 0) {
    const agreements = await prisma.agreement.findMany({
      where: {
        id: { in: parsed.data.agreementIds },
        userId: user.id,
      },
      select: { id: true },
    })
    if (agreements.length !== parsed.data.agreementIds.length) {
      return NextResponse.json({ error: "One or more agreements not found" }, { status: 404 })
    }
  }

  const title = parsed.data.title?.trim() || "New Session"

  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      title,
      agreements: parsed.data.agreementIds?.length
        ? { connect: parsed.data.agreementIds.map((id) => ({ id })) }
        : undefined,
    },
    select: {
      id: true,
      title: true,
      agreements: { select: { id: true, fileName: true, status: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(session, { status: 201 })
}

async function deleteSession(req: NextRequest, sessionId: string) {
  const user = await requireAuthFromRequest(req)
  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
    select: {
      id: true,
      agreements: {
        select: {
          id: true,
          s3Key: true,
        },
      },
    },
  })

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  for (const agreement of session.agreements) {
    try {
      await deleteS3Object(agreement.s3Key)
    } catch (error) {
      console.error("Failed to delete session file from S3", error)
    }
  }

  await prisma.$transaction(async (tx) => {
    if (session.agreements.length > 0) {
      await tx.agreement.deleteMany({
        where: {
          id: {
            in: session.agreements.map((agreement) => agreement.id),
          },
          userId: user.id,
        },
      })
    }

    await tx.chatSession.delete({
      where: { id: session.id },
    })
  })

  return new NextResponse(null, { status: 204 })
}

async function renameSession(req: NextRequest, sessionId: string) {
  const user = await requireAuthFromRequest(req)
  const body = await req.json()
  const parsed = renameSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
    select: {
      id: true,
    },
  })

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const updated = await prisma.chatSession.update({
    where: { id: session.id },
    data: {
      title: parsed.data.title,
    },
    select: {
      id: true,
      title: true,
      agreements: { select: { id: true, fileName: true, status: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(updated)
}

// ---------------------------------------------------------------------------
// Messages CRUD
// ---------------------------------------------------------------------------

async function listMessages(req: NextRequest, sessionId: string) {
  const user = await requireAuthFromRequest(req)
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      citations: true,
      createdAt: true,
    },
  })

  return NextResponse.json(messages)
}

async function createMessage(req: NextRequest, sessionId: string) {
  const user = await requireAuthFromRequest(req)
  const body = await req.json()
  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      userId: user.id,
      role: parsed.data.role,
      content: parsed.data.content,
      citations: parsed.data.citations ?? [],
    },
    select: {
      id: true,
      role: true,
      content: true,
      citations: true,
      createdAt: true,
    },
  })

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  })

  return NextResponse.json(message, { status: 201 })
}

// ---------------------------------------------------------------------------
// Streaming chat — user sends a message, LLM responds with RAG context
// ---------------------------------------------------------------------------

async function streamChatResponse(req: NextRequest, sessionId: string) {
  const user = await requireAuthFromRequest(req)
  const body = await req.json()

  // Support both { message: "..." } and { messages: [...] } (useChat format)
  let userMessage: string
  if (Array.isArray(body.messages)) {
    const last = [...body.messages].reverse().find((m: { role: string }) => m.role === "user")
    userMessage = last?.content?.trim() ?? ""
  } else {
    userMessage = body.message?.trim() ?? ""
  }
  if (!userMessage) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  // Verify session ownership
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // Build context: analysis results + RAG + history
  const { analysisContext, ragContext, history } = await buildChatContext(
    sessionId,
    userMessage,
  )

  // Save user message
  await prisma.chatMessage.create({
    data: {
      sessionId,
      userId: user.id,
      role: "USER",
      content: userMessage,
      citations: [],
    },
  })

  // Build messages array for LLM
  const messages = [
    ...history.map((m) => ({
      role: m.role.toLowerCase() as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ]

  // Stream response with onFinish callback to persist the assistant message
  const result = streamText({
    model: modelConfig.model,
    temperature: 0.3,
    system: `${systemPrompts.chat}

## Lease Analysis Results
${analysisContext}

## Relevant Ontario Law (RTA)
${ragContext.join("\n\n")}`,
    messages,
    onFinish: async ({ text }) => {
      await prisma.chatMessage.create({
        data: {
          sessionId,
          userId: user.id,
          role: "ASSISTANT",
          content: text,
          citations: [],
        },
      })
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      })
    },
  })

  return result.toDataStreamResponse()
}

async function buildChatContext(sessionId: string, userMessage: string) {
  // 1. Load all agreements with analysis results
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      agreements: {
        include: {
          analysis: {
            include: { clauseResults: { orderBy: { clauseIndex: "asc" } } },
          },
        },
      },
    },
  })

  const agreements = session?.agreements ?? []

  // 2. Format analysis results
  const analysisContext = agreements
    .map((a) => {
      const clauses = a.analysis?.clauseResults ?? []
      if (clauses.length === 0) return `## ${a.fileName}\nNot yet analyzed.`
      const clauseBlock = clauses
        .map(
          (c) =>
            `- [${c.compliance}${c.severity ? ` / ${c.severity}` : ""}] "${c.clauseTitle}": ${c.explanation} (${c.rtaCitations.join(", ")})`,
        )
        .join("\n")
      return `## ${a.fileName}\nOverall: ${a.analysis?.overallSummary ?? "N/A"}\nRisk Score: ${a.analysis?.riskScore ?? "N/A"}/100\n\nClauses:\n${clauseBlock}`
    })
    .join("\n\n---\n\n")

  // 3. RAG retrieve for the user's question
  const ragContext = await retrieveContext(userMessage, { topK: 5 })

  // 4. Load conversation history (filter to USER/ASSISTANT only)
  const history = await prisma.chatMessage.findMany({
    where: {
      sessionId,
      role: { in: ["USER", "ASSISTANT"] },
    },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  })

  return { analysisContext, ragContext, history }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> },
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 0) {
      return await listSessions(req)
    }
    if (segments.length === 1 && segments[0] === "latest") {
      return await getLatestSession(req)
    }
    if (segments.length === 1) {
      return await getSessionById(req, segments[0])
    }
    if (segments.length === 2 && segments[1] === "messages") {
      return await listMessages(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> },
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 0) {
      return await createChatSession(req)
    }
    if (segments.length === 2 && segments[1] === "messages") {
      return await createMessage(req, segments[0])
    }
    if (segments.length === 2 && segments[1] === "chat") {
      return await streamChatResponse(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> },
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 1) {
      return await renameSession(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to rename session" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> },
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 1) {
      return await deleteSession(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 })
  }
}
