import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import { getLimits } from "@/lib/tier-guard";
import type { TierId } from "@/lib/tiers";
import Link from "next/link";

function formatRelativeDays(count: number) {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    user,
    leadCount,
    emailsSent,
    watchlistCount,
    watchlistSignals,
    activeSequences,
    queuedMessages,
    leadDrafts,
    watchlistDrafts,
    hotAccountsCount,
    topHotAccounts,
  ] = await Promise.all([
    db
      .select({
        hooksUsed: schema.users.hooksUsedThisMonth,
        tierId: schema.users.tierId,
        trialEndsAt: schema.users.trialEndsAt,
        stripeSubscriptionId: schema.users.stripeSubscriptionId,
        hooksResetAt: schema.users.hooksResetAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.leads)
      .where(eq(schema.leads.userId, userId))
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.outboundMessages)
      .where(
        and(
          sql`${schema.outboundMessages.leadId} IN (SELECT id FROM leads WHERE user_id = ${userId})`,
          eq(schema.outboundMessages.direction, "outbound"),
          eq(schema.outboundMessages.status, "sent"),
          gte(schema.outboundMessages.createdAt, thirtyDaysAgo),
        ),
      )
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.watchlist)
      .where(eq(schema.watchlist.userId, userId))
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.watchlist)
      .where(and(eq(schema.watchlist.userId, userId), gte(schema.watchlist.lastSignalAt, sevenDaysAgo)))
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.leadSequences)
      .where(
        and(
          eq(schema.leadSequences.status, "active"),
          sql`${schema.leadSequences.leadId} IN (SELECT id FROM leads WHERE user_id = ${userId})`,
        ),
      )
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.outboundMessages)
      .where(
        and(
          sql`${schema.outboundMessages.leadId} IN (SELECT id FROM leads WHERE user_id = ${userId})`,
          eq(schema.outboundMessages.direction, "outbound"),
          eq(schema.outboundMessages.status, "queued"),
        ),
      )
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.outboundMessages)
      .where(
        and(
          sql`${schema.outboundMessages.leadId} IN (SELECT id FROM leads WHERE user_id = ${userId})`,
          eq(schema.outboundMessages.direction, "outbound"),
          eq(schema.outboundMessages.status, "draft"),
        ),
      )
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.drafts)
      .where(and(eq(schema.drafts.userId, userId), sql`${schema.drafts.approved} IS NULL`))
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.leadScores)
      .innerJoin(schema.leads, eq(schema.leadScores.leadId, schema.leads.id))
      .where(and(eq(schema.leads.userId, userId), eq(schema.leadScores.temperature, "hot")))
      .then((rows) => rows[0]),
    db
      .select({
        id: schema.leads.id,
        companyName: schema.leads.companyName,
        email: schema.leads.email,
        score: schema.leadScores.score,
      })
      .from(schema.leadScores)
      .innerJoin(schema.leads, eq(schema.leadScores.leadId, schema.leads.id))
      .where(and(eq(schema.leads.userId, userId), eq(schema.leadScores.temperature, "hot")))
      .orderBy(desc(schema.leadScores.score))
      .limit(3),
  ]);

  const tierId = (user?.tierId as TierId) || "free";
  const limits = getLimits(tierId);
  const hooksUsed = user?.hooksUsed ?? 0;
  const hooksPercent = Math.min(100, Math.round((hooksUsed / limits.hooksPerMonth) * 100));
  const leadsTotal = leadCount?.count ?? 0;
  const draftsAwaitingApproval = (leadDrafts?.count ?? 0) + (watchlistDrafts?.count ?? 0);
  const sequencesRunning = activeSequences?.count ?? 0;
  const queuedDraftCount = queuedMessages?.count ?? 0;
  const watchlistTotal = watchlistCount?.count ?? 0;
  const recentSignals = watchlistSignals?.count ?? 0;
  const hotAccounts = hotAccountsCount?.count ?? 0;
  const emails30d = emailsSent?.count ?? 0;
  const isNewUser = hooksUsed === 0 && leadsTotal === 0 && draftsAwaitingApproval === 0;

  const isOnTrial = !user?.stripeSubscriptionId && !!user?.trialEndsAt;
  const trialDaysLeft = isOnTrial
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt!).getTime() - now) / (1000 * 60 * 60 * 24)))
    : 0;
  const trialExpired = isOnTrial && trialDaysLeft === 0;
  const resetDaysLeft = user?.hooksResetAt
    ? Math.max(0, Math.ceil((new Date(user.hooksResetAt).getTime() - now) / (1000 * 60 * 60 * 24)))
    : null;

  const progressColor = hooksPercent > 80
    ? "bg-gradient-to-r from-amber-500 to-red-500"
    : hooksPercent > 50
      ? "bg-gradient-to-r from-emerald-500 to-amber-500"
      : "bg-emerald-500";

  const nextAction = (() => {
    if (hooksUsed === 0) return {
      title: "Generate your first hook",
      body: "Start with one company and one buyer role. The goal is to leave this page with a signal-backed opener you can act on.",
      href: "/app/hooks",
      cta: "Generate hooks",
    };
    if (draftsAwaitingApproval > 0) return {
      title: "Approve the drafts waiting in Inbox",
      body: `${draftsAwaitingApproval} draft${draftsAwaitingApproval === 1 ? " is" : "s are"} ready for review. This is the fastest way to move from hooks into live outbound.`,
      href: "/app/inbox",
      cta: "Open inbox",
    };
    if (leadsTotal === 0) return {
      title: "Save your first lead",
      body: "Turn a good hook into a lead record so you can track replies, sequence progress, and follow-up status in one place.",
      href: "/app/hooks",
      cta: "Go back to Hooks",
    };
    if (sequencesRunning === 0) return {
      title: "Start a sequence from a saved lead",
      body: "You have leads in the system but no active sequences. Assign one lead so drafts start landing in Inbox for approval.",
      href: "/app/sequences",
      cta: "Open sequences",
    };
    if (watchlistTotal === 0) return {
      title: "Add companies to your watchlist",
      body: "Retention starts when fresh signals keep coming in. Add the accounts you want the product to monitor for you.",
      href: "/app/watchlist",
      cta: "Build watchlist",
    };
    return {
      title: "Review account timelines",
      body: "You already have hooks, leads, and active workflow coverage. Use Accounts to see which companies have fresh signals, linked contacts, and the clearest next move.",
      href: "/app/accounts",
      cta: "Open accounts",
    };
  })();

  const activationSteps = [
    { label: "Generate first hook", done: hooksUsed > 0, href: "/app/hooks" },
    { label: "Create email draft", done: draftsAwaitingApproval > 0 || queuedDraftCount > 0 || emails30d > 0, href: "/app/inbox" },
    { label: "Save first lead", done: leadsTotal > 0, href: "/app/leads" },
    { label: "Assign a sequence", done: sequencesRunning > 0 || queuedDraftCount > 0, href: "/app/sequences" },
    { label: "Review draft in Inbox", done: queuedDraftCount > 0 || emails30d > 0, href: "/app/inbox" },
  ];

  const actionCards = [
    {
      title: "Drafts awaiting approval",
      value: draftsAwaitingApproval,
      detail: draftsAwaitingApproval > 0 ? "Needs review now" : "No drafts waiting",
      href: "/app/inbox",
      cta: draftsAwaitingApproval > 0 ? "Review drafts" : "Open inbox",
    },
    {
      title: "Active sequences",
      value: sequencesRunning,
      detail: queuedDraftCount > 0 ? `${queuedDraftCount} queued for send` : "No queued messages right now",
      href: "/app/sequences",
      cta: sequencesRunning > 0 ? "Manage sequences" : "Start a sequence",
    },
    {
      title: "Hot accounts",
      value: hotAccounts,
      detail: hotAccounts > 0 ? "Prioritize these first" : "Score leads to surface heat",
      href: "/app/leads",
      cta: hotAccounts > 0 ? "Open leads" : "View lead list",
    },
    {
      title: "Recent watchlist signals",
      value: recentSignals,
      detail: watchlistTotal > 0 ? `${watchlistTotal} compan${watchlistTotal === 1 ? "y" : "ies"} watched` : "No watchlist coverage yet",
      href: "/app/watchlist",
      cta: watchlistTotal > 0 ? "Review watchlist" : "Add companies",
    },
  ];

  const productLoop = [
    {
      step: "01",
      title: "Prioritise accounts",
      body: "Use Accounts to find companies with fresh signals, linked contacts, and the clearest next action.",
      href: "/app/accounts",
      cta: "Open Accounts",
    },
    {
      step: "02",
      title: "Activate workflow",
      body: "Save the right lead and attach a sequence so the account moves into real outbound workflow.",
      href: "/app/leads",
      cta: "Manage Leads",
    },
    {
      step: "03",
      title: "Review execution",
      body: "Approve AI-generated drafts in Inbox so the next message is deliberate instead of automatic.",
      href: "/app/inbox",
      cta: "Open Inbox",
    },
    {
      step: "04",
      title: "Measure outcomes",
      body: "Use Analytics to spot queue pressure, stalled sequences, channel performance, and traction.",
      href: "/app/analytics",
      cta: "View Analytics",
    },
  ];

  return (
    <div className="space-y-6">
      {trialExpired && (
        <div className="border-b border-amber-800/60 bg-amber-950/30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 animate-fade-in">
          <p className="text-sm text-amber-300">
            Your free trial has ended. <Link href="/#pricing" className="underline underline-offset-2 hover:text-amber-200 font-medium">View plans →</Link>
          </p>
        </div>
      )}

      {isOnTrial && !trialExpired && trialDaysLeft <= 7 && (
        <div className="border-b border-amber-800/40 bg-amber-950/20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 animate-fade-in">
          <p className="text-sm text-amber-300/80">
            {formatRelativeDays(trialDaysLeft)} left on your free trial. <Link href="/#pricing" className="underline underline-offset-2 hover:text-amber-200">View plans →</Link>
          </p>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-2xl border border-[#252830] bg-[#14161a] p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#878a8f] mb-3">Command Center</p>
          <h1 className="text-2xl font-semibold text-white mb-2">{nextAction.title}</h1>
          <p className="text-sm leading-6 text-[#9ea2a8] max-w-2xl mb-5">{nextAction.body}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={nextAction.href} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
              {nextAction.cta}
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/app/hooks" className="inline-flex items-center gap-2 rounded-xl border border-[#2d3140] px-4 py-2.5 text-sm font-medium text-[#d8d6d2] hover:border-violet-500/30 hover:text-white transition-colors">
              Open Hooks control center
            </Link>
          </div>
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#737882] mb-3">Core Workflow</p>
            <div className="grid gap-2 sm:grid-cols-5">
              {activationSteps.map((step, index) => (
                <Link key={step.label} href={step.href} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-left hover:border-violet-500/20 transition-colors">
                  <p className={`text-[11px] font-semibold ${step.done ? "text-emerald-400" : "text-zinc-500"}`}>{step.done ? `0${index + 1} done` : `0${index + 1} next`}</p>
                  <p className="mt-1 text-sm text-[#eceae6]">{step.label}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#252830] bg-[#14161a] p-6">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-[#878a8f] font-medium">Hooks this month</span>
            <span className="text-sm font-semibold tabular-nums text-white">
              {hooksUsed}<span className="text-[#878a8f] font-normal"> / {limits.hooksPerMonth}</span>
            </span>
          </div>
          <div className="h-2 bg-[#252830] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${hooksPercent}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 mb-4">
            <span className="text-[11px] text-[#878a8f]">{hooksPercent}% used</span>
            {resetDaysLeft !== null && <span className="text-[11px] text-[#878a8f]">Resets in {formatRelativeDays(resetDaysLeft)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6f757d] mb-1">Plan</p>
              <p className="text-sm font-semibold capitalize text-white">{tierId}</p>
            </div>
            <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6f757d] mb-1">Emails sent</p>
              <p className="text-sm font-semibold text-white">{emails30d}</p>
            </div>
            <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6f757d] mb-1">Leads saved</p>
              <p className="text-sm font-semibold text-white">{leadsTotal}</p>
            </div>
            <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6f757d] mb-1">Watchlist</p>
              <p className="text-sm font-semibold text-white">{watchlistTotal}</p>
            </div>
          </div>
        </div>
      </section>

      {isNewUser && (
        <section className="rounded-2xl border border-[#252830] bg-[#14161a] p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#878a8f] mb-2">First Run</p>
          <h2 className="text-lg font-semibold text-white mb-1">Make the first loop real</h2>
          <p className="text-sm text-[#8f949b] mb-4">Generate one hook, turn it into one email, save one lead, then assign one sequence so Inbox has something to approve.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/app/hooks" className="inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-300 hover:bg-violet-500/15 transition-colors">Generate first hook</Link>
            <Link href="/app/sequences" className="inline-flex items-center gap-2 rounded-lg border border-[#2d3140] px-3 py-2 text-sm text-[#d7d4cf] hover:text-white hover:border-violet-500/20 transition-colors">Review sequence setup</Link>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {actionCards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-[#252830] bg-[#14161a] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#737882] mb-2">{card.title}</p>
            <p className="text-3xl font-semibold text-white mb-2">{card.value}</p>
            <p className="text-sm text-[#8c9198] mb-4 min-h-[40px]">{card.detail}</p>
            <Link href={card.href} className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors">{card.cta} →</Link>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#252830] bg-[#14161a] p-6">
        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#737882] mb-2">How GetSignalHooks Works</p>
          <h2 className="text-lg font-semibold text-white mb-2">One operating loop, four places to work from</h2>
          <p className="text-sm leading-6 text-[#8f949b] max-w-3xl">
            The product is strongest when you treat it as one connected loop: identify the best accounts, move them into workflow, review what is about to go out, then learn from the outcome.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {productLoop.map((item) => (
            <Link
              key={item.step}
              href={item.href}
              className="rounded-xl border border-white/[0.05] bg-black/20 p-5 hover:border-violet-500/20 transition-colors"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-300/80">{item.step}</p>
              <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#8f949b]">{item.body}</p>
              <p className="mt-4 text-sm font-medium text-violet-400">{item.cta} →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-[#252830] bg-[#14161a] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#737882] mb-1">Operating Surfaces</p>
              <h2 className="text-lg font-semibold text-white">Where to work next</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { href: "/app/hooks", title: "Hooks", body: "Generate hooks, compare angles, and kick off the workflow from one place." },
              { href: "/app/inbox", title: "Inbox", body: "Approve or reject drafts before anything sends." },
              { href: "/app/leads", title: "Leads", body: "Track saved contacts, heat, and where every account sits." },
              { href: "/app/watchlist", title: "Watchlist", body: "Monitor target accounts so fresh signals keep feeding the top of funnel." },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="rounded-xl border border-white/[0.05] bg-black/20 p-4 hover:border-violet-500/20 transition-colors">
                <p className="text-sm font-semibold text-white mb-1">{item.title}</p>
                <p className="text-sm text-[#8f949b]">{item.body}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#252830] bg-[#14161a] p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#737882] mb-2">Hot Accounts</p>
          <h2 className="text-lg font-semibold text-white mb-4">Accounts that deserve attention</h2>
          {topHotAccounts.length > 0 ? (
            <div className="space-y-3">
              {topHotAccounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-white/[0.05] bg-black/20 px-4 py-3">
                  <p className="text-sm font-medium text-white">{account.companyName || account.email}</p>
                  <p className="text-xs text-[#8f949b] mt-1">Intent score {account.score}</p>
                </div>
              ))}
              <Link href="/app/analytics" className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors">Open analytics →</Link>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-4 py-5">
              <p className="text-sm text-[#8f949b] mb-3">No hot accounts yet. Save leads and score them to surface who needs action first.</p>
              <Link href="/app/leads" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">Open leads →</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
