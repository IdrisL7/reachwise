import { NextRequest, NextResponse } from "next/server";
import { stripe, syncSubscriptionToUser, getTierFromPriceId } from "@/lib/stripe";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/sendgrid";
import { logAudit } from "@/lib/audit";

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

  // Idempotency: skip already-processed events
  const [existing] = await db
    .select()
    .from(schema.stripeEvents)
    .where(eq(schema.stripeEvents.eventId, event.id))
    .limit(1);

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Record this event as processed
  await db.insert(schema.stripeEvents).values({
    eventId: event.id,
    type: event.type,
  });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.subscription && session.mode === "subscription") {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await syncSubscriptionToUser(subscription);
        logAudit({
          userId: subscription.metadata.userId,
          event: "subscription_created",
          metadata: { subscriptionId: subscription.id, tierId: subscription.metadata.tierId },
        }).catch(() => {});

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
      logAudit({
        userId: subscription.metadata.userId,
        event: "subscription_updated",
        metadata: { subscriptionId: subscription.id, status: subscription.status },
      }).catch(() => {});
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
      const customerId = invoice.customer as string;
      console.warn(`Payment failed for customer ${customerId}`, {
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
      });

      const [failedUser] = await db
        .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.stripeCustomerId, customerId))
        .limit(1);

      if (failedUser) {
        const settingsUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.getsignalhooks.com"}/app/settings`;

        if ((invoice.attempt_count || 0) >= 3) {
          await db
            .update(schema.users)
            .set({ tierId: "starter", stripeSubscriptionId: null })
            .where(eq(schema.users.id, failedUser.id));

          await sendEmail({
            to: failedUser.email,
            subject: "Your GetSignalHooks subscription has been paused",
            body: `Hi ${failedUser.name || "there"},\n\nWe weren't able to process your payment after multiple attempts. Your account has been downgraded to the Starter plan.\n\nTo restore your subscription, please update your payment method:\n${settingsUrl}\n\nIf you need help, just reply to this email.\n\n— The GetSignalHooks Team`,
            userId: failedUser.id,
          }).catch((err) => console.error("Failed to send dunning email:", err));

          logAudit({
            userId: failedUser.id,
            event: "subscription_downgraded_payment_failed",
            metadata: { invoiceId: invoice.id, attemptCount: invoice.attempt_count },
          }).catch(() => {});
        } else {
          await sendEmail({
            to: failedUser.email,
            subject: "Action needed: payment failed for GetSignalHooks",
            body: `Hi ${failedUser.name || "there"},\n\nWe couldn't process your latest payment. Please update your payment method to keep your subscription active:\n${settingsUrl}\n\nIf this was a temporary issue, we'll try again automatically.\n\n— The GetSignalHooks Team`,
            userId: failedUser.id,
          }).catch((err) => console.error("Failed to send dunning email:", err));
        }
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object;
      const customerId = charge.customer as string;
      if (customerId) {
        const [refundedUser] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.stripeCustomerId, customerId))
          .limit(1);

        if (refundedUser) {
          await db
            .update(schema.users)
            .set({ tierId: "starter", stripeSubscriptionId: null })
            .where(eq(schema.users.id, refundedUser.id));

          logAudit({
            userId: refundedUser.id,
            event: "subscription_downgraded_refund",
            metadata: { chargeId: charge.id, amountRefunded: charge.amount_refunded },
          }).catch(() => {});
        }
      }
      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object;
      await syncSubscriptionToUser(subscription);
      logAudit({
        userId: subscription.metadata.userId,
        event: "subscription_created_webhook",
        metadata: { subscriptionId: subscription.id },
      }).catch(() => {});
      break;
    }
  }

  return NextResponse.json({ received: true });
}
