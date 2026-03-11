import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { attachSessionCookie, createSession } from "@/lib/auth"
import { verifyPassword } from "@/lib/password"

const schema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload" }, { status: 400 })
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
    },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const { token, expiresAt } = await createSession(user.id, req)
  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  })
  attachSessionCookie(res, token, expiresAt)
  return res
}
