import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const schema = z.object({
  fileName: z.string().min(1),
  s3Key: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthFromRequest(req)
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    const agreement = await prisma.agreement.create({
      data: {
        userId: user.id,
        fileName: parsed.data.fileName,
        s3Key: parsed.data.s3Key,
      },
    })

    return NextResponse.json(agreement, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to create agreement" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthFromRequest(req)
    const agreements = await prisma.agreement.findMany({
      where: { userId: user.id },
      orderBy: { uploadedAt: "desc" },
    })
    return NextResponse.json(agreements)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to fetch agreements" }, { status: 500 })
  }
}
