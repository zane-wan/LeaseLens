import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminLike } from "@/lib/rbac"

const createSchema = z.object({
  subject: z.string().trim().min(3).max(180),
  body: z.string().trim().min(1),
})

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAuthFromRequest(req)
    const where = isAdminLike(actor.role) ? {} : { ownerUserId: actor.id }

    const threads = await prisma.supportThread.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        ownerUserId: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(threads)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch support threads" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuthFromRequest(req)
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supportInbox = process.env.SUPPORT_INBOX_EMAIL ?? "support@leaselens.local"
    const thread = await prisma.supportThread.create({
      data: {
        ownerUserId: actor.id,
        subject: parsed.data.subject,
        messages: {
          create: {
            senderUserId: actor.id,
            senderRole: actor.role,
            direction: "INBOUND",
            recipientEmail: supportInbox,
            subject: parsed.data.subject,
            body: parsed.data.body,
          },
        },
      },
      select: {
        id: true,
        ownerUserId: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(thread, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to create support thread" }, { status: 500 })
  }
}
