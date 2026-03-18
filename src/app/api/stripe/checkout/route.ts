import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuthFromRequest } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthFromRequest(req)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const priceId = process.env.STRIPE_PRO_PRICE_ID
    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price ID is not configured" },
        { status: 500 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true, email: true, name: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    let customerId = dbUser.stripeCustomerId

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: dbUser.email,
        name: dbUser.name ?? undefined,
        metadata: { userId: user.id },
      })
      customerId = customer.id

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/account?subscription=success`,
      cancel_url: `${appUrl}/account?subscription=canceled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("[stripe/checkout]", err)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
