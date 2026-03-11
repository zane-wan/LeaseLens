import { NextRequest, NextResponse } from "next/server"
import { clearSessionCookie, destroySessionByRequest } from "@/lib/auth"

export async function POST(req: NextRequest) {
  await destroySessionByRequest(req)
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}
