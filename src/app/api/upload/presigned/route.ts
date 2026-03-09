import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parsed = schema.safeParse({
    fileName: searchParams.get("fileName"),
    contentType: searchParams.get("contentType"),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const key = `uploads/${Date.now()}-${parsed.data.fileName}`

  // TODO: replace with real S3 presigned URL when T2a is merged
  return NextResponse.json({
    url: "https://mock-s3.example.com/upload",
    key,
  })
}
