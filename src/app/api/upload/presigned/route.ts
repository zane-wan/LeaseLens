import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
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
      return NextResponse.json({ error: "Invalid params" }, { status: 400 })
    }

    const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const key = `users/${user.id}/uploads/${Date.now()}-${safeName}`

    // TODO: replace with real S3 presigned URL when T2a is merged
    return NextResponse.json({
      url: "https://mock-s3.example.com/upload",
      key,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 })
  }
}
