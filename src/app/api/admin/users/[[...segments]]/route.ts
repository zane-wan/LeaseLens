import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { hashPassword, validateStrongPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"
import { canAssignRole, canManageAccount, isAdminLike } from "@/lib/rbac"

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().trim().toLowerCase().optional(),
  role: z.enum(["OWNER", "ADMIN", "USER"]).optional(),
  password: z.string().min(1).optional(),
})

async function ownerCount() {
  return prisma.user.count({ where: { role: "OWNER" } })
}

async function listUsers(req: NextRequest) {
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
}

async function updateUser(req: NextRequest, id: string) {
  const actor = await requireAuthFromRequest(req)
  if (!isAdminLike(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
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

  const normalizedEmail = updates.email
  if (normalizedEmail) {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing && existing.id !== target.id) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 409 })
    }
  }

  if (updates.password) {
    const check = validateStrongPassword(updates.password, target.email.split("@")[0])
    if (!check.valid) {
      return NextResponse.json({ error: check.errors[0] }, { status: 400 })
    }
  }

  const nextPasswordHash = updates.password
    ? await hashPassword(updates.password)
    : undefined

  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      name: updates.name,
      email: normalizedEmail,
      role: updates.role,
      passwordHash: nextPasswordHash,
      emailVerified:
        normalizedEmail === undefined || normalizedEmail === target.email
          ? undefined
          : false,
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
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length > 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return await listUsers(req)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  try {
    const { segments = [] } = await params
    if (segments.length !== 1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return await updateUser(req, segments[0])
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
