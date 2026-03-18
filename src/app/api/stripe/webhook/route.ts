import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

// Disable body parsing so we receive the raw bytes Stripe needs for signature verification.
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set")
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    )
  }

  const sig = req.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Stripe.Event
  const rawBody = await req.text()

  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== "subscription") break

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id ?? null

        await prisma.user.update({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            subscriptionStatus: subscription.status,
          },
        })
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price.id ?? null

        await prisma.user.update({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            subscriptionStatus: subscription.status,
          },
        })
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await prisma.user.update({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: null,
            stripePriceId: null,
            subscriptionStatus: "canceled",
          },
        })
        break
      }

      default:
        // Unhandled event types are intentionally ignored.
        break
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error handling event ${event.type}:`, err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
