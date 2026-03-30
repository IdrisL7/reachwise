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
      hooksResetAt: schema.users.hooksResetAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const tierId = (user?.tierId as TierId) || "free";
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

  const resetDaysLeft = user?.hooksResetAt ? Math.max(0, Math.ceil((new Date(user.hooksResetAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  const progressColor = hooksPercent > 80
    ? "bg-gradient-to-r from-amber-500 to-red-500"
    : hooksPercent > 50
      ? "bg-gradient-to-r from-emerald-500 to-amber-500"
      : "bg-emerald-500";

  return (
    <div>
      {/* Trial expiry banner */}
      {trialExpired && (
        <div className="border-b border-amber-800/60 bg-amber-950/30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 mb-6 animate-fade-in">
          <p className="text-sm text-amber-300">
            Your free trial has ended.{" "}
            <Link href="/#pricing" className="underline underline-offset-2 hover:text-amber-200 font-medium">View plans →</Link>
          </p>
        </div>
      )}

      {/* Trial countdown banner */}
      {isOnTrial && !trialExpired && trialDaysLeft <= 7 && (
        <div className="border-b border-amber-800/40 bg-amber-950/20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 mb-6 animate-fade-in">
          <p className="text-sm text-amber-300/80">
            {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left on your free trial.{" "}
            <Link href="/#pricing" className="underline underline-offset-2 hover:text-amber-200">View plans →</Link>
          </p>
        </div>
      )}

      {/* First-run welcome for new users */}
      {isNewUser && (
        <>
          <div className="border border-[#252830] bg-[#14161a] rounded-xl p-6 mb-6 animate-scale-in">
            <p className="text-xs text-[#878a8f] uppercase tracking-widest mb-2 font-medium">Get started</p>
            <h2 className="text-base font-semibold mb-1">Generate your first hook</h2>
            <p className="text-sm text-[#878a8f] mb-4">Paste any company URL and see a sourced opening line in under 30 seconds.</p>
            <Link href="/app/hooks" className="inline-flex items-center gap-2 text-sm text-[#eceae6] hover:text-white transition-colors group">
              Generate a hook
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          </div>

          {/* Example output card */}
          <div className="border border-[#252830] bg-[#14161a] rounded-xl p-5 mb-6 animate-stagger-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#878a8f]">Example output</p>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.5625rem] font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Tier A</span>
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.5625rem] font-medium border bg-violet-500/10 text-violet-300 border-violet-500/20">First-party</span>
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.5625rem] font-medium border bg-zinc-800 text-zinc-400 border-zinc-700/50">Fresh</span>
              </div>
            </div>
            <p className="text-sm leading-[1.65] text-[#eceae6] mb-3">
              "Noticed Notion just shipped AI-powered databases last week — curious whether your team is rethinking how you structure customer data, or doubling down on the existing stack."
            </p>
            <div className="border-t border-[#252830] pt-3 mt-3">
              <p className="text-[11px] text-[#878a8f]">
                <span className="font-medium text-zinc-500">Signal:</span> Notion · Product launch · notion.so/blog/ai-database
              </p>
            </div>
          </div>
        </>
      )}

      {/* Usage strip */}
      <div className="border border-[#252830] bg-[#14161a] rounded-xl p-5 mb-4 animate-stagger-1">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-[#878a8f] font-medium">Hooks this month</span>
          <span className="text-sm font-semibold tabular-nums">
            {hooksUsed}<span className="text-[#878a8f] font-normal"> / {limits.hooksPerMonth}</span>
          </span>
        </div>
        <div className="h-1.5 bg-[#252830] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${hooksPercent}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-[#878a8f]">{hooksPercent}% used</span>
          {resetDaysLeft !== null && (
            <span className="text-[11px] text-[#878a8f]">Resets in {resetDaysLeft} {resetDaysLeft === 1 ? "day" : "days"}</span>
          )}
        </div>
      </div>

      {/* Inline stats row */}
      <div className="flex items-center gap-6 px-1 mb-8 animate-stagger-2">
        <div>
          <p className="text-xs text-[#878a8f] mb-0.5">Leads</p>
          <p className="text-sm font-semibold tabular-nums">{leadCount?.count ?? 0}</p>
        </div>
        <div className="h-6 w-px bg-[#252830]" />
        <div>
          <p className="text-xs text-[#878a8f] mb-0.5">Emails (30d)</p>
          <p className="text-sm font-semibold tabular-nums">{emailsSent?.count ?? 0}</p>
        </div>
        <div className="h-6 w-px bg-[#252830]" />
        <div className="flex items-center gap-2">
          <div>
            <p className="text-xs text-[#878a8f] mb-0.5">Plan</p>
            <p className="text-sm font-semibold capitalize">{tierId}</p>
          </div>
          {isOnTrial && !trialExpired && <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">Trial</span>}
        </div>
      </div>

      {/* Primary action */}
      <div className="mb-3 animate-stagger-3">
        <Link href="/app/hooks" className="flex items-center justify-between bg-[#14161a] border border-[#252830] hover:border-violet-500/30 rounded-xl px-5 py-4 transition-colors group">
          <div>
            <p className="text-sm font-semibold group-hover:text-white transition-colors">Generate Hooks</p>
            <p className="text-xs text-[#878a8f] mt-0.5">Paste a company URL and get evidence-backed hooks in seconds.</p>
          </div>
          <span className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 ml-4">
            Start
          </span>
        </Link>
      </div>

      {/* Secondary actions */}
      <div className="flex flex-col border border-[#252830] rounded-xl overflow-hidden animate-stagger-4">
        <Link href="/app/leads" className="flex items-center justify-between px-5 py-3.5 hover:bg-[#1c1e20] transition-colors group border-b border-[#252830]">
          <span className="text-sm text-[#878a8f] group-hover:text-[#eceae6] transition-colors">Manage Leads</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#878a8f]"><path d="m9 18 6-6-6-6"/></svg>
        </Link>
        <Link href="/app/analytics" className="flex items-center justify-between px-5 py-3.5 hover:bg-[#1c1e20] transition-colors group">
          <span className="text-sm text-[#878a8f] group-hover:text-[#eceae6] transition-colors">View Analytics</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#878a8f]"><path d="m9 18 6-6-6-6"/></svg>
        </Link>
      </div>
    </div>
  );
}
