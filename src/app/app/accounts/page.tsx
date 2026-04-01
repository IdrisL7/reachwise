import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getAccountHealthForAccounts,
  getAccountWorkflowStatus,
  getAccountsV2Overview,
  getLatestAccountNotesV2,
  getV2BackfillStatus,
  getContactsV2ForAccounts,
  getMessagesV2ForAccounts,
  getOutcomesV2ForAccounts,
  getSignalsV2ForAccounts,
  isAccountNotesV2Ready,
  isV2BackboneReady,
} from "@/lib/v2-reader";

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toneForSourceType(sourceType: string) {
  if (sourceType === "first_party") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (sourceType === "trusted_news") return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  if (sourceType === "semantic_web") return "border-violet-500/20 bg-violet-500/10 text-violet-300";
  return "border-amber-500/20 bg-amber-500/10 text-amber-300";
}

function buildHooksHref(account: { website: string | null; domain: string | null; companyName: string }) {
  const params = new URLSearchParams();
  if (account.website) {
    params.set("url", account.website);
  } else if (account.domain) {
    params.set("url", `https://${account.domain}`);
  } else {
    params.set("companyName", account.companyName);
  }
  return `/app/hooks?${params.toString()}`;
}

function buildLeadHref(account: { website: string | null; companyName: string }) {
  const params = new URLSearchParams();
  params.set("add", "1");
  if (account.companyName) params.set("companyName", account.companyName);
  if (account.website) params.set("companyWebsite", account.website);
  return `/app/leads?${params.toString()}`;
}

function getAccountNextAction(params: {
  signalsCount: number;
  contactsCount: number;
  messagesCount: number;
  outcomesCount: number;
  activeSequences: number;
  queuedMessages: number;
  draftMessages: number;
}) {
  if (params.signalsCount === 0) {
    return {
      label: "Generate hooks",
      detail: "No fresh signal captured yet.",
      hrefType: "hooks" as const,
    };
  }
  if (params.contactsCount === 0) {
    return {
      label: "Save a lead",
      detail: "This account has signal, but no contact attached to workflow yet.",
      hrefType: "lead" as const,
    };
  }
  if (params.activeSequences === 0) {
    return {
      label: "Start sequence",
      detail: "You have contact coverage, but no active sequence attached yet.",
      hrefType: "leads" as const,
    };
  }
  if (params.draftMessages > 0 || params.queuedMessages > 0) {
    return {
      label: "Review inbox",
      detail: `${params.draftMessages + params.queuedMessages} draft${params.draftMessages + params.queuedMessages === 1 ? "" : "s"} waiting in workflow.`,
      hrefType: "inbox" as const,
    };
  }
  if (params.messagesCount === 0) {
    return {
      label: "Generate hooks",
      detail: "Sequence exists, but this account still needs fresh outreach generated.",
      hrefType: "hooks" as const,
    };
  }
  if (params.outcomesCount === 0) {
    return {
      label: "Review account",
      detail: "Messages exist, but nothing has landed as an outcome yet.",
      hrefType: "inbox" as const,
    };
  }
  return {
    label: "Review account",
    detail: "This account already has signal, workflow, and outcome history.",
    hrefType: "hooks" as const,
  };
}

function getAccountSecondaryAction(account: {
  companyName: string;
  website: string | null;
  domain: string | null;
}, params: {
  contactsCount: number;
  activeSequences: number;
  draftMessages: number;
  queuedMessages: number;
}) {
  if (params.contactsCount === 0) {
    return {
      label: "Save a lead",
      href: buildLeadHref(account),
    };
  }
  if (params.activeSequences === 0) {
    return {
      label: "Start sequence",
      href: "/app/leads",
    };
  }
  if (params.draftMessages > 0 || params.queuedMessages > 0) {
    return {
      label: "Review inbox",
      href: "/app/inbox",
    };
  }
  return {
    label: "Open leads",
    href: "/app/leads",
  };
}

function getRecencyWeight(dateValue: string | null) {
  if (!dateValue) return 0;
  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) return 0;
  const daysOld = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  if (daysOld <= 3) return 12;
  if (daysOld <= 7) return 8;
  if (daysOld <= 14) return 5;
  return 2;
}

