import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/agreements/:id/status
 *
 * Returns the current analysis status and results for an agreement.
 * Used by the frontend to poll for completion after triggering analysis.
 */
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
          include: {
            clauseResults: {
              orderBy: { clauseIndex: "asc" },
            },
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
      analysis: agreement.analysis
        ? {
            id: agreement.analysis.id,
            status: agreement.analysis.status,
            overallSummary: agreement.analysis.overallSummary,
            riskScore: agreement.analysis.riskScore,
            errorMessage: agreement.analysis.errorMessage,
            startedAt: agreement.analysis.startedAt,
            completedAt: agreement.analysis.completedAt,
            clauseResults: agreement.analysis.clauseResults,
          }
        : null,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch agreement status" }, { status: 500 })
  }
}
