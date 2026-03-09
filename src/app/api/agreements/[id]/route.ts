import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = "dev-user"

  const agreement = await prisma.agreement.findUnique({ where: { id } })

  if (!agreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (agreement.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.agreement.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
