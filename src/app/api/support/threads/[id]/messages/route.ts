import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { isAdminLike } from "@/lib/rbac"

const createSchema = z.object({
  body: z.string().trim().min(1),
  subject: z.string().trim().min(1).max(180).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuthFromRequest(req)
    const { id } = await params
    const thread = await prisma.supportThread.findUnique({
      where: { id },
      select: {
        ownerUserId: true,
      },
    })

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }
    if (!isAdminLike(actor.role) && thread.ownerUserId !== actor.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const messages = await prisma.supportMessage.findMany({
      where: { threadId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        senderUserId: true,
        senderRole: true,
        direction: true,
        recipientEmail: true,
        subject: true,
        body: true,
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
    const actor = await requireAuthFromRequest(req)
    const { id } = await params
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const thread = await prisma.supportThread.findUnique({
      where: { id },
      select: {
        id: true,
        ownerUserId: true,
        subject: true,
        owner: {
          select: { email: true },
        },
      },
    })

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }
    if (!isAdminLike(actor.role) && thread.ownerUserId !== actor.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const isStaff = isAdminLike(actor.role)
    const recipientEmail = isStaff
      ? thread.owner.email
      : (process.env.SUPPORT_INBOX_EMAIL ?? "support@leaselens.local")
    const subject = parsed.data.subject ?? (isStaff ? `Re: ${thread.subject}` : thread.subject)

    const message = await prisma.supportMessage.create({
      data: {
        threadId: thread.id,
        senderUserId: actor.id,
        senderRole: actor.role,
        direction: isStaff ? "OUTBOUND" : "INBOUND",
        recipientEmail,
        subject,
        body: parsed.data.body,
      },
      select: {
        id: true,
        senderUserId: true,
        senderRole: true,
        direction: true,
        recipientEmail: true,
        subject: true,
        body: true,
        createdAt: true,
      },
    })

    await sendEmail({
      to: recipientEmail,
      subject,
      text: parsed.data.body,
    })

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
