import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customerId = await getOrCreateStripeCustomer(
    session.user.id,
    session.user.email,
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/app/settings`,
  });

  return NextResponse.json({ url: portalSession.url });
}
