import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const createSchema = z.object({
  role: z.enum(["USER", "ASSISTANT", "SYSTEM"]),
  content: z.string().trim().min(1),
  citations: z.array(z.string()).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthFromRequest(req)
    const { id } = await params
    const session = await prisma.chatSession.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        sessionId: id,
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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthFromRequest(req)
    const { id } = await params
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const session = await prisma.chatSession.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const message = await prisma.chatMessage.create({
      data: {
        sessionId: id,
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
      where: { id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }
}
