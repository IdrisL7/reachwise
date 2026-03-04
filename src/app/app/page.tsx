import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, sql, and, gte, inArray } from "drizzle-orm";
import { getLimits } from "@/lib/tier-guard";
import type { TierId } from "@/lib/tiers";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  // Read fresh tier from DB (JWT may be stale after upgrade)
  const [user] = await db
    .select({
      hooksUsed: schema.users.hooksUsedThisMonth,
      tierId: schema.users.tierId,
      trialEndsAt: schema.users.trialEndsAt,
      stripeSubscriptionId: schema.users.stripeSubscriptionId,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const tierId = (user?.tierId as TierId) || "starter";
  const limits = getLimits(tierId);

  const [leadCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.leads)
    .where(eq(schema.leads.userId, userId));

  // Fix: count emails across ALL user leads, not just one
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [emailsSent] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.outboundMessages)
    .where(
      and(
        sql`${schema.outboundMessages.leadId} IN (SELECT id FROM leads WHERE user_id = ${userId})`,
        eq(schema.outboundMessages.status, "sent"),
        gte(schema.outboundMessages.createdAt, thirtyDaysAgo),
      ),
    );

  const hooksUsed = user?.hooksUsed ?? 0;
  const hooksPercent = Math.min(100, Math.round((hooksUsed / limits.hooksPerMonth) * 100));
  const isNewUser = hooksUsed === 0 && (leadCount?.count ?? 0) === 0;

  // Trial status
  const isOnTrial = !user?.stripeSubscriptionId && !!user?.trialEndsAt;
  const trialDaysLeft = isOnTrial
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const trialExpired = isOnTrial && trialDaysLeft === 0;

  return (
    <div>
      {/* Trial expiry banner */}
      {trialExpired && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-300 font-medium">Your free trial has ended.</p>
          <p className="text-xs text-red-400 mt-1">
            Subscribe to continue generating hooks and managing leads.
          </p>
          <Link
            href="/#pricing"
            className="inline-block mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            View plans
          </Link>
        </div>
      )}

      {/* Trial countdown banner */}
      {isOnTrial && !trialExpired && trialDaysLeft <= 3 && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-300 font-medium">
            {trialDaysLeft === 1 ? "1 day" : `${trialDaysLeft} days`} left on your free trial
          </p>
          <p className="text-xs text-amber-400 mt-1">
            Subscribe now to keep access to your hooks and leads.
          </p>
          <Link
            href="/#pricing"
            className="inline-block mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Subscribe
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/app/hooks"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Generate Hooks
        </Link>
      </div>

      {/* First-run welcome for new users */}
      {isNewUser && (
        <div className="bg-gradient-to-br from-emerald-900/20 to-zinc-900 border border-emerald-800/40 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-2">Welcome to GetSignalHooks</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Get started in 2 steps:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/app/hooks"
              className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 hover:border-emerald-600 transition-colors group"
            >
              <div className="text-2xl mb-2">1</div>
              <h3 className="font-medium mb-1 group-hover:text-emerald-400 transition-colors">Generate your first hooks</h3>
              <p className="text-xs text-zinc-500">
                Paste any company URL and get research-backed outbound hooks in seconds.
              </p>
            </Link>
            <Link
              href="/app/leads"
              className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 hover:border-emerald-600 transition-colors group"
            >
              <div className="text-2xl mb-2">2</div>
              <h3 className="font-medium mb-1 group-hover:text-emerald-400 transition-colors">Import your leads</h3>
              <p className="text-xs text-zinc-500">
                Upload a CSV from Apollo, Clay, or any source to generate hooks at scale.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Hooks Used
          </p>
          <p className="text-2xl font-bold">
            {hooksUsed}{" "}
            <span className="text-sm text-zinc-500 font-normal">
              / {limits.hooksPerMonth}
            </span>
          </p>
          <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${hooksPercent > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${hooksPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Total Leads
          </p>
          <p className="text-2xl font-bold">{leadCount?.count ?? 0}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Emails Sent (30d)
          </p>
          <p className="text-2xl font-bold">{emailsSent?.count ?? 0}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Plan
          </p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold capitalize">{tierId}</p>
            {isOnTrial && !trialExpired && (
              <span className="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full">
                Trial
              </span>
            )}
          </div>
          {tierId !== "concierge" && (
            <Link
              href="/#pricing"
              className="text-xs text-emerald-400 hover:underline"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/app/hooks"
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors"
        >
          <h3 className="font-medium mb-1">Generate Hooks</h3>
          <p className="text-sm text-zinc-500">
            Enter a company URL and get evidence-based hooks instantly.
          </p>
        </Link>
        <Link
          href="/app/leads"
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors"
        >
          <h3 className="font-medium mb-1">Manage Leads</h3>
          <p className="text-sm text-zinc-500">
            Upload, view, and manage your lead pipeline.
          </p>
        </Link>
        <Link
          href="/app/analytics"
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors"
        >
          <h3 className="font-medium mb-1">View Analytics</h3>
          <p className="text-sm text-zinc-500">
            Track hook performance, email engagement, and ROI.
          </p>
        </Link>
      </div>
    </div>
  );
}
