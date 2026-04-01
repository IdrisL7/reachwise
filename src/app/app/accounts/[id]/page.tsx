import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createAccountNoteV2,
  getAccountHealthForAccounts,
  getAccountV2Detail,
  getAccountNotesV2,
  getAccountWorkflowStatus,
  getContactsV2ForAccounts,
  getMessagesV2ForAccounts,
  getOutcomesV2ForAccounts,
  getSignalsV2ForAccounts,
  isAccountNotesV2Ready,
  isV2BackboneReady,
  updateAccountV2StatusPriority,
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

function getNextAction(params: {
  signalsCount: number;
  contactsCount: number;
  activeSequences: number;
  draftMessages: number;
  queuedMessages: number;
  outcomesCount: number;
}) {
  if (params.signalsCount === 0) {
    return { label: "Generate hooks", hrefType: "hooks" as const, detail: "No fresh signal captured yet." };
  }
  if (params.contactsCount === 0) {
    return { label: "Save a lead", hrefType: "lead" as const, detail: "Signal exists, but no contact is in workflow yet." };
  }
  if (params.activeSequences === 0) {
    return { label: "Start sequence", hrefType: "leads" as const, detail: "Contact coverage exists, but no active sequence is attached yet." };
  }
  if (params.draftMessages > 0 || params.queuedMessages > 0) {
    return {
      label: "Review inbox",
      hrefType: "inbox" as const,
      detail: `${params.draftMessages + params.queuedMessages} draft${params.draftMessages + params.queuedMessages === 1 ? "" : "s"} waiting in workflow.`,
    };
  }
  if (params.outcomesCount === 0) {
    return { label: "Refresh signal", hrefType: "hooks" as const, detail: "Messages exist, but this account has not produced outcomes yet." };
  }
  return { label: "Generate fresh hooks", hrefType: "hooks" as const, detail: "This account has signal and workflow history. Refresh outreach with a new angle." };
}

function getQuickActions(params: {
  hooksHref: string;
  leadHref: string;
  contactsCount: number;
  activeSequences: number;
  waitingCount: number;
  signalsCount: number;
}) {
  const actions: Array<{
    label: string;
    href: string;
    tone: "primary" | "secondary";
    detail: string;
  }> = [
    {
      label: params.signalsCount > 0 ? "Generate fresh hooks" : "Generate hooks",
      href: params.hooksHref,
      tone: "primary" as const,
      detail: params.signalsCount > 0 ? "Refresh this account with a new angle." : "Create the first signal and hook for this account.",
    },
  ];

  if (params.contactsCount === 0) {
    actions.push({
      label: "Save lead",
      href: params.leadHref,
      tone: "secondary" as const,
      detail: "Open a prefilled lead form for this company.",
    });
  } else if (params.activeSequences === 0) {
    actions.push({
      label: "Start sequence",
      href: "/app/leads",
      tone: "secondary" as const,
      detail: "Move this account from contact coverage into workflow.",
    });
  }

  if (params.waitingCount > 0) {
    actions.push({
      label: "Open waiting draft",
      href: "/app/inbox",
      tone: "secondary" as const,
      detail: "Review the draft already waiting in Inbox.",
    });
  } else {
    actions.push({
      label: "Review inbox",
      href: "/app/inbox",
      tone: "secondary" as const,
      detail: "Jump into the current approval queue.",
    });
  }

  return actions;
}

