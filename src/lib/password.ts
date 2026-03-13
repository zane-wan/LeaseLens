import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback)
const SCRYPT_KEYLEN = 64
const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 64
const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "qwerty",
  "qwerty123",
  "123456",
  "12345678",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "abc123",
  "000000",
])

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer
  return `${salt}:${derived.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false

  const inputHash = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer
  const storedHash = Buffer.from(hash, "hex")
  if (inputHash.length !== storedHash.length) return false

  return timingSafeEqual(inputHash, storedHash)
}

export function validateStrongPassword(password: string, identityHint?: string) {
  const errors: string[] = []
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password length must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`)
  }

  const lower = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lower)) {
    errors.push("Password is too common")
  }

  const normalizedIdentity = identityHint?.trim().toLowerCase()
  if (normalizedIdentity && normalizedIdentity.length > 2 && lower.includes(normalizedIdentity)) {
    errors.push("Password must not contain your account identifier")
  }

  if (/(.)\1{3,}/.test(password)) {
    errors.push("Password has repeated character patterns")
  }

  if (new Set(password).size < 6) {
    errors.push("Password needs more character variety")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function generateVerificationCode(length = 6): string {
  const max = 10 ** length
  const num = Number.parseInt(randomBytes(4).toString("hex"), 16) % max
  return num.toString().padStart(length, "0")
}
