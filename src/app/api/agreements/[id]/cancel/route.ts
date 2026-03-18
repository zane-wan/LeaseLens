import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/agreements/:id/cancel
 *
 * Cancels an in-progress analysis by deleting the Analysis record and
 * resetting the agreement status back to PENDING.
 * The background pipeline will fail naturally when it can no longer find
 * the deleted Analysis record, leaving the agreement in PENDING state.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthFromRequest(req)
    const { id } = await params

    const agreement = await prisma.agreement.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true },
    })

    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 })
    }

    if (agreement.status !== "PROCESSING") {
      return NextResponse.json(
        { error: "Agreement is not currently being analyzed" },
        { status: 409 },
      )
    }

    // Delete the Analysis record (cascades to ClauseResults).
    // The running pipeline will hit a FK/not-found error and stop naturally.
    await prisma.analysis.deleteMany({ where: { agreementId: id } })

    await prisma.agreement.update({
      where: { id },
      data: { status: "PENDING" },
    })

    return NextResponse.json({ message: "Analysis cancelled" })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to cancel analysis" }, { status: 500 })
  }
}
