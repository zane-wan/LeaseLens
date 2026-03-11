import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthFromRequest(req)
    const { id } = await params

    const agreement = await prisma.agreement.findUnique({ where: { id } })

    if (!agreement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (agreement.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.agreement.delete({ where: { id } })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to delete agreement" }, { status: 500 })
  }
}
