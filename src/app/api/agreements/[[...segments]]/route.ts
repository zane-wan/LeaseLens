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
