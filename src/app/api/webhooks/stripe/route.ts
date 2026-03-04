import { NextRequest, NextResponse } from "next/server";
import { stripe, syncSubscriptionToUser, getTierFromPriceId } from "@/lib/stripe";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.subscription && session.mode === "subscription") {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await syncSubscriptionToUser(subscription);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      await syncSubscriptionToUser(subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const userId = subscription.metadata.userId;
      if (userId) {
        await db
          .update(schema.users)
          .set({
            tierId: "starter",
            stripeSubscriptionId: null,
            trialEndsAt: new Date().toISOString(), // Set expired trial to block free access
          })
          .where(eq(schema.users.id, userId));
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      console.warn(`Payment failed for customer ${invoice.customer}`, {
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
