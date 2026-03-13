import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { attachSessionCookie, createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture: string
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const error = req.nextUrl.searchParams.get("error")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_cancelled`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_not_configured`)
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_token_failed`)
  }

  const tokens: GoogleTokenResponse = await tokenRes.json()

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userRes.ok) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_profile_failed`)
  }

  const googleUser: GoogleUserInfo = await userRes.json()
  if (!googleUser.email || !googleUser.email_verified) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_email_unverified`)
  }
  const normalizedEmail = googleUser.email.trim().toLowerCase()

  const existingAccount = await prisma.account.findUnique({
    where: {
      providerId_accountId: {
        providerId: "google",
        accountId: googleUser.sub,
      },
    },
    include: { user: true },
  })

  let userId: string

  if (existingAccount) {
    userId = existingAccount.userId
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existingAccount.refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })
  } else {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      userId = existingUser.id
      await prisma.account.create({
        data: {
          userId: existingUser.id,
          providerId: "google",
          accountId: googleUser.sub,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      })

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          emailVerified: true,
          name: existingUser.name || googleUser.name,
          image: existingUser.image || googleUser.picture,
        },
      })
    } else {
      const userCount = await prisma.user.count()
      const role: UserRole = userCount === 0 ? "OWNER" : "USER"

      const newUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: googleUser.name,
          image: googleUser.picture,
          role,
          emailVerified: true,
          accounts: {
            create: {
              providerId: "google",
              accountId: googleUser.sub,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            },
          },
        },
      })
      userId = newUser.id
    }
  }

  const session = await createSession(userId, req)
  const response = NextResponse.redirect(`${appUrl}/dashboard`)
  attachSessionCookie(response, session.token, session.expiresAt)

  return response
}
