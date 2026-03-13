import { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { createSession } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { hashPassword, generateVerificationCode, validateStrongPassword, verifyPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"

export class AuthServiceError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type PublicUser = {
  id: string
  email: string
  name: string | null
  role: UserRole
}

type SignupInput = {
  email: string
  password: string
  name?: string
}

type LoginInput = {
  email: string
  password: string
}

type AccountUpdateInput = {
  name?: string
  email?: string
  currentPassword?: string
  newPassword?: string
}

const PASSWORD_RESET_EXPIRY_MINUTES = 15
const PASSWORD_RESET_MAX_ATTEMPTS = 5

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  const prefix = local.slice(0, 3)
  return `${prefix}***@${domain}`
}

function passwordIdentityFromEmail(email: string): string {
  return normalizeEmail(email).split("@")[0] ?? ""
}

async function ensureUniqueEmail(email: string, exceptUserId?: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && existing.id !== exceptUserId) {
    throw new AuthServiceError("Email is already in use", 409)
  }
}

function validatePasswordOrThrow(password: string, email: string) {
  const check = validateStrongPassword(password, passwordIdentityFromEmail(email))
  if (!check.valid) {
    throw new AuthServiceError(check.errors[0], 400)
  }
}

export async function signupWithPassword(input: SignupInput, req: NextRequest) {
  const email = normalizeEmail(input.email)
  if (!email) {
    throw new AuthServiceError("Email is required", 400)
  }

  await ensureUniqueEmail(email)
  validatePasswordOrThrow(input.password, email)

  const passwordHash = await hashPassword(input.password)
  const userCount = await prisma.user.count()
  const role: UserRole = userCount === 0 ? "OWNER" : "USER"

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name ?? null,
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

  const session = await createSession(user.id, req)
  return { user, session }
}

export async function loginWithPassword(input: LoginInput, req: NextRequest) {
  const email = normalizeEmail(input.email)
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
    throw new AuthServiceError("Invalid email or password", 401)
  }

  const ok = await verifyPassword(input.password, user.passwordHash)
  if (!ok) {
    throw new AuthServiceError("Invalid email or password", 401)
  }

  const session = await createSession(user.id, req)
  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
  return { user: publicUser, session }
}

export async function updateOwnAccount(userId: string, input: AccountUpdateInput) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      passwordHash: true,
    },
  })
  if (!target) {
    throw new AuthServiceError("User not found", 404)
  }

  const normalizedEmail = input.email === undefined
    ? undefined
    : normalizeEmail(input.email)

  if (normalizedEmail !== undefined && !normalizedEmail) {
    throw new AuthServiceError("Email is required", 400)
  }

  const hasSensitiveUpdates = Boolean(normalizedEmail !== undefined || input.newPassword)
  if (hasSensitiveUpdates && target.passwordHash) {
    if (!input.currentPassword) {
      throw new AuthServiceError("Current password is required", 400)
    }
    const valid = await verifyPassword(input.currentPassword, target.passwordHash)
    if (!valid) {
      throw new AuthServiceError("Current password is incorrect", 403)
    }
  }

  if (normalizedEmail && normalizedEmail !== target.email) {
    await ensureUniqueEmail(normalizedEmail, userId)
  }

  if (input.newPassword) {
    validatePasswordOrThrow(input.newPassword, normalizedEmail ?? target.email)
  }

  const nextPasswordHash = input.newPassword
    ? await hashPassword(input.newPassword)
    : undefined

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      email: normalizedEmail,
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
    },
  })

  return updated
}

export async function deleteOwnAccount(userId: string, currentPassword?: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      passwordHash: true,
    },
  })
  if (!target) {
    throw new AuthServiceError("User not found", 404)
  }

  if (target.passwordHash) {
    if (!currentPassword) {
      throw new AuthServiceError("Current password is required", 400)
    }
    const valid = await verifyPassword(currentPassword, target.passwordHash)
    if (!valid) {
      throw new AuthServiceError("Current password is incorrect", 403)
    }
  }

  if (target.role === "OWNER") {
    const ownerCount = await prisma.user.count({ where: { role: "OWNER" } })
    if (ownerCount <= 1) {
      throw new AuthServiceError("Cannot delete the last owner account", 400)
    }
  }

  await prisma.user.delete({ where: { id: userId } })
}

export async function startPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { email: true },
  })

  if (!user) {
    throw new AuthServiceError("Email not found", 404)
  }

  return {
    emailHint: maskEmail(user.email),
  }
}

export async function sendPasswordResetCode(emailInput: string) {
  const email = normalizeEmail(emailInput)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  })

  if (!user) {
    throw new AuthServiceError("Email not found", 404)
  }

  const code = generateVerificationCode(6)
  const codeHash = await hashPassword(code)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000)

  await prisma.passwordResetCode.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      codeHash,
      expiresAt,
      attemptCount: 0,
      maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
      consumedAt: null,
    },
    update: {
      codeHash,
      expiresAt,
      attemptCount: 0,
      maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
      consumedAt: null,
    },
  })

  await sendEmail({
    to: user.email,
    subject: "LeaseLens password reset code",
    text: `Your password reset verification code is ${code}. It expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes.`,
  })

  return {
    ok: true,
    message: "Verification code sent",
  }
}

export async function confirmPasswordReset(
  emailInput: string,
  code: string,
  newPassword: string
) {
  const email = normalizeEmail(emailInput)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordResetCodes: { take: 1 },
    },
  })

  if (!user || user.passwordResetCodes.length === 0) {
    throw new AuthServiceError("No active reset request", 404)
  }

  const record = user.passwordResetCodes[0]
  if (record.consumedAt) {
    throw new AuthServiceError("Reset code already used", 400)
  }
  if (record.expiresAt < new Date()) {
    throw new AuthServiceError("Reset code has expired", 400)
  }
  if (record.attemptCount >= record.maxAttempts) {
    throw new AuthServiceError("Reset code exceeded max attempts", 429)
  }

  const codeValid = await verifyPassword(code, record.codeHash)
  if (!codeValid) {
    await prisma.passwordResetCode.update({
      where: { id: record.id },
      data: { attemptCount: { increment: 1 } },
    })
    throw new AuthServiceError("Invalid verification code", 403)
  }

  validatePasswordOrThrow(newPassword, user.email)
  const nextPasswordHash = await hashPassword(newPassword)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: nextPasswordHash },
    }),
    prisma.passwordResetCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.session.deleteMany({
      where: { userId: user.id },
    }),
  ])

  return { ok: true, message: "Password reset complete" }
}
