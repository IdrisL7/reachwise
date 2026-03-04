import Stripe from "stripe";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { TierId } from "@/lib/tiers";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });
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
  const map: Record<string, TierId> = {
    [process.env.STRIPE_PRICE_STARTER || ""]: "starter",
    [process.env.STRIPE_PRICE_PRO || ""]: "pro",
    [process.env.STRIPE_PRICE_CONCIERGE || ""]: "concierge",
  };
  return map[priceId] || "starter";
}

export function getPriceId(tierId: TierId): string {
  const map: Record<TierId, string> = {
    starter: process.env.STRIPE_PRICE_STARTER || "",
    pro: process.env.STRIPE_PRICE_PRO || "",
    concierge: process.env.STRIPE_PRICE_CONCIERGE || "",
  };
  return map[tierId];
}

/** Get or create a Stripe customer for a user */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
): Promise<string> {
  const [user] = await db
    .select({ stripeCustomerId: schema.users.stripeCustomerId })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (user?.stripeCustomerId) return user.stripeCustomerId;

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
    })
    .where(eq(schema.users.id, userId));
}
