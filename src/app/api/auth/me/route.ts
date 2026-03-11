import { NextRequest, NextResponse } from "next/server"
import { getAuthUserFromRequest } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req)
  return NextResponse.json({ user })
}
