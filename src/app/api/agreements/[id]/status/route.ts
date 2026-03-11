import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
  }
}
