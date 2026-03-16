import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { getPresignedUploadUrl } from "@/lib/s3"

const ALLOWED_CONTENT_TYPES = ["application/pdf"]

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().refine((ct) => ALLOWED_CONTENT_TYPES.includes(ct), {
    message: "Only PDF uploads are allowed",
  }),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthFromRequest(req)
    const { searchParams } = new URL(req.url)
    const parsed = schema.safeParse({
      fileName: searchParams.get("fileName"),
      contentType: searchParams.get("contentType"),
    })

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const key = `users/${user.id}/uploads/${Date.now()}-${safeName}`
    
    // T2a now merged: using real S3 presigned URL
    const url = await getPresignedUploadUrl(key, parsed.data.contentType as string)

    return NextResponse.json({ url, key })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 })
  }
}
