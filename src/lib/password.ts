import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback)
const SCRYPT_KEYLEN = 64

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
