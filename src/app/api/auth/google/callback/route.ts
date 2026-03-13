import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_cancelled`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_not_configured`);
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`;

  // Exchange authorization code for tokens
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
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_token_failed`);
  }

  const tokens: GoogleTokenResponse = await tokenRes.json();

  // Fetch user profile from Google
  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_profile_failed`);
  }

  const googleUser: GoogleUserInfo = await userRes.json();

  // Find existing account or create user + account
  const existingAccount = await prisma.account.findUnique({
    where: {
      providerId_accountId: {
        providerId: "google",
        accountId: googleUser.sub,
      },
    },
    include: { user: true },
  });

  let userId: string;

  if (existingAccount) {
    // Returning user — update tokens
    userId = existingAccount.userId;
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existingAccount.refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
  } else {
    // Check if a user with this email already exists (signed up with password)
    const existingUser = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (existingUser) {
      // Link Google account to existing user
      userId = existingUser.id;
      await prisma.account.create({
        data: {
          userId: existingUser.id,
          providerId: "google",
          accountId: googleUser.sub,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });
      // Update profile fields if not already set
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          emailVerified: true,
          name: existingUser.name || googleUser.name,
          image: existingUser.image || googleUser.picture,
        },
      });
    } else {
      // Brand new user via Google
      const newUser = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          image: googleUser.picture,
          emailVerified: true,
          accounts: {
            create: {
              providerId: "google",
              accountId: googleUser.sub,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              accessTokenExpiresAt: new Date(
                Date.now() + tokens.expires_in * 1000
              ),
            },
          },
        },
      });
      userId = newUser.id;
    }
  }

  // Issue our JWT and redirect to dashboard
  const token = await signToken({ userId, email: googleUser.email });

  const response = NextResponse.redirect(`${appUrl}/dashboard`);
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
