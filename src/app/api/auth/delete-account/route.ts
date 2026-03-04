import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    await logAudit({ userId, event: "account_deletion_initiated" });

    // Get user details for Stripe cancellation
    const [user] = await db
      .select({
        stripeSubscriptionId: schema.users.stripeSubscriptionId,
        stripeCustomerId: schema.users.stripeCustomerId,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    // Cancel Stripe subscription if active
    if (user?.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (err) {
        console.error("Failed to cancel Stripe subscription:", err);
        // Continue with deletion even if Stripe fails
      }
    }

    // Delete user data in order (respect foreign keys)
    // API keys
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.userId, userId));

    // Integrations
    await db.delete(schema.integrations).where(eq(schema.integrations.userId, userId));

    // n8n instances
    await db.delete(schema.n8nInstances).where(eq(schema.n8nInstances.userId, userId));

    // Usage events
    await db.delete(schema.usageEvents).where(eq(schema.usageEvents.userId, userId));

    // Leads and related data (messages, audit logs, claim locks)
    const userLeads = await db
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(eq(schema.leads.userId, userId));

    for (const lead of userLeads) {
      await db.delete(schema.outboundMessages).where(eq(schema.outboundMessages.leadId, lead.id));
      await db.delete(schema.auditLog).where(eq(schema.auditLog.leadId, lead.id));
      await db.delete(schema.claimLocks).where(eq(schema.claimLocks.leadId, lead.id));
    }
    await db.delete(schema.leads).where(eq(schema.leads.userId, userId));

    // Auth tables
    await db.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));

    // Finally delete the user
    await db.delete(schema.users).where(eq(schema.users.id, userId));

    return NextResponse.json({ message: "Account deleted successfully." });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account. Please contact support." },
      { status: 500 },
    );
  }
}
