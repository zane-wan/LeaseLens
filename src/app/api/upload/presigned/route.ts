import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPresignedUploadUrl } from "@/lib/s3"

const ALLOWED_CONTENT_TYPES = ["application/pdf"]

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().refine((ct) => ALLOWED_CONTENT_TYPES.includes(ct), {
    message: "Only PDF uploads are allowed",
  }),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parsed = schema.safeParse({
    fileName: searchParams.get("fileName"),
    contentType: searchParams.get("contentType"),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const key = `uploads/${Date.now()}-${parsed.data.fileName}`
  const url = await getPresignedUploadUrl(key, parsed.data.contentType)

  return NextResponse.json({ url, key })
}
