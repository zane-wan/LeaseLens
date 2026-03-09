import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const schema = z.object({
  fileName: z.string().min(1),
  s3Key: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  // Hardcode userId for now; replace with real auth session in T1
  const userId = "dev-user"

  // Ensure dev user exists (remove after T1 auth is wired)
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: "dev@leaselens.dev",
      name: "Dev User",
    },
  })

  const agreement = await prisma.agreement.create({
    data: {
      userId,
      fileName: parsed.data.fileName,
      s3Key: parsed.data.s3Key,
    },
  })

  return NextResponse.json(agreement, { status: 201 })
}

export async function GET() {
  const userId = "dev-user"
  const agreements = await prisma.agreement.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
  })
  return NextResponse.json(agreements)
}
