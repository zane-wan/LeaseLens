import { NextRequest, NextResponse } from "next/server"
import { buildAppUrl, isLocalAppUrl } from "@/lib/app-url"

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 500 }
    )
  }

  const redirectUri = buildAppUrl("/api/auth/google/callback", req)
  if (process.env.NODE_ENV === "production" && isLocalAppUrl(redirectUri)) {
    console.error("Google OAuth redirect URI resolved to localhost in production", {
      redirectUri,
      host: req.headers.get("host"),
      forwardedHost: req.headers.get("x-forwarded-host"),
      forwardedProto: req.headers.get("x-forwarded-proto"),
      configuredAppUrl: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    })

    return NextResponse.json(
      {
        error:
          "OAuth app URL is misconfigured. Set APP_URL or NEXT_PUBLIC_APP_URL to the production domain.",
      },
      { status: 500 }
    )
  }

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
