import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { z } from "zod"

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

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

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    ContentType: parsed.data.contentType,
  })

  const url = await getSignedUrl(s3, command, { expiresIn: 600 })

  return NextResponse.json({ url, key })
}
