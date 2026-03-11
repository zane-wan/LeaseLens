import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/password"

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().trim().toLowerCase().optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).optional(),
})

export async function GET(req: NextRequest) {
  const user = await requireAuthFromRequest(req)
  return NextResponse.json({ user })
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAuthFromRequest(req)
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const data = parsed.data
    if (!data.name && !data.email && !data.newPassword) {
      return NextResponse.json({ error: "No updates requested" }, { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        passwordHash: true,
      },
    })

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const requiresPasswordCheck = Boolean(data.email || data.newPassword)
    if (requiresPasswordCheck) {
      if (!data.currentPassword || !target.passwordHash) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 })
      }
      const valid = await verifyPassword(data.currentPassword, target.passwordHash)
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 })
      }
    }

    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } })
      if (existing && existing.id !== actor.id) {
        return NextResponse.json({ error: "Email is already in use" }, { status: 409 })
      }
    }

    const nextPasswordHash = data.newPassword ? await hashPassword(data.newPassword) : undefined
    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: {
        name: data.name,
        email: data.email,
        passwordHash: nextPasswordHash,
        emailVerified: data.email ? false : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
  }
}
