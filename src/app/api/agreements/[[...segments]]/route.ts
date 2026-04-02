import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  MAX_AGREEMENTS_PER_SESSION,
  getSessionAgreementLimitErrorMessage,
} from "@/lib/agreements"
import { deleteS3Object } from "@/lib/s3"
import {
  cleanupExpiredUploadIntents,
  getExpiredUploadIntentErrorMessage,
  UploadVerificationError,
  verifyUploadedObject,
} from "@/lib/uploads"

const createSchema = z.object({
  uploadIntentId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
})

async function listAgreements(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  const { searchParams } = new URL(req.url)
  const all = searchParams.get("all") === "true"

  const agreements = await prisma.agreement.findMany({
    where: {
      userId: user.id,
      ...(!all && { chatSessions: { none: {} } }),
    },
    orderBy: { uploadedAt: "desc" },
  })
  return NextResponse.json(agreements)
}

async function createAgreement(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  await cleanupExpiredUploadIntents()
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const intent = await prisma.uploadIntent.findFirst({
    where: {
      id: parsed.data.uploadIntentId,
      userId: user.id,
    },
    select: {
      id: true,
      agreementId: true,
      fileName: true,
      contentType: true,
      fileSize: true,
      s3Key: true,
      status: true,
      expiresAt: true,
    },
  })

  if (!intent) {
    return NextResponse.json({ error: "Upload intent not found" }, { status: 404 })
  }

  if (intent.status === "CONSUMED" && intent.agreementId) {
    const existing = await prisma.agreement.findFirst({
      where: {
        id: intent.agreementId,
        userId: user.id,
      },
    })

    if (existing) {
      return NextResponse.json(existing)
    }
  }

  if (intent.status !== "RESERVED" || intent.expiresAt < new Date()) {
    if (intent.status === "RESERVED" && intent.expiresAt < new Date()) {
      await prisma.uploadIntent.update({
        where: { id: intent.id },
        data: { status: "EXPIRED" },
      }).catch(() => null)
    }
    return NextResponse.json({ error: getExpiredUploadIntentErrorMessage() }, { status: 409 })
  }

  try {
    await verifyUploadedObject(intent)
  } catch (error) {
    if (!(error instanceof UploadVerificationError)) {
      throw error
    }

    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentIntent = await tx.uploadIntent.findFirst({
      where: {
        id: parsed.data.uploadIntentId,
        userId: user.id,
      },
      select: {
        id: true,
        agreementId: true,
        fileName: true,
        s3Key: true,
        status: true,
        expiresAt: true,
      },
    })

    if (!currentIntent) {
      throw new AuthError("Upload intent not found", 404)
    }

    if (currentIntent.status === "CONSUMED" && currentIntent.agreementId) {
      const existing = await tx.agreement.findFirst({
        where: {
          id: currentIntent.agreementId,
          userId: user.id,
        },
      })

      if (!existing) {
        throw new AuthError("Upload already finalized", 409)
      }

      return { agreement: existing, created: false }
    }

    if (currentIntent.status !== "RESERVED" || currentIntent.expiresAt < new Date()) {
      throw new AuthError(getExpiredUploadIntentErrorMessage(), 409)
    }

    if (parsed.data.sessionId) {
      const session = await tx.chatSession.findFirst({
        where: {
          id: parsed.data.sessionId,
          userId: user.id,
        },
        select: {
          id: true,
          title: true,
          _count: {
            select: {
              agreements: true,
            },
          },
        },
      })

      if (!session) {
        throw new AuthError("Session not found", 404)
      }

      if (session._count.agreements >= MAX_AGREEMENTS_PER_SESSION) {
        throw new AuthError(getSessionAgreementLimitErrorMessage(), 400)
      }
    }

    const created = await tx.agreement.create({
      data: {
        userId: user.id,
        fileName: currentIntent.fileName,
        s3Key: currentIntent.s3Key,
        chatSessions: parsed.data.sessionId
          ? {
              connect: [{ id: parsed.data.sessionId }],
            }
          : undefined,
      },
    })

    await tx.uploadIntent.update({
      where: { id: currentIntent.id },
      data: {
        status: "CONSUMED",
        consumedAt: new Date(),
        agreementId: created.id,
      },
    })

    if (parsed.data.sessionId) {
      const session = await tx.chatSession.findUnique({
        where: { id: parsed.data.sessionId },
        select: { title: true },
      })

      if (session && session.title.trim() === "New Session") {
        await tx.chatSession.update({
          where: { id: parsed.data.sessionId },
          data: {
            title: currentIntent.fileName,
          },
        })
      }
    }

    return { agreement: created, created: true }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })

  return NextResponse.json(result.agreement, { status: result.created ? 201 : 200 })
}

async function deleteAgreement(req: NextRequest, id: string) {
  const user = await requireAuthFromRequest(req)
  const agreement = await prisma.agreement.findUnique({
    where: { id },
    include: {
      chatSessions: {
        where: { userId: user.id },
        select: { id: true },
      },
    },
  })

  if (!agreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (agreement.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await deleteS3Object(agreement.s3Key)
  } catch (error) {
    console.error("Failed to delete agreement file from S3", error)
  }

  await prisma.$transaction(async (tx) => {
    await tx.agreement.delete({ where: { id } })

  })

  return new NextResponse(null, { status: 204 })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 0) {
      return await listAgreements(req)
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch agreements" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 0) {
      return await createAgreement(req)
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length === 1) {
      return await deleteAgreement(req, segments[0])
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to delete agreement" }, { status: 500 })
  }
}
