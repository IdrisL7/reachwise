import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe, getOrCreateStripeCustomer, getPriceId } from "@/lib/stripe";
import type { TierId } from "@/lib/tiers";

const VALID_TIERS: TierId[] = ["starter", "pro", "concierge"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tierId, trial } = await req.json();
  if (!VALID_TIERS.includes(tierId)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const priceId = getPriceId(tierId);
  if (!priceId) {
    return NextResponse.json({ error: "Tier not configured in Stripe" }, { status: 500 });
  }

  try {
    const customerId = await getOrCreateStripeCustomer(
      session.user.id,
      session.user.email,
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/app?upgraded=true`,
      cancel_url: `${appUrl}/#pricing`,
      currency: "gbp",
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: trial ? 7 : undefined,
        metadata: { userId: session.user.id, tierId },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe checkout error:", message, err);
    return NextResponse.json(
      { error: `Checkout failed: ${message}` },
      { status: 500 },
    );
  }
}
