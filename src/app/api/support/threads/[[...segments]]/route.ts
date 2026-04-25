import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { isAdminLike } from "@/lib/rbac"

const threadSchema = z.object({
  subject: z.string().trim().min(3).max(180),
  body: z.string().trim().min(1),
})

const messageSchema = z.object({
  body: z.string().trim().min(1),
  subject: z.string().trim().min(1).max(180).optional(),
})

const statusSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]),
})

async function listThreads(req: NextRequest) {
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
}

async function createThread(req: NextRequest) {
  const actor = await requireAuthFromRequest(req)
  const body = await req.json()
  const parsed = threadSchema.safeParse(body)
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    return NextResponse.json({ error: `Invalid payload: ${errorMsg}` }, { status: 400 })
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

  const submitter = actor.name?.trim() ? `${actor.name} <${actor.email}>` : actor.email
  try {
    await sendEmail({
      to: supportInbox,
      subject: `New support request: ${parsed.data.subject}`,
      text: [
        `A new support thread was created in LeaseLens.`,
        ``,
        `From: ${submitter}`,
        `Role: ${actor.role}`,
        `Thread ID: ${thread.id}`,
        `Subject: ${parsed.data.subject}`,
        ``,
        parsed.data.body,
      ].join("\n"),
      replyTo: actor.email,
    })
  } catch (error) {
    console.error("Failed to notify support inbox about new thread", error)
  }

  return NextResponse.json(thread, { status: 201 })
}

async function listThreadMessages(req: NextRequest, threadId: string) {
  const actor = await requireAuthFromRequest(req)
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
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
    where: { threadId },
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
}

async function createThreadMessage(req: NextRequest, threadId: string) {
  const actor = await requireAuthFromRequest(req)
  const body = await req.json()
  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    return NextResponse.json({ error: `Invalid payload: ${errorMsg}` }, { status: 400 })
  }

  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
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
  const supportInbox = process.env.SUPPORT_INBOX_EMAIL?.trim() || "support@leaselens.local"
  const recipientEmail = isStaff
    ? (thread.owner.email as string)
    : supportInbox
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

  if (!isStaff) {
    const submitter = actor.name?.trim() ? `${actor.name} <${actor.email}>` : actor.email

    try {
      await sendEmail({
        to: recipientEmail,
        subject,
        text: [
          `LeaseLens support message from ${submitter}`,
          ``,
          `Thread ID: ${thread.id}`,
          `Subject: ${subject}`,
          ``,
          parsed.data.body,
        ].join("\n"),
        replyTo: actor.email,
      })
    } catch (error) {
      console.error("Failed to deliver support email notification", error)
    }
  }

  return NextResponse.json(message, { status: 201 })
}

async function updateThreadStatus(req: NextRequest, threadId: string) {
  const actor = await requireAuthFromRequest(req)
  const body = await req.json()
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      ownerUserId: true,
    },
  })

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }
  if (thread.ownerUserId !== actor.id) {
    return NextResponse.json(
      { error: "Only the thread owner can change the resolution status" },
      { status: 403 }
    )
  }

  const updated = await prisma.supportThread.update({
    where: { id: thread.id },
    data: {
      status: parsed.data.status,
    },
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

  return NextResponse.json(updated)
}

async function deleteThread(req: NextRequest, threadId: string) {
  const actor = await requireAuthFromRequest(req)
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      ownerUserId: true,
    },
  })

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }

  const canDelete = thread.ownerUserId === actor.id || isAdminLike(actor.role)
  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.supportThread.delete({
    where: { id: thread.id },
  })

  return NextResponse.json({ ok: true })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 0) {
      return await listThreads(req)
    }
    if (segments.length === 2 && segments[1] === "messages") {
      return await listThreadMessages(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch support data" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 0) {
      return await createThread(req)
    }
    if (segments.length === 2 && segments[1] === "messages") {
      return await createThreadMessage(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to process support request" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 1) {
      return await updateThreadStatus(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to update support thread" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 1) {
      return await deleteThread(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to delete support thread" }, { status: 500 })
  }
}
