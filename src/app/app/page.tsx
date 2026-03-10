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

  const isOnTrial = !user?.stripeSubscriptionId && !!user?.trialEndsAt;
  const trialDaysLeft = isOnTrial
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const trialExpired = isOnTrial && trialDaysLeft === 0;

  const progressColor = hooksPercent > 80
    ? "bg-gradient-to-r from-amber-500 to-red-500"
    : hooksPercent > 50
      ? "bg-gradient-to-r from-emerald-500 to-amber-500"
      : "bg-emerald-500";

  return (
    <div>
      {/* Trial expiry banner */}
      {trialExpired && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6 animate-fade-in">
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
        <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4 mb-6 animate-fade-in">
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
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-all duration-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate Hooks
        </Link>
      </div>

      {/* First-run welcome for new users */}
      {isNewUser && (
        <div className="bg-gradient-to-br from-violet-900/20 to-zinc-900 border border-violet-800/40 rounded-xl p-6 mb-8 animate-scale-in">
          <h2 className="text-lg font-semibold mb-2">Welcome to GetSignalHooks</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Get started in 2 steps:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/app/hooks"
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 hover:border-violet-600/50 transition-all duration-200 group"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10 text-violet-400 text-sm font-bold mb-3">1</div>
              <h3 className="font-medium mb-1 group-hover:text-violet-400 transition-colors">Generate your first hooks</h3>
              <p className="text-xs text-zinc-500">
                Paste any company URL and get research-backed outbound hooks in seconds.
              </p>
            </Link>
            <Link
              href="/app/leads"
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 hover:border-violet-600/50 transition-all duration-200 group"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10 text-violet-400 text-sm font-bold mb-3">2</div>
              <h3 className="font-medium mb-1 group-hover:text-violet-400 transition-colors">Import your leads</h3>
              <p className="text-xs text-zinc-500">
                Upload a CSV from Apollo, Clay, or any source to generate hooks at scale.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Hooks Used */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Hooks Used
            </p>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold">{hooksUsed}</p>
            <span className="text-sm text-zinc-500 font-normal">
              / {limits.hooksPerMonth}
            </span>
            <span className="ml-auto text-xs text-zinc-600 font-medium">
              {hooksPercent}%
            </span>
          </div>
          <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${hooksPercent}%` }}
            />
          </div>
        </div>

        {/* Total Leads */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Total Leads
            </p>
          </div>
          <p className="text-2xl font-bold">{leadCount?.count ?? 0}</p>
          {(leadCount?.count ?? 0) === 0 && (
            <Link href="/app/leads" className="text-xs text-violet-400 hover:text-violet-300 mt-1 inline-block transition-colors">
              Import your first leads
            </Link>
          )}
        </div>

        {/* Emails Sent */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Emails Sent (30d)
            </p>
          </div>
          <p className="text-2xl font-bold">{emailsSent?.count ?? 0}</p>
        </div>

        {/* Plan */}
        <div className={`bg-zinc-900 border rounded-xl p-5 ${isOnTrial && !trialExpired ? "border-l-amber-500 border-l-2 border-zinc-800" : "border-zinc-800"}`}>
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Plan
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-sm font-bold text-emerald-400 capitalize">
              {tierId}
            </span>
            {isOnTrial && !trialExpired && (
              <span className="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full border border-amber-800/50">
                Trial
              </span>
            )}
          </div>
          {tierId !== "concierge" && (
            <Link
              href="/#pricing"
              className="text-xs text-violet-400 hover:text-violet-300 mt-1.5 inline-block transition-colors"
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
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-violet-500/30 hover:shadow-[0_2px_16px_rgba(139,92,246,0.06)] transition-all duration-200 group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10 text-violet-400 transition-colors group-hover:bg-violet-600/15">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-medium group-hover:text-violet-300 transition-colors">Generate Hooks</h3>
          </div>
          <p className="text-sm text-zinc-500">
            Enter a company URL and get evidence-based hooks instantly.
          </p>
        </Link>
        <Link
          href="/app/leads"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-violet-500/30 hover:shadow-[0_2px_16px_rgba(139,92,246,0.06)] transition-all duration-200 group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10 text-violet-400 transition-colors group-hover:bg-violet-600/15">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h3 className="font-medium group-hover:text-violet-300 transition-colors">Manage Leads</h3>
          </div>
          <p className="text-sm text-zinc-500">
            Upload, view, and manage your lead pipeline.
          </p>
        </Link>
        <Link
          href="/app/analytics"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-violet-500/30 hover:shadow-[0_2px_16px_rgba(139,92,246,0.06)] transition-all duration-200 group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10 text-violet-400 transition-colors group-hover:bg-violet-600/15">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h3 className="font-medium group-hover:text-violet-300 transition-colors">View Analytics</h3>
          </div>
          <p className="text-sm text-zinc-500">
            Track hook performance, email engagement, and ROI.
          </p>
        </Link>
      </div>
    </div>
  );
}
