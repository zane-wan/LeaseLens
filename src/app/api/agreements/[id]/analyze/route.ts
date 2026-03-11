import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthFromRequest(req)
    const { id } = await params

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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to queue analysis" }, { status: 500 })
  }
}
