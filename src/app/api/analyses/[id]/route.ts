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

    const analysis = await prisma.analysis.findFirst({
      where: {
        id,
        agreement: {
          userId: user.id,
        },
      },
      include: {
        agreement: {
          select: {
            id: true,
            fileName: true,
            status: true,
            uploadedAt: true,
          },
        },
        clauseResults: {
          orderBy: {
            clauseIndex: "asc",
          },
        },
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
    }

    return NextResponse.json(analysis)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch analysis" }, { status: 500 })
  }
}
