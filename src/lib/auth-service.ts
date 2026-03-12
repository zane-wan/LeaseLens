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
  username: string
  email: string | null
  name: string | null
  role: UserRole
}

type SignupInput = {
  username: string
  password: string
  email?: string
  name?: string
}

type LoginInput = {
  username: string
  password: string
}

type AccountUpdateInput = {
  username?: string
  name?: string
  email?: string
  currentPassword?: string
  newPassword?: string
}

const PASSWORD_RESET_EXPIRY_MINUTES = 15
const PASSWORD_RESET_MAX_ATTEMPTS = 5

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  const prefix = local.slice(0, 3)
  return `${prefix}***@${domain}`
}

async function ensureUniqueUsername(username: string, exceptUserId?: string) {
  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing && existing.id !== exceptUserId) {
    throw new AuthServiceError("Username is already taken", 409)
  }
}

async function ensureUniqueEmail(email: string, exceptUserId?: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && existing.id !== exceptUserId) {
    throw new AuthServiceError("Email is already in use", 409)
  }
}

function validatePasswordOrThrow(password: string, username: string) {
  const check = validateStrongPassword(password, username)
  if (!check.valid) {
    throw new AuthServiceError(check.errors[0], 400)
  }
}

export async function signupWithPassword(input: SignupInput, req: NextRequest) {
  const username = normalizeUsername(input.username)
  const email = input.email?.trim().toLowerCase() || null

  await ensureUniqueUsername(username)
  if (email) await ensureUniqueEmail(email)
  validatePasswordOrThrow(input.password, username)

  const passwordHash = await hashPassword(input.password)
  const userCount = await prisma.user.count()
  const role: UserRole = userCount === 0 ? "OWNER" : "USER"

  const user = await prisma.user.create({
    data: {
      username,
      email,
      name: input.name ?? null,
      role,
      passwordHash,
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
    },
  })

  const session = await createSession(user.id, req)
  return { user, session }
}

export async function loginWithPassword(input: LoginInput, req: NextRequest) {
  const username = normalizeUsername(input.username)
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
    },
  })
  if (!user?.passwordHash) {
    throw new AuthServiceError("Invalid credentials", 401)
  }

  const ok = await verifyPassword(input.password, user.passwordHash)
  if (!ok) {
    throw new AuthServiceError("Invalid credentials", 401)
  }

  const session = await createSession(user.id, req)
  const publicUser: PublicUser = {
    id: user.id,
    username: user.username,
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
      username: true,
      passwordHash: true,
    },
  })
  if (!target) {
    throw new AuthServiceError("User not found", 404)
  }

  const normalizedUsername = input.username ? normalizeUsername(input.username) : undefined
  const normalizedEmail = input.email === undefined
    ? undefined
    : input.email.trim() === ""
      ? null
      : input.email.trim().toLowerCase()

  const hasSensitiveUpdates = Boolean(normalizedUsername || normalizedEmail !== undefined || input.newPassword)
  if (hasSensitiveUpdates) {
    if (!input.currentPassword || !target.passwordHash) {
      throw new AuthServiceError("Current password is required", 400)
    }
    const valid = await verifyPassword(input.currentPassword, target.passwordHash)
    if (!valid) {
      throw new AuthServiceError("Current password is incorrect", 403)
    }
  }

  if (normalizedUsername) {
    await ensureUniqueUsername(normalizedUsername, userId)
  }
  if (normalizedEmail) {
    await ensureUniqueEmail(normalizedEmail, userId)
  }

  if (input.newPassword) {
    validatePasswordOrThrow(input.newPassword, normalizedUsername ?? target.username)
  }

  const nextPasswordHash = input.newPassword
    ? await hashPassword(input.newPassword)
    : undefined

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      username: normalizedUsername,
      name: input.name,
      email: normalizedEmail,
      passwordHash: nextPasswordHash,
      emailVerified: normalizedEmail === undefined ? undefined : false,
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
    },
  })

  return updated
}

export async function deleteOwnAccount(userId: string, currentPassword: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      passwordHash: true,
    },
  })
  if (!target || !target.passwordHash) {
    throw new AuthServiceError("User not found", 404)
  }

  const valid = await verifyPassword(currentPassword, target.passwordHash)
  if (!valid) {
    throw new AuthServiceError("Current password is incorrect", 403)
  }

  if (target.role === "OWNER") {
    const ownerCount = await prisma.user.count({ where: { role: "OWNER" } })
    if (ownerCount <= 1) {
      throw new AuthServiceError("Cannot delete the last owner account", 400)
    }
  }

  await prisma.user.delete({ where: { id: userId } })
}

export async function startPasswordReset(usernameInput: string) {
  const username = normalizeUsername(usernameInput)
  const user = await prisma.user.findUnique({
    where: { username },
    select: { username: true, email: true },
  })
  if (!user) {
    throw new AuthServiceError("Username not found", 404)
  }
  if (!user.email) {
    throw new AuthServiceError("No email is attached to this account, so password reset is unavailable", 400)
  }

  return {
    username: user.username,
    emailHint: maskEmail(user.email),
  }
}

export async function sendPasswordResetCode(usernameInput: string, typedEmail: string) {
  const username = normalizeUsername(usernameInput)
  const email = typedEmail.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, email: true },
  })
  if (!user) {
    throw new AuthServiceError("Username not found", 404)
  }
  if (!user.email) {
    throw new AuthServiceError("No email is attached to this account, so password reset is unavailable", 400)
  }
  if (user.email.toLowerCase() !== email) {
    throw new AuthServiceError("Typed email does not match this account", 403)
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
  usernameInput: string,
  code: string,
  newPassword: string
) {
  const username = normalizeUsername(usernameInput)
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
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

  validatePasswordOrThrow(newPassword, user.username)
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
