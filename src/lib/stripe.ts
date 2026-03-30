import Stripe from "stripe";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { TierId } from "@/lib/tiers";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

/** Convenience alias */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});

export function getTierFromPriceId(priceId: string): TierId {
  if (process.env.STRIPE_PRICE_STARTER && priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (process.env.STRIPE_PRICE_PRO && priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (process.env.STRIPE_PRICE_CONCIERGE && priceId === process.env.STRIPE_PRICE_CONCIERGE) return "concierge";
  console.warn(`Unknown Stripe price ID: ${priceId} — defaulting to starter`);
  return "starter";
}

export function getPriceId(tierId: TierId): string {
  const map: Record<TierId, string> = {
    free: "",
    starter: process.env.STRIPE_PRICE_STARTER || "",
    pro: process.env.STRIPE_PRICE_PRO || "",
    concierge: process.env.STRIPE_PRICE_CONCIERGE || "",
  };
  return map[tierId];
}

/** Get or create a Stripe customer for a user.
 *  If the stored customer ID no longer exists in Stripe (e.g. test-mode cleanup),
 *  create a fresh one and update the DB. */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
): Promise<string> {
  const [user] = await db
    .select({ stripeCustomerId: schema.users.stripeCustomerId })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (user?.stripeCustomerId) {
    // Verify the customer still exists in Stripe
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!(existing as any).deleted) return user.stripeCustomerId;
    } catch {
      // Customer doesn't exist — fall through to create a new one
      console.warn(`Stripe customer ${user.stripeCustomerId} not found, creating new one for user ${userId}`);
    }
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await db
    .update(schema.users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(schema.users.id, userId));

  return customer.id;
}

/** Sync a Stripe subscription to the user's tier */
export async function syncSubscriptionToUser(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price.id;
  const tierId = priceId ? getTierFromPriceId(priceId) : "starter";

  await db
    .update(schema.users)
    .set({
      tierId,
      stripeSubscriptionId: subscription.id,
      trialEndsAt: null, // Clear trial — user is now a paying customer
    })
    .where(eq(schema.users.id, userId));
}
