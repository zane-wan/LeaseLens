import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { attachSessionCookie, createSession } from "@/lib/auth"
import { hashPassword } from "@/lib/password"

const schema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(80).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup payload" }, { status: 400 })
  }

  const { email, password, name } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Email is already registered" }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const userCount = await prisma.user.count()
  const role = userCount === 0 ? "OWNER" : "USER"

  const user = await prisma.user.create({
    data: {
      email,
      name: name ?? null,
      role,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  })

  const { token, expiresAt } = await createSession(user.id, req)
  const res = NextResponse.json({ user }, { status: 201 })
  attachSessionCookie(res, token, expiresAt)
  return res
}
