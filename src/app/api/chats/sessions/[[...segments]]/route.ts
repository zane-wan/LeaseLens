import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const sessionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  agreementId: z.string().min(1).optional(),
})

const messageSchema = z.object({
  role: z.enum(["USER", "ASSISTANT", "SYSTEM"]),
  content: z.string().trim().min(1),
  citations: z.array(z.string()).optional(),
})

async function listSessions(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  const sessions = await prisma.chatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      agreementId: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return NextResponse.json(sessions)
}

async function createSession(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  const body = await req.json()
  const parsed = sessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  if (parsed.data.agreementId) {
    const agreement = await prisma.agreement.findFirst({
      where: {
        id: parsed.data.agreementId,
        userId: user.id,
      },
      select: { id: true },
    })
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 })
    }
  }

  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      agreementId: parsed.data.agreementId ?? null,
    },
    select: {
      id: true,
      title: true,
      agreementId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(session, { status: 201 })
}

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
    where: {
      sessionId,
      userId: user.id,
    },
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 0) {
      return await listSessions(req)
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
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 0) {
      return await createSession(req)
    }
    if (segments.length === 2 && segments[1] === "messages") {
      return await createMessage(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
