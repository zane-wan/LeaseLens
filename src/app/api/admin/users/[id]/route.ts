import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { hashPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"
import { canAssignRole, canManageAccount, isAdminLike } from "@/lib/rbac"

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().trim().toLowerCase().optional(),
  role: z.enum(["OWNER", "ADMIN", "USER"]).optional(),
  password: z.string().min(8).optional(),
})

async function ownerCount() {
  return prisma.user.count({ where: { role: "OWNER" } })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuthFromRequest(req)
    if (!isAdminLike(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
      },
    })
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!canManageAccount(actor.role, actor.id, target.role, target.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updates = parsed.data
    if (updates.role && !canAssignRole(actor.role, updates.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden role assignment" }, { status: 403 })
    }

    if (target.role === "OWNER" && updates.role && updates.role !== "OWNER") {
      const count = await ownerCount()
      if (count <= 1) {
        return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 })
      }
    }

    if (updates.email) {
      const existing = await prisma.user.findUnique({ where: { email: updates.email } })
      if (existing && existing.id !== target.id) {
        return NextResponse.json({ error: "Email is already in use" }, { status: 409 })
      }
    }

    const nextPasswordHash = updates.password
      ? await hashPassword(updates.password)
      : undefined

    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        name: updates.name,
        email: updates.email,
        role: updates.role,
        passwordHash: nextPasswordHash,
        emailVerified: updates.email ? false : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
      },
    })

    return NextResponse.json({ user })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
