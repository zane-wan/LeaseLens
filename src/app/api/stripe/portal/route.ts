import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthFromRequest(req)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    })

    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account" },
        { status: 400 }
      )
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: `${appUrl}/account`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("[stripe/portal]", err)
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    )
  }
}
