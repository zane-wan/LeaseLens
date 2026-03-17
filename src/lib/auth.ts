import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { jwtVerify, SignJWT } from "jose"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const SESSION_COOKIE_NAME = "token"
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
}

type TokenPayload = {
  userId: string
  email: string
}

export class AuthError extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET ?? process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET or BETTER_AUTH_SECRET environment variable must be set")
  }
  return new TextEncoder().encode(secret)
}

function makeSessionExpiry() {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
}

async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret())
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}

export async function createSession(userId: string, _req?: NextRequest) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })

  if (!user) {
    throw new AuthError("User not found", 404)
  }

  const token = await signToken({ userId: user.id, email: user.email })
  const expiresAt = makeSessionExpiry()

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
    maxAge: SESSION_TTL_SECONDS,
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
  const payload = await verifyToken(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  })

  if (!user) return null

  return user
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

export async function destroySessionByRequest(_req: NextRequest) {
  // JWT cookie is stateless; clearing cookie on response is sufficient.
}
