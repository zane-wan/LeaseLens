import { NextRequest, NextResponse } from "next/server"
import { buildAppUrl } from "@/lib/app-url"

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 500 }
    )
  }

  const redirectUri = buildAppUrl("/api/auth/google/callback", req)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
