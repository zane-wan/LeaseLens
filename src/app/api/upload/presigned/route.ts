import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPresignedUploadUrl, MAX_UPLOAD_SIZE_BYTES } from "@/lib/s3"
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  cleanupExpiredUploadIntents,
  createUploadIntent,
  UploadQuotaError,
} from "@/lib/uploads"

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().refine((ct) => ALLOWED_UPLOAD_CONTENT_TYPES.includes(ct as (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number]), {
    message: "Only PDF uploads are allowed",
  }),
  fileSize: z.coerce
    .number()
    .int()
    .positive("File size must be positive")
    .max(MAX_UPLOAD_SIZE_BYTES, `File size cannot exceed ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB`),
})

async function parseRequest(req: NextRequest) {
  if (req.method === "GET") {
    const { searchParams } = new URL(req.url)
    return schema.safeParse({
      fileName: searchParams.get("fileName"),
      contentType: searchParams.get("contentType"),
      fileSize: searchParams.get("fileSize"),
    })
  }

  const body = await req.json().catch(() => null)
  return schema.safeParse(body)
}

async function createPresignedUpload(req: NextRequest) {
  try {
    const user = await requireAuthFromRequest(req)
    await cleanupExpiredUploadIntents()
    const parsed = await parseRequest(req)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const key = `users/${user.id}/uploads/${randomUUID()}-${safeName}`

    let intentId: string | null = null

    try {
      const intent = await createUploadIntent(user.id, user.role, {
        fileName: parsed.data.fileName,
        contentType: parsed.data.contentType,
        fileSize: parsed.data.fileSize,
        s3Key: key,
      })
      intentId = intent.id

      const url = await getPresignedUploadUrl(key, parsed.data.contentType, parsed.data.fileSize)

      return NextResponse.json({ url, key, intentId })
    } catch (error) {
      if (intentId) {
        await prisma.uploadIntent.delete({ where: { id: intentId } }).catch(() => null)
      }
      throw error
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof UploadQuotaError) {
      return NextResponse.json({ error: err.message }, { status: 429 })
    }
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return createPresignedUpload(req)
}

export async function POST(req: NextRequest) {
  return createPresignedUpload(req)
}
