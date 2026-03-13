import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const createSchema = z.object({
  fileName: z.string().min(1),
  s3Key: z.string().min(1),
})

async function listAgreements(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  const agreements = await prisma.agreement.findMany({
    where: { userId: user.id },
    orderBy: { uploadedAt: "desc" },
  })
  return NextResponse.json(agreements)
}

async function createAgreement(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const agreement = await prisma.agreement.create({
    data: {
      userId: user.id,
      fileName: parsed.data.fileName,
      s3Key: parsed.data.s3Key,
    },
  })

  return NextResponse.json(agreement, { status: 201 })
}

async function deleteAgreement(req: NextRequest, id: string) {
  const user = await requireAuthFromRequest(req)
  const agreement = await prisma.agreement.findUnique({ where: { id } })

  if (!agreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (agreement.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.agreement.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

async function getAgreementStatus(req: NextRequest, id: string) {
  const user = await requireAuthFromRequest(req)
  const agreement = await prisma.agreement.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      analysis: {
        select: {
          id: true,
          status: true,
          errorMessage: true,
          startedAt: true,
          completedAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!agreement) {
    return NextResponse.json({ error: "Agreement not found" }, { status: 404 })
  }

  return NextResponse.json({
    agreementId: agreement.id,
    agreementStatus: agreement.status,
    analysis: agreement.analysis,
  })
}

async function queueAgreementAnalysis(req: NextRequest, id: string) {
  const user = await requireAuthFromRequest(req)
  const agreement = await prisma.agreement.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
    },
  })
  if (!agreement) {
    return NextResponse.json({ error: "Agreement not found" }, { status: 404 })
  }

  const analysis = await prisma.analysis.upsert({
    where: { agreementId: agreement.id },
    create: {
      agreementId: agreement.id,
      status: "QUEUED",
    },
    update: {
      status: "QUEUED",
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    },
    select: {
      id: true,
      agreementId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  await prisma.agreement.update({
    where: { id: agreement.id },
    data: {
      status: "PROCESSING",
    },
  })

  return NextResponse.json(
    {
      analysis,
      message: "Analysis queued. Full pipeline integration is pending.",
    },
    { status: 202 }
  )
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
    if (segments.length === 2 && segments[1] === "status") {
      return await getAgreementStatus(req, segments[0])
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
    if (segments.length === 2 && segments[1] === "analyze") {
      return await queueAgreementAnalysis(req, segments[0])
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
