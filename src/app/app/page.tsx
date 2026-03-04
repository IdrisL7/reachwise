import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { getLimits } from "@/lib/tier-guard";
import type { TierId } from "@/lib/tiers";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;
  const tierId = session.user.tierId as TierId;
  const limits = getLimits(tierId);

  // Fetch stats
  const [user] = await db
    .select({
      hooksUsed: schema.users.hooksUsedThisMonth,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const [leadCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.leads)
    .where(eq(schema.leads.userId, userId));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [emailsSent] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.outboundMessages)
    .where(
      and(
        eq(schema.outboundMessages.leadId, sql`(SELECT id FROM leads WHERE user_id = ${userId} LIMIT 1)`),
        eq(schema.outboundMessages.status, "sent"),
        gte(schema.outboundMessages.createdAt, thirtyDaysAgo),
      ),
    );

  const hooksUsed = user?.hooksUsed ?? 0;
  const hooksPercent = Math.min(100, Math.round((hooksUsed / limits.hooksPerMonth) * 100));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/app/hooks"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Generate Hooks
        </Link>
      </div>

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
          <p className="text-2xl font-bold capitalize">{tierId}</p>
          {tierId !== "concierge" && (
            <Link
              href="/app/settings"
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