function getUrgencyScore(params: {
  accountStatus: string;
  priority: string;
  signalsCount: number;
  contactsCount: number;
  activeSequences: number;
  draftMessages: number;
  queuedMessages: number;
  outcomesCount: number;
  lastSignalAt: string | null;
}) {
  let score = 0;

  if (params.priority === "high") score += 10;
  if (params.accountStatus === "contacted") score += 4;
  if (params.signalsCount > 0) score += 10;
  if (params.contactsCount === 0 && params.signalsCount > 0) score += 18;
  if (params.contactsCount > 0 && params.activeSequences === 0) score += 16;
  if (params.draftMessages > 0) score += 22;
  if (params.queuedMessages > 0) score += 26;
  if (params.outcomesCount === 0 && (params.signalsCount > 0 || params.contactsCount > 0)) score += 6;
  score += getRecencyWeight(params.lastSignalAt);

  return score;
}

function getUrgencyLabel(score: number) {
  if (score >= 40) {
    return {
      label: "Urgent",
      className: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    };
  }
  if (score >= 24) {
    return {
      label: "Active",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    };
  }
  return {
    label: "Monitor",
    className: "border-white/10 bg-white/[0.04] text-slate-300",
  };
}

function matchesWorkflowFilter(params: {
  filter: string;
  signalsCount: number;
  linkedLeads: number;
  activeSequences: number;
  waitingCount: number;
  outcomesCount: number;
  urgencyLabel: string;
}) {
  switch (params.filter) {
    case "needs_signal":
      return params.signalsCount === 0;
    case "needs_lead":
      return params.signalsCount > 0 && params.linkedLeads === 0;
    case "needs_sequence":
      return params.linkedLeads > 0 && params.activeSequences === 0;
    case "waiting":
      return params.waitingCount > 0;
    case "active":
      return params.urgencyLabel === "Active" || params.urgencyLabel === "Urgent";
    case "has_outcomes":
      return params.outcomesCount > 0;
    default:
      return true;
  }
}

function buildAccountsFilterHref(q: string, filter: string) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (filter !== "all") params.set("filter", filter);
  const query = params.toString();
  return query ? `/app/accounts?${query}` : "/app/accounts";
}

