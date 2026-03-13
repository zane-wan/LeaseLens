import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  AuthError,
  attachSessionCookie,
  clearSessionCookie,
  destroySessionByRequest,
  getAuthUserFromRequest,
  requireAuthFromRequest,
} from "@/lib/auth"
import {
  AuthServiceError,
  deleteOwnAccount,
  loginWithPassword,
  normalizeEmail,
  signupWithPassword,
  updateOwnAccount,
} from "@/lib/auth-service"
import { consumeRateLimit, getClientIdentifier } from "@/lib/rate-limit"

const signupSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
})

const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
})

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().trim().toLowerCase().optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(1).optional(),
})

const deleteSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  confirmation: z.literal("DELETE"),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await params
    if (action === "me") {
      const user = await getAuthUserFromRequest(req)
      return NextResponse.json({ user })
    }
    if (action === "account") {
      const user = await requireAuthFromRequest(req)
      return NextResponse.json({ user })
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch auth data" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params

  if (action === "logout") {
    await destroySessionByRequest(req)
    const res = NextResponse.json({ ok: true })
    clearSessionCookie(res)
    return res
  }

  if (action === "signup") {
    try {
      const body = await req.json()
      const parsed = signupSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid signup payload" }, { status: 400 })
      }

      const normalizedEmail = normalizeEmail(parsed.data.email)
      const clientId = getClientIdentifier(req.headers)
      const limit = consumeRateLimit(
        `signup:${clientId}:${normalizedEmail}`,
        5,
        15 * 60 * 1000
      )
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "Too many signup attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
        )
      }

      const { user, session } = await signupWithPassword(parsed.data, req)
      const res = NextResponse.json({ user }, { status: 201 })
      attachSessionCookie(res, session.token, session.expiresAt)
      return res
    } catch (err) {
      if (err instanceof AuthServiceError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      return NextResponse.json({ error: "Signup failed" }, { status: 500 })
    }
  }

  if (action === "login") {
    try {
      const body = await req.json()
      const parsed = loginSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid login payload" }, { status: 400 })
      }

      const normalizedEmail = normalizeEmail(parsed.data.email)
      const clientId = getClientIdentifier(req.headers)
      const limit = consumeRateLimit(
        `login:${clientId}:${normalizedEmail}`,
        10,
        10 * 60 * 1000
      )
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "Too many login attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
        )
      }

      const { user, session } = await loginWithPassword(parsed.data, req)
      const res = NextResponse.json({ user })
      attachSessionCookie(res, session.token, session.expiresAt)
      return res
    } catch (err) {
      if (err instanceof AuthServiceError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      return NextResponse.json({ error: "Login failed" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params
  if (action !== "account") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const actor = await requireAuthFromRequest(req)
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const data = parsed.data
    if (!data.name && data.email === undefined && !data.newPassword) {
      return NextResponse.json({ error: "No updates requested" }, { status: 400 })
    }

    const clientId = getClientIdentifier(req.headers)
    const limit = consumeRateLimit(
      `account-update:${clientId}:${actor.id}`,
      20,
      10 * 60 * 1000
    )
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many account update requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      )
    }

    const updated = await updateOwnAccount(actor.id, {
      name: data.name,
      email: data.email,
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    })
    return NextResponse.json({ user: updated })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof AuthServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params
  if (action !== "account") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const actor = await requireAuthFromRequest(req)
    const body = await req.json()
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid delete request" }, { status: 400 })
    }

    const clientId = getClientIdentifier(req.headers)
    const limit = consumeRateLimit(
      `account-delete:${clientId}:${actor.id}`,
      5,
      15 * 60 * 1000
    )
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many delete requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      )
    }

    await deleteOwnAccount(actor.id, parsed.data.currentPassword)
    const res = NextResponse.json({ ok: true })
    clearSessionCookie(res)
    return res
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof AuthServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
