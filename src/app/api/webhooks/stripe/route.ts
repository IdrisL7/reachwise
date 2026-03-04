import { NextRequest, NextResponse } from "next/server";
import { stripe, syncSubscriptionToUser, getTierFromPriceId } from "@/lib/stripe";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/sendgrid";

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

        // Send confirmation email
        const userId = subscription.metadata.userId;
        if (userId) {
          const [user] = await db
            .select({ email: schema.users.email, name: schema.users.name, tierId: schema.users.tierId })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);

          if (user) {
            const tierName = user.tierId.charAt(0).toUpperCase() + user.tierId.slice(1);
            const isTrial = subscription.status === "trialing";
            await sendEmail({
              to: user.email,
              subject: isTrial
                ? `Welcome to GetSignalHooks — your ${tierName} trial is active`
                : `You're now on the ${tierName} plan`,
              body: `Hi ${user.name || "there"},\n\n${isTrial
                ? `Your 7-day free trial of the ${tierName} plan is now active. You won't be charged until your trial ends.`
                : `Thanks for subscribing! Your ${tierName} plan is now active.`
              }\n\nHere's what you can do next:\n\n1. Generate hooks: https://www.getsignalhooks.com/app/hooks\n2. Import your leads: https://www.getsignalhooks.com/app/leads\n3. Manage your subscription: https://www.getsignalhooks.com/app/settings\n\nIf you have any questions, reply to this email — we're here to help.\n\n— The GetSignalHooks Team`,
              userId,
            }).catch((err) => console.error("Failed to send subscription confirmation:", err));
          }
        }
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
