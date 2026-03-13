import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  AuthServiceError,
  confirmPasswordReset,
  normalizeEmail,
  sendPasswordResetCode,
  startPasswordReset,
} from "@/lib/auth-service"
import { consumeRateLimit, getClientIdentifier } from "@/lib/rate-limit"

const startSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
})

const sendCodeSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
})

const confirmSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  code: z.string().trim().min(4).max(12),
  newPassword: z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params

  if (action === "start") {
    try {
      const body = await req.json()
      const parsed = startSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
      }

      const email = normalizeEmail(parsed.data.email)
      const clientId = getClientIdentifier(req.headers)
      const limit = consumeRateLimit(
        `password-reset-start:${clientId}:${email}`,
        8,
        15 * 60 * 1000
      )
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "Too many reset attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
        )
      }

      const result = await startPasswordReset(email)
      return NextResponse.json(result)
    } catch (err) {
      if (err instanceof AuthServiceError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      return NextResponse.json({ error: "Failed to start password reset" }, { status: 500 })
    }
  }

  if (action === "send-code") {
    try {
      const body = await req.json()
      const parsed = sendCodeSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
      }

      const email = normalizeEmail(parsed.data.email)
      const clientId = getClientIdentifier(req.headers)
      const limit = consumeRateLimit(
        `password-reset-send:${clientId}:${email}`,
        5,
        15 * 60 * 1000
      )
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "Too many verification code requests. Please try again later." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
        )
      }

      const result = await sendPasswordResetCode(email)
      return NextResponse.json(result)
    } catch (err) {
      if (err instanceof AuthServiceError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 })
    }
  }

  if (action === "confirm") {
    try {
      const body = await req.json()
      const parsed = confirmSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
      }

      const email = normalizeEmail(parsed.data.email)
      const clientId = getClientIdentifier(req.headers)
      const limit = consumeRateLimit(
        `password-reset-confirm:${clientId}:${email}`,
        10,
        15 * 60 * 1000
      )
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "Too many password reset confirmation attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
        )
      }

      const result = await confirmPasswordReset(
        email,
        parsed.data.code,
        parsed.data.newPassword
      )
      return NextResponse.json(result)
    } catch (err) {
      if (err instanceof AuthServiceError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      return NextResponse.json({ error: "Failed to confirm password reset" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
