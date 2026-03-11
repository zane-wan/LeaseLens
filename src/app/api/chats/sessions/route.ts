import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  agreementId: z.string().min(1).optional(),
})

export async function GET(req: NextRequest) {
  try {
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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthFromRequest(req)
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