function formatOutcomeLabel(value: string | null) {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

function getTouchHealth(dateValue: string | null) {
  if (!dateValue) {
    return {
      label: "No recent touch",
      className: "border-white/10 bg-white/[0.04] text-slate-300",
    };
  }
  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) {
    return {
      label: "Unknown touch",
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

async function saveAccountContextAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) return;

  const accountId = String(formData.get("accountId") || "");
  const status = String(formData.get("status") || "") as "watching" | "active" | "contacted" | "archived";
  const priority = String(formData.get("priority") || "") as "low" | "normal" | "high";
  if (!accountId) return;

  await updateAccountV2StatusPriority({
    accountId,
    userId: session.user.id,
    status,
    priority,
  });

  revalidatePath(`/app/accounts/${accountId}`);
  revalidatePath("/app/accounts");
}

async function addAccountNoteAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) return;

  const accountId = String(formData.get("accountId") || "");
  const body = String(formData.get("body") || "");
  if (!accountId || !body.trim()) return;

  await createAccountNoteV2({
    accountId,
    userId: session.user.id,
    body,
  });

  revalidatePath(`/app/accounts/${accountId}`);
  revalidatePath("/app/accounts");
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const ready = await isV2BackboneReady();
  if (!ready) {
    return notFound();
  }

  const { id } = await params;
  const account = await getAccountV2Detail(id, session.user.id);
  if (!account) {
    return notFound();
  }

  const [signals, contacts, messages, outcomes, workflowRows] = await Promise.all([
    getSignalsV2ForAccounts([account.id], 12),
    getContactsV2ForAccounts([account.id]),
    getMessagesV2ForAccounts([account.id], 12),
    getOutcomesV2ForAccounts([account.id], 12),
    getAccountWorkflowStatus([account.id]),
  ]);
  const notesReady = await isAccountNotesV2Ready();
  const notes = notesReady ? await getAccountNotesV2(account.id, session.user.id, 8) : [];
  const health = (await getAccountHealthForAccounts([account.id]))[0] ?? null;

  const workflow = workflowRows[0] ?? {
    accountId: account.id,
    linkedLeads: 0,
    activeSequences: 0,
    draftMessages: 0,
    queuedMessages: 0,
  };

  const urgencyScore = getUrgencyScore({
    accountStatus: account.status,
    priority: account.priority,
    signalsCount: signals.length,
    contactsCount: workflow.linkedLeads,
    activeSequences: workflow.activeSequences,
    draftMessages: workflow.draftMessages,
    queuedMessages: workflow.queuedMessages,
    outcomesCount: outcomes.length,
    lastSignalAt: account.lastSignalAt,
  });
  const urgency = getUrgencyLabel(urgencyScore);
  const nextAction = getNextAction({
    signalsCount: signals.length,
    contactsCount: workflow.linkedLeads,
    activeSequences: workflow.activeSequences,
    draftMessages: workflow.draftMessages,
    queuedMessages: workflow.queuedMessages,
    outcomesCount: outcomes.length,
  });

  const hooksHref = buildHooksHref(account);
  const leadHref = buildLeadHref(account);
  const primaryHref =
    nextAction.hrefType === "lead"
      ? leadHref
      : nextAction.hrefType === "leads"
        ? "/app/leads"
        : nextAction.hrefType === "inbox"
        ? "/app/inbox"
          : hooksHref;
  const quickActions = getQuickActions({
    hooksHref,
    leadHref,
    contactsCount: workflow.linkedLeads,
    activeSequences: workflow.activeSequences,
    waitingCount: workflow.draftMessages + workflow.queuedMessages,
    signalsCount: signals.length,
  });
  const touchHealth = getTouchHealth(health?.lastTouchAt ?? null);
  const activityFeed = [
    ...signals.map((signal) => ({
      id: `signal-${signal.id}`,
      type: "Signal",
      title: signal.title || signal.snippet || signal.sourceUrl,
      subtitle: [signal.sourceType.replace("_", " "), signal.triggerType, signal.freshness].filter(Boolean).join(" • "),
      occurredAt: signal.publishedAt || signal.createdAt,
      tone: toneForSourceType(signal.sourceType),
    })),
    ...messages.map((message) => ({
      id: `message-${message.id}`,
      type: "Message",
      title: message.body.length > 160 ? `${message.body.slice(0, 160)}…` : message.body,
      subtitle: [message.kind, message.stage, message.channel].filter(Boolean).join(" • "),
      occurredAt: message.createdAt,
      tone: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    })),
    ...outcomes.map((outcome) => ({
      id: `outcome-${outcome.id}`,
      type: "Outcome",
      title: formatOutcomeLabel(outcome.eventType) || outcome.eventType,
      subtitle: outcome.messageId ? "Linked to message history" : "Account-level outcome",
      occurredAt: outcome.createdAt,
      tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    })),
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      type: "Note",
      title: note.body.length > 160 ? `${note.body.slice(0, 160)}…` : note.body,
      subtitle: "Human context",
      occurredAt: note.createdAt,
      tone: "border-white/10 bg-white/[0.06] text-slate-200",
    })),
  ]
    .sort((a, b) => (Date.parse(b.occurredAt || "") || 0) - (Date.parse(a.occurredAt || "") || 0))
    .slice(0, 16);

  return (
    <div className="min-h-screen bg-[#030014] px-6 py-8 text-white sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_34%),linear-gradient(135deg,_rgba(13,15,26,0.98),_rgba(9,11,20,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Link href="/app/accounts" className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-300/80 transition hover:text-violet-200">
                  Accounts
                </Link>
                <span className="text-slate-600">/</span>
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Detail</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {account.companyName}
                </h1>
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
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                {account.domain ?? account.website ?? "No domain yet"}{" "}
                <span className="text-slate-500">•</span> {nextAction.detail}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={primaryHref} className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                {nextAction.label}
              </Link>
              <Link href={hooksHref} className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                Generate hooks
              </Link>
              <Link href="/app/inbox" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                Review inbox
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Signals", value: String(signals.length), tone: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-200" },
              { label: "Leads", value: String(workflow.linkedLeads), tone: "border-sky-500/20 bg-sky-500/[0.08] text-sky-200" },
              { label: "Sequences", value: String(workflow.activeSequences), tone: "border-violet-500/20 bg-violet-500/[0.08] text-violet-200" },
              { label: "Waiting", value: String(workflow.draftMessages + workflow.queuedMessages), tone: "border-amber-500/20 bg-amber-500/[0.08] text-amber-200" },
              { label: "Urgency", value: String(urgencyScore), tone: "border-white/10 bg-white/[0.03] text-slate-200" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-2xl border p-4 ${stat.tone}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-inherit/70">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white">Timeline</h2>
              <p className="mt-1 text-sm text-slate-400">
                This account’s signal, message, and outcome history in one place.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Activity feed</p>
                {activityFeed.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {activityFeed.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/5 bg-[#0B0F1A] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.tone}`}>
                            {item.type}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                            {formatDate(item.occurredAt)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{item.subtitle}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No account activity yet. Generate hooks or save a note to start the timeline.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Signals</p>
                {signals.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {signals.map((signal) => (
                      <div key={signal.id} className="rounded-xl border border-white/5 bg-[#0B0F1A] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneForSourceType(signal.sourceType)}`}>
                            {signal.sourceType.replace("_", " ")}
                          </span>
                          {signal.triggerType ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                              {signal.triggerType}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                            {signal.freshness}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-medium text-white">{signal.title || signal.snippet || signal.sourceUrl}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(signal.publishedAt || signal.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
                    <p className="text-sm text-slate-500">No account-level signals yet. Generate hooks to start the signal timeline.</p>
                    <Link href={hooksHref} className="mt-4 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                      Generate hooks
                    </Link>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Messages</p>
                {messages.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {messages.map((message) => (
                      <div key={message.id} className="rounded-xl border border-white/5 bg-[#0B0F1A] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                            {message.kind}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                            {message.stage}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                            {message.channel}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-white">{message.body}</p>
                        {message.rationale ? (
                          <p className="mt-2 text-xs leading-5 text-slate-400">{message.rationale}</p>
                        ) : null}
                        <p className="mt-2 text-[11px] text-slate-500">{formatDate(message.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
                    <p className="text-sm text-slate-500">No message history yet for this account.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={hooksHref} className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                        Generate hooks
                      </Link>
                      {workflow.linkedLeads === 0 ? (
                        <Link href={leadHref} className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                          Save lead
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Outcomes</p>
                {outcomes.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {outcomes.map((outcome) => (
                      <div key={outcome.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#0B0F1A] px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{outcome.eventType.replace(/_/g, " ")}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{formatDate(outcome.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No outcomes recorded yet for this account.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
              <h2 className="text-xl font-bold text-white">Quick actions</h2>
              <p className="mt-1 text-sm text-slate-400">
                Move this account forward without bouncing through multiple pages first.
              </p>
              <div className="mt-4 space-y-3">
                {quickActions.map((action) => (
                  <div key={`${action.label}-${action.href}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{action.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{action.detail}</p>
                      </div>
                      <Link
                        href={action.href}
                        className={
                          action.tone === "primary"
                            ? "inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
                            : "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                        }
                      >
                        {action.label}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
              <h2 className="text-xl font-bold text-white">Workflow state</h2>
              <div className="mt-4 space-y-3">
                {[
                  `${signals.length} signal${signals.length === 1 ? "" : "s"} in account history`,
                  `${workflow.linkedLeads} linked lead${workflow.linkedLeads === 1 ? "" : "s"}`,
                  `${workflow.activeSequences} active sequence${workflow.activeSequences === 1 ? "" : "s"}`,
                  `${workflow.draftMessages + workflow.queuedMessages} draft${workflow.draftMessages + workflow.queuedMessages === 1 ? "" : "s"} waiting`,
                  `${outcomes.length} outcome${outcomes.length === 1 ? "" : "s"} recorded`,
                ].map((line) => (
                  <div key={line} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                    {line}
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/[0.08] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200/80">Best next action</p>
                <p className="mt-2 text-sm text-white">{nextAction.detail}</p>
                <Link href={primaryHref} className="mt-4 inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                  {nextAction.label}
                </Link>
              </div>
              <form action={saveAccountContextAction} className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <input type="hidden" name="accountId" value={account.id} />
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Account context</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-xs font-semibold text-slate-300">Status</span>
                    <select
                      name="status"
                      defaultValue={account.status}
                      className="w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400/60"
                    >
                      {["watching", "active", "contacted", "archived"].map((value) => (
                        <option key={value} value={value} className="bg-[#0B0F1A] text-white">
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-semibold text-slate-300">Priority</span>
                    <select
                      name="priority"
                      defaultValue={account.priority}
                      className="w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400/60"
                    >
                      {["low", "normal", "high"].map((value) => (
                        <option key={value} value={value} className="bg-[#0B0F1A] text-white">
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="submit" className="mt-4 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                  Update account context
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
              <h2 className="text-xl font-bold text-white">Contacts</h2>
              {contacts.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.leadId} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-sm font-semibold text-white">{contact.name || contact.email}</p>
                      <p className="mt-1 text-xs text-slate-400">{contact.title || "No title"} • {contact.email}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{contact.relationship}</p>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Link href="/app/leads" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                      Open leads
                    </Link>
                    {workflow.activeSequences === 0 ? (
                      <Link href="/app/leads" className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                        Start sequence
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm text-slate-400">No linked contacts yet for this account.</p>
                  <Link href={leadHref} className="mt-4 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                    Save a lead
                  </Link>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
              <h2 className="text-xl font-bold text-white">Activity summary</h2>
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last touch</p>
                  <p className="mt-1 text-sm text-white">{formatDate(health?.lastTouchAt ?? null)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last signal</p>
                  <p className="mt-1 text-sm text-white">{formatDate(account.lastSignalAt)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last message</p>
                  <p className="mt-1 text-sm text-white">{formatDate(account.lastMessageAt)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last outcome</p>
                  <p className="mt-1 text-sm text-white">
                    {health?.lastOutcomeType ? formatOutcomeLabel(health.lastOutcomeType) : "—"}
                  </p>
                  {health?.lastOutcomeAt ? (
                    <p className="mt-1 text-[11px] text-slate-500">{formatDate(health.lastOutcomeAt)}</p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/80">Latest traction</p>
                  <p className="mt-1 text-sm text-white">
                    {health?.lastPositiveOutcomeType ? formatOutcomeLabel(health.lastPositiveOutcomeType) : "No positive outcome yet"}
                  </p>
                  {health?.lastPositiveOutcomeAt ? (
                    <p className="mt-1 text-[11px] text-emerald-100/70">{formatDate(health.lastPositiveOutcomeAt)}</p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
              <h2 className="text-xl font-bold text-white">Notes</h2>
              <p className="mt-1 text-sm text-slate-400">
                Capture lightweight human context that does not belong in the generated timeline.
              </p>
              {notesReady ? (
                <>
                  <form action={addAccountNoteAction} className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <input type="hidden" name="accountId" value={account.id} />
                    <label>
                      <span className="mb-2 block text-xs font-semibold text-slate-300">New note</span>
                      <textarea
                        name="body"
                        rows={4}
                        placeholder="Add context like buying committee notes, blockers, objections, or what to try next."
                        className="w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60"
                      />
                    </label>
                    <button type="submit" className="mt-4 inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                      Save note
                    </button>
                  </form>
                  {notes.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-sm leading-6 text-white">{note.body}</p>
                          <p className="mt-2 text-[11px] text-slate-500">{formatDate(note.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">No notes yet for this account.</p>
                  )}
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm text-slate-400">
                    Notes will appear here after the `account_notes_v2` migration is applied.
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