function truncateNote(value: string, maxLength = 140) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function formatOutcomeLabel(value: string | null) {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

function getTouchHealth(dateValue: string | null) {
  if (!dateValue) {
    return {
      label: "No touch",
      className: "border-white/10 bg-white/[0.04] text-slate-300",
    };
  }
  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) {
    return {
      label: "Unknown",
      className: "border-white/10 bg-white/[0.04] text-slate-300",
    };
  }
  const daysOld = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  if (daysOld <= 3) {
    return {
      label: "Fresh touch",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }
  if (daysOld <= 10) {
    return {
      label: "Recent touch",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    };
  }
  return {
    label: "Stale touch",
    className: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  };
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = (resolvedSearchParams.q ?? "").trim().toLowerCase();
  const workflowFilter = resolvedSearchParams.filter ?? "all";

  const ready = await isV2BackboneReady();
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#030014] px-6 py-8 text-white sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_34%),linear-gradient(135deg,_rgba(13,15,26,0.98),_rgba(9,11,20,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-violet-300/80">
                  Accounts workspace
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Accounts
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  This page is powered by the new account backbone. Once the migration is active, it becomes the cleanest place to review signals, messages, and next actions per company.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/app/hooks" className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                  Generate Hooks
                </Link>
                <Link href="/app/leads" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                  Open Leads
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <h3 className="text-lg font-bold text-white">Accounts backbone not ready yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
              The additive v2 tables are not available in this environment yet. Generate hooks and save leads as normal, then reload this page after the migration is applied.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/app/hooks" className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                Generate Hooks
              </Link>
              <Link href="/app/watchlist" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                Open Watchlist
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const [accounts, backfillStatus] = await Promise.all([
    getAccountsV2Overview(24, session.user.id),
    getV2BackfillStatus(session.user.id),
  ]);
  const accountIds = accounts.map((account) => account.id);
  const notesReady = await isAccountNotesV2Ready();
  const [messages, outcomes, signalRows, contactRows] = await Promise.all([
    getMessagesV2ForAccounts(accountIds, 4),
    getOutcomesV2ForAccounts(accountIds, 6),
    getSignalsV2ForAccounts(accountIds, 3),
    getContactsV2ForAccounts(accountIds),
  ]);
  const [workflowRows, healthRows] = await Promise.all([
    getAccountWorkflowStatus(accountIds),
    getAccountHealthForAccounts(accountIds),
  ]);
  const latestNotes = notesReady
    ? await getLatestAccountNotesV2(accountIds, session.user.id)
    : [];

  const signalsByAccount = new Map<string, typeof signalRows>();
  const contactsByAccount = new Map<string, typeof contactRows>();
  const messagesByAccount = new Map<string, typeof messages>();
  const outcomesByAccount = new Map<string, typeof outcomes>();
  const workflowByAccount = new Map<string, (typeof workflowRows)[number]>();
  const latestNoteByAccount = new Map<string, (typeof latestNotes)[number]>();
  const healthByAccount = new Map<string, (typeof healthRows)[number]>();

  for (const signal of signalRows) {
    const bucket = signalsByAccount.get(signal.accountId) ?? [];
    bucket.push(signal);
    signalsByAccount.set(signal.accountId, bucket);
  }
  for (const contact of contactRows) {
    const bucket = contactsByAccount.get(contact.accountId) ?? [];
    bucket.push(contact);
    contactsByAccount.set(contact.accountId, bucket);
  }
  for (const message of messages) {
    const bucket = messagesByAccount.get(message.accountId) ?? [];
    bucket.push(message);
    messagesByAccount.set(message.accountId, bucket);
  }
  for (const outcome of outcomes) {
    const bucket = outcomesByAccount.get(outcome.accountId) ?? [];
    bucket.push(outcome);
    outcomesByAccount.set(outcome.accountId, bucket);
  }
  for (const workflow of workflowRows) {
    workflowByAccount.set(workflow.accountId, workflow);
  }
  for (const note of latestNotes) {
    latestNoteByAccount.set(note.accountId, note);
  }
  for (const health of healthRows) {
    healthByAccount.set(health.accountId, health);
  }

  const watchedCount = accounts.filter((account) => account.status === "watching").length;
  const contactedCount = accounts.filter((account) => account.status === "contacted").length;
  const rankedAccounts = accounts
    .map((account) => {
      const workflow = workflowByAccount.get(account.id) ?? {
        accountId: account.id,
        linkedLeads: 0,
        activeSequences: 0,
        draftMessages: 0,
        queuedMessages: 0,
      };
      const signalsCount = (signalsByAccount.get(account.id) ?? []).length;
      const outcomesCount = (outcomesByAccount.get(account.id) ?? []).length;
      const urgencyScore = getUrgencyScore({
        accountStatus: account.status,
        priority: account.priority,
        signalsCount,
        contactsCount: workflow.linkedLeads,
        activeSequences: workflow.activeSequences,
        draftMessages: workflow.draftMessages,
        queuedMessages: workflow.queuedMessages,
        outcomesCount,
        lastSignalAt: account.lastSignalAt,
      });

      return {
        account,
        workflow,
        urgencyScore,
        urgency: getUrgencyLabel(urgencyScore),
      };
    })
    .sort((a, b) => {
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
      const aSignal = Date.parse(a.account.lastSignalAt || "") || 0;
      const bSignal = Date.parse(b.account.lastSignalAt || "") || 0;
      return bSignal - aSignal;
    });
  const filteredAccounts = rankedAccounts.filter(({ account, workflow, urgency, urgencyScore }) => {
    const accountSignals = signalsByAccount.get(account.id) ?? [];
    const accountOutcomes = outcomesByAccount.get(account.id) ?? [];
    const searchHaystack = [account.companyName, account.domain, account.website]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = query.length === 0 || searchHaystack.includes(query);
    const matchesFilter = matchesWorkflowFilter({
      filter: workflowFilter,
      signalsCount: accountSignals.length,
      linkedLeads: workflow.linkedLeads,
      activeSequences: workflow.activeSequences,
      waitingCount: workflow.draftMessages + workflow.queuedMessages,
      outcomesCount: accountOutcomes.length,
      urgencyLabel: urgency.label,
    });

    if (!matchesQuery || !matchesFilter) return false;
    return urgencyScore >= 0;
  });
  const spotlightAccounts = filteredAccounts.filter((entry) => entry.urgencyScore >= 24).slice(0, 3);
  const filterOptions = [
    { value: "all", label: "All accounts" },
    { value: "needs_signal", label: "Needs signal" },
    { value: "needs_lead", label: "Needs lead" },
    { value: "needs_sequence", label: "Needs sequence" },
    { value: "waiting", label: "Waiting drafts" },
    { value: "active", label: "Active or urgent" },
    { value: "has_outcomes", label: "Has outcomes" },
  ];

  return (
    <div className="min-h-screen bg-[#030014] px-6 py-8 text-white sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_34%),linear-gradient(135deg,_rgba(13,15,26,0.98),_rgba(9,11,20,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-violet-300/80">
                Accounts workspace
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Accounts
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                This is the new account-centric surface: one place to review company signals, generated messages, linked contacts, and the next workflow move without bouncing across separate tools.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/app/hooks" className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                Generate Hooks
              </Link>
              <Link href="/app/inbox" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                Review Inbox
              </Link>
              <Link href="/app/leads" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                Open Leads
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Accounts", value: String(backfillStatus.accountCount), tone: "border-violet-500/20 bg-violet-500/[0.08] text-violet-200" },
              { label: "Signals", value: String(backfillStatus.signalCount), tone: "border-teal-500/20 bg-teal-500/[0.08] text-teal-200" },
              { label: "Messages", value: String(backfillStatus.messageCount), tone: "border-amber-500/20 bg-amber-500/[0.08] text-amber-200" },
              { label: "Contacted", value: String(contactedCount), tone: "border-white/10 bg-white/[0.03] text-slate-200" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-2xl border p-4 ${stat.tone}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-inherit/70">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Coverage</h2>
              <p className="mt-1 text-sm text-slate-400">
                A quick read on how much of your account history is already in the new backbone versus still waiting on new activity.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{watchedCount} watching</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{backfillStatus.backfilledMessageCount} backfilled messages</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{backfillStatus.outcomeCount} outcomes</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-slate-300">
              {backfillStatus.backfilledMessageCount > 0 || backfillStatus.backfilledOutcomeCount > 0
                ? "Historic account timeline data has been backfilled. Fresh hook generations and follow-up activity will keep enriching this view automatically."
                : "This page is live, but the timeline is still mostly forward-filled from recent hook generation and follow-up activity."}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-white">Company timelines</h2>
            <p className="mt-1 text-sm text-slate-400">
              Use this view to move from company signal to next action faster. Accounts are ranked by urgency so the strongest workflow opportunities rise first.
            </p>
          </div>
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:flex-row lg:items-end lg:justify-between">
            <form className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Search accounts</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={resolvedSearchParams.q ?? ""}
                  placeholder="Search company, domain, or website"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60"
                />
              </label>
              <label className="sm:min-w-[220px]">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Workflow filter</span>
                <select
                  name="filter"
                  defaultValue={workflowFilter}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400/60"
                >
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#0B0F1A] text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                Apply
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {filterOptions.slice(0, 5).map((option) => (
                <Link
                  key={option.value}
                  href={buildAccountsFilterHref(resolvedSearchParams.q ?? "", option.value)}
                  className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    workflowFilter === option.value
                      ? "border-violet-400/50 bg-violet-500/10 text-violet-200"
                      : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
        {filteredAccounts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <h3 className="text-lg font-bold text-white">
              {accounts.length === 0 ? "No accounts projected yet" : "No accounts match this view"}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
              {accounts.length === 0
                ? "Generate hooks, save leads, or add companies to Watchlist. Those actions start building a cleaner account timeline here."
                : "Try a broader search or switch the workflow filter to a different slice of the account list."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/app/hooks" className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                Generate Hooks
              </Link>
              {accounts.length > 0 ? (
                <Link href="/app/accounts" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                  Clear filters
                </Link>
              ) : null}
              <Link href="/app/watchlist" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                Open Watchlist
              </Link>
              <Link href="/app/leads" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                Open Leads
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {spotlightAccounts.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {spotlightAccounts.map(({ account, urgency, urgencyScore }) => (
                  <div key={`spotlight-${account.id}`} className="rounded-2xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(11,15,26,0.95))] p-4">
                    {healthByAccount.get(account.id)?.lastPositiveOutcomeType ? (
                      <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300/80">Recent traction</p>
                        <p className="mt-2 text-sm leading-5 text-white">
                          {formatOutcomeLabel(healthByAccount.get(account.id)?.lastPositiveOutcomeType ?? null)} on{" "}
                          {formatDate(healthByAccount.get(account.id)?.lastPositiveOutcomeAt ?? null)}
                        </p>
                      </div>
                    ) : null}
                    {latestNoteByAccount.get(account.id) ? (
                      <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/80">Why this matters</p>
                        <p className="mt-2 text-sm leading-5 text-white">
                          {truncateNote(latestNoteByAccount.get(account.id)!.body, 120)}
                        </p>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{account.companyName}</p>
                        <p className="mt-1 text-xs text-slate-400">{account.domain ?? account.website ?? "No domain yet"}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${urgency.className}`}>
                        {urgency.label}
                      </span>
                    </div>
                    <p className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] text-amber-300/80">Urgency score</p>
                    <p className="mt-1 text-2xl font-bold text-white">{urgencyScore}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/app/accounts/${account.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
                      >
                        Open account
                      </Link>
                      <Link
                        href="/app/inbox"
                        className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        Review inbox
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {filteredAccounts.map(({ account, workflow, urgencyScore, urgency }, index) => {
              const accountSignals = signalsByAccount.get(account.id) ?? [];
              const accountContacts = contactsByAccount.get(account.id) ?? [];
              const accountMessages = messagesByAccount.get(account.id) ?? [];
              const accountOutcomes = outcomesByAccount.get(account.id) ?? [];
              const hooksHref = buildHooksHref(account);
              const leadHref = buildLeadHref(account);
              const nextAction = getAccountNextAction({
                signalsCount: accountSignals.length,
                contactsCount: accountContacts.length,
                messagesCount: accountMessages.length,
                outcomesCount: accountOutcomes.length,
                activeSequences: workflow.activeSequences,
                queuedMessages: workflow.queuedMessages,
                draftMessages: workflow.draftMessages,
              });
              const primaryHref =
                nextAction.hrefType === "lead"
                  ? leadHref
                  : nextAction.hrefType === "leads"
                    ? "/app/leads"
                    : nextAction.hrefType === "inbox"
                      ? "/app/inbox"
                      : hooksHref;
              const secondaryAction = getAccountSecondaryAction(account, {
                contactsCount: workflow.linkedLeads,
                activeSequences: workflow.activeSequences,
                draftMessages: workflow.draftMessages,
                queuedMessages: workflow.queuedMessages,
              });
              const latestNote = latestNoteByAccount.get(account.id);
              const health = healthByAccount.get(account.id);
              const touchHealth = getTouchHealth(health?.lastTouchAt ?? null);

              return (
                <div key={account.id} className={`rounded-2xl border bg-black/20 p-5 ${index < 3 ? "border-amber-500/15 shadow-[0_0_0_1px_rgba(245,158,11,0.06)]" : "border-white/5"}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/app/accounts/${account.id}`} className="text-lg font-semibold text-white transition hover:text-violet-200">
                          {account.companyName}
                        </Link>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                          {account.status}
                        </span>
                        {account.priority === "high" ? (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                            High priority
                          </span>
                        ) : null}
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${urgency.className}`}>
                          {urgency.label}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${touchHealth.className}`}>
                          {touchHealth.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{account.domain ?? account.website ?? "No domain yet"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${accountSignals.length > 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
                          {accountSignals.length > 0 ? `${accountSignals.length} signal${accountSignals.length === 1 ? "" : "s"}` : "No signal"}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${workflow.linkedLeads > 0 ? "border-sky-500/20 bg-sky-500/10 text-sky-300" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
                          {workflow.linkedLeads > 0 ? `${workflow.linkedLeads} lead${workflow.linkedLeads === 1 ? "" : "s"}` : "No lead"}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${workflow.activeSequences > 0 ? "border-violet-500/20 bg-violet-500/10 text-violet-300" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
                          {workflow.activeSequences > 0 ? `${workflow.activeSequences} sequence${workflow.activeSequences === 1 ? "" : "s"}` : "No sequence"}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${workflow.draftMessages + workflow.queuedMessages > 0 ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
                          {workflow.draftMessages + workflow.queuedMessages > 0
                            ? `${workflow.draftMessages + workflow.queuedMessages} waiting`
                            : "No drafts"}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${accountOutcomes.length > 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
                          {accountOutcomes.length > 0 ? `${accountOutcomes.length} outcome${accountOutcomes.length === 1 ? "" : "s"}` : "No outcome"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{nextAction.detail}</p>
                      {latestNote ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Latest note</p>
                          <p className="mt-2 text-sm leading-5 text-slate-200">
                            {truncateNote(latestNote.body)}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-500">{formatDate(latestNote.createdAt)}</p>
                        </div>
                      ) : notesReady ? (
                        <p className="mt-3 text-[11px] text-slate-500">
                          No human note yet. Add context from the account detail page when there is something worth carrying forward.
                        </p>
                      ) : null}
                      {health?.lastOutcomeType || health?.lastPositiveOutcomeType ? (
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          {health.lastOutcomeType ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                              Last outcome: {formatOutcomeLabel(health.lastOutcomeType)}{health.lastOutcomeAt ? ` • ${formatDate(health.lastOutcomeAt ?? null)}` : ""}
                            </span>
                          ) : null}
                          {health.lastPositiveOutcomeType ? (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                              Traction: {formatOutcomeLabel(health.lastPositiveOutcomeType)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-3 lg:items-end">
                      <div className="flex flex-col gap-3 text-sm text-slate-400 lg:items-end">
                        <div className="lg:text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last touch</p>
                          <p className="mt-1 text-slate-200">{formatDate(health?.lastTouchAt ?? null)}</p>
                        </div>
                        <div className="lg:text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last signal</p>
                          <p className="mt-1 text-slate-200">{formatDate(account.lastSignalAt)}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 lg:min-w-[110px] lg:text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Urgency score</p>
                          <p className="mt-1 text-lg font-semibold text-white">{urgencyScore}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={primaryHref}
                          className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
                        >
                          {nextAction.label}
                        </Link>
                        <Link
                          href={secondaryAction.href}
                          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                        >
                          {secondaryAction.label}
                        </Link>
                        <Link
                          href="/app/inbox"
                          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                        >
                          Review Inbox
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
                    <div className="rounded-xl border border-white/5 bg-[#0B0F1A] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Recent signals</p>
                      {accountSignals.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {accountSignals.map((signal) => (
                            <div key={signal.id} className="rounded-lg border border-white/5 bg-black/20 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneForSourceType(signal.sourceType)}`}>
                                  {signal.sourceType.replace("_", " ")}
                                </span>
                                {signal.triggerType ? (
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                    {signal.triggerType}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm font-medium text-white">{signal.title || signal.snippet || signal.sourceUrl}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatDate(signal.publishedAt || signal.createdAt)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No account-level signals yet. Generate a fresh hook to start the timeline.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/5 bg-[#0B0F1A] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Recent messages</p>
                      {accountMessages.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {accountMessages.map((message) => (
                            <div key={message.id} className="rounded-lg border border-white/5 bg-black/20 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                  {message.kind}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                  {message.stage}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-white">
                                {message.body.length > 140 ? `${message.body.slice(0, 140)}…` : message.body}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">{formatDate(message.createdAt)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No messages yet. Use Hooks to generate the first outreach angle.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/5 bg-[#0B0F1A] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Contacts & outcomes</p>
                      {accountContacts.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {accountContacts.slice(0, 3).map((contact) => (
                            <div key={contact.leadId} className="rounded-lg border border-white/5 bg-black/20 p-3">
                              <p className="text-sm font-medium text-white">{contact.name || contact.email}</p>
                              <p className="mt-1 text-xs text-slate-400">{contact.title || "No title"}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No linked leads yet. Save a lead from a strong hook to keep the workflow attached to this account.</p>
                      )}

                      <div className="mt-5 border-t border-white/5 pt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Recent outcomes</p>
                        {accountOutcomes.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {accountOutcomes.slice(0, 4).map((outcome) => (
                              <div key={outcome.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                                <span className="text-xs font-medium text-white">{outcome.eventType.replace("_", " ")}</span>
                                <span className="text-[11px] text-slate-500">{formatDate(outcome.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">No outcomes yet. Once hooks are used or follow-ups run, this account timeline will deepen automatically.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </section>

        <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-white">What this replaces over time</h2>
            <p className="mt-1 text-sm text-slate-400">
              The goal is not another dashboard. It is a cleaner center of gravity for the whole workflow.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Signals",
                body: "Fresh company movement should be readable here before you jump into hook generation.",
              },
              {
                title: "Messages",
                body: "Generated hooks, follow-ups, and approvals should feel like one account timeline, not separate tools.",
              },
              {
                title: "Next action",
                body: "Every strong account should point you toward the right next move: generate, save, sequence, or approve.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/5 bg-[#0B0F1A] p-5">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
