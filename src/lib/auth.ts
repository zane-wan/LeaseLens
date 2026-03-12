import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const SESSION_COOKIE_NAME = "leaselens_session"
const SESSION_TTL_DAYS = 30

export interface AuthUser {
  id: string
  username: string
  email: string | null
  name: string | null
  role: UserRole
}

export class AuthError extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

function toAuthUser(user: {
  id: string
  username: string
  email: string | null
  name: string | null
  role: UserRole
}): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

function makeSessionExpiry() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
}

export async function createSession(userId: string, req?: NextRequest) {
  const token = randomBytes(32).toString("hex")
  const expiresAt = makeSessionExpiry()

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress: req?.headers.get("x-forwarded-for") ?? null,
      userAgent: req?.headers.get("user-agent") ?? null,
    },
  })

  return { token, expiresAt }
}

export function attachSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  })
}

async function getAuthUserByToken(token: string): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  })

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } })
    return null
  }

  return toAuthUser(session.user)
}

export async function getAuthUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return getAuthUserByToken(token)
}

export async function getAuthUserFromServer(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return getAuthUserByToken(token)
}

export async function requireAuthFromRequest(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthUserFromRequest(req)
  if (!user) {
    throw new AuthError("Unauthorized", 401)
  }
  return user
}

export async function destroySessionByRequest(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return
  await prisma.session.deleteMany({ where: { token } })
}
