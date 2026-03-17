import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { getPresignedUploadUrl, MAX_UPLOAD_SIZE_BYTES } from "@/lib/s3"
import { prisma } from "@/lib/prisma"

const ALLOWED_CONTENT_TYPES = ["application/pdf"]
const MAX_UPLOADS_PER_24H = 20

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().refine((ct) => ALLOWED_CONTENT_TYPES.includes(ct), {
    message: "Only PDF uploads are allowed",
  }),
  fileSize: z.coerce
    .number()
    .int()
    .positive("File size must be positive")
    .max(MAX_UPLOAD_SIZE_BYTES, `File size cannot exceed ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB`),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthFromRequest(req)
    const { searchParams } = new URL(req.url)
    const parsed = schema.safeParse({
      fileName: searchParams.get("fileName"),
      contentType: searchParams.get("contentType"),
      fileSize: searchParams.get("fileSize"),
    })

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    // Rate limit: max uploads per rolling 24-hour window
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentCount = await prisma.agreement.count({
      where: { userId: user.id, uploadedAt: { gte: oneDayAgo } },
    })
    if (recentCount >= MAX_UPLOADS_PER_24H) {
      return NextResponse.json(
        { error: `Upload limit reached (${MAX_UPLOADS_PER_24H} files per 24 hours). Please try again later.` },
        { status: 429 },
      )
    }

    const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const key = `users/${user.id}/uploads/${Date.now()}-${safeName}`

    const url = await getPresignedUploadUrl(key, parsed.data.contentType, parsed.data.fileSize)

    return NextResponse.json({ url, key })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 })
  }
}
