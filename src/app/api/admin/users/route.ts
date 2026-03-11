import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminLike } from "@/lib/rbac"

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAuthFromRequest(req)
    if (!isAdminLike(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    })

    return NextResponse.json(users)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 })
  }
}
