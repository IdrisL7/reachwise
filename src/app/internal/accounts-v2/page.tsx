import { headers } from "next/headers";
import Link from "next/link";
import {
  getAccountsV2Overview,
  getV2BackfillStatus,
  getContactsV2ForAccounts,
  getMessagesV2ForAccounts,
  getOutcomesV2ForAccounts,
  getSignalsV2ForAccounts,
  isV2BackboneReady,
} from "@/lib/v2-reader";

type SearchParams = {
  token?: string;
};

async function checkAccess(tokenFromUrl?: string) {
  const expected = process.env.FOLLOWUP_ENGINE_API_TOKEN;
  if (!expected) return false;
  if (tokenFromUrl === expected) return true;

  const h = await headers();
  const headerToken = h.get("x-internal-token");
  if (headerToken === expected) return true;

  const cookieHeader = h.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  return cookies.internal_token === expected;
}

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  tone?: "violet" | "teal" | "amber" | "slate";
}) {
  const tones = {
    violet: "border-violet-500/20 bg-violet-500/[0.08] text-violet-200",
    teal: "border-teal-500/20 bg-teal-500/[0.08] text-teal-200",
    amber: "border-amber-500/20 bg-amber-500/[0.08] text-amber-200",
    slate: "border-white/10 bg-white/[0.03] text-slate-200",
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-inherit/70">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

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

export default async function AccountsV2Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const hasAccess = await checkAccess(params.token);

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="mt-2 text-zinc-500">
            Append <code className="text-zinc-400">?token=YOUR_TOKEN</code> to access this page.
          </p>
        </div>
      </div>
    );
  }

  const ready = await isV2BackboneReady();
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#030014] px-6 py-8 text-white sm:px-8">
        <div className="mx-auto w-full max-w-6xl rounded-[28px] border border-white/10 bg-[#0B0F1A] p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-300/80">Internal v2</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Accounts Backbone</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            The `v2` tables are not available yet. Apply the backbone migration and rerun the page.
          </p>
        </div>
      </div>
    );
  }

  const [accounts, backfillStatus] = await Promise.all([
    getAccountsV2Overview(24),
    getV2BackfillStatus(),
  ]);
  const accountIds = accounts.map((account) => account.id);
  const [messages, outcomes, signalRows, contactRows] = await Promise.all([
    getMessagesV2ForAccounts(accountIds, 4),
    getOutcomesV2ForAccounts(accountIds, 6),
    getSignalsV2ForAccounts(accountIds, 3),
    getContactsV2ForAccounts(accountIds),
  ]);

  const signalsByAccount = new Map<string, typeof signalRows>();
  const contactsByAccount = new Map<string, typeof contactRows>();
  const messagesByAccount = new Map<string, typeof messages>();
  const outcomesByAccount = new Map<string, typeof outcomes>();

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

  const totalSignals = accounts.reduce((sum, account) => sum + account.signalCount, 0);
  const totalContacts = accounts.reduce((sum, account) => sum + account.contactCount, 0);
  const watchedCount = accounts.filter((account) => account.status === "watching").length;
  const contactedCount = accounts.filter((account) => account.status === "contacted").length;

  return (
    <div className="min-h-screen bg-[#030014] px-6 py-8 text-white sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_34%),linear-gradient(135deg,_rgba(13,15,26,0.98),_rgba(9,11,20,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300/80">
                Internal v2
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Accounts Backbone
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Hidden reader page for the new `accounts_v2` and `signals_v2` spine. This lets us inspect the migration backbone before moving any user-facing surface onto it.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/internal/followup-dashboard${params.token ? `?token=${encodeURIComponent(params.token)}` : ""}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
              >
                Follow-up Dashboard
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Accounts" value={accounts.length} tone="violet" />
            <StatCard label="Signals" value={totalSignals} tone="teal" />
            <StatCard label="Watching" value={watchedCount} tone="amber" />
            <StatCard label="Contacts Linked" value={totalContacts} tone="slate" />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Timeline coverage</p>
                <p className="mt-1 text-sm text-slate-300">
                  {backfillStatus.backfilledMessageCount > 0 || backfillStatus.backfilledOutcomeCount > 0
                    ? "Historic v2 timeline data has been backfilled."
                    : "This timeline is still mostly forward-filled from recent dual-write activity."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  {backfillStatus.messageCount} messages
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  {backfillStatus.outcomeCount} outcomes
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  {backfillStatus.backfilledMessageCount} backfilled messages
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  {backfillStatus.backfilledOutcomeCount} backfilled outcomes
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Recent Accounts</h2>
              <p className="mt-1 text-sm text-slate-400">
                Latest accounts projected into the `v2` backbone, with recent signals and linked contacts.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
              {contactedCount} contacted
            </span>
          </div>

          <div className="space-y-4">
            {accounts.map((account) => {
              const accountSignals = signalsByAccount.get(account.id) ?? [];
              const accountContacts = contactsByAccount.get(account.id) ?? [];
              const accountMessages = messagesByAccount.get(account.id) ?? [];
              const accountOutcomes = outcomesByAccount.get(account.id) ?? [];

              return (
                <div key={account.id} className="rounded-2xl border border-white/5 bg-black/20 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{account.companyName}</h3>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                          {account.status}
                        </span>
                        {account.priority === "high" ? (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                            High priority
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {account.domain ?? account.website ?? "No domain"}
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last signal</p>
                        <p className="mt-1 text-slate-200">{formatDate(account.lastSignalAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last message</p>
                        <p className="mt-1 text-slate-200">{formatDate(account.lastMessageAt)}</p>
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
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                  Tier {signal.evidenceTier}
                                </span>
                              </div>
                              <p className="mt-2 text-sm font-medium text-white">
                                {signal.title || signal.snippet || signal.sourceUrl}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDate(signal.publishedAt || signal.createdAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No v2 signals yet.</p>
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
                              <p className="mt-2 text-sm text-white">{message.body.length > 140 ? `${message.body.slice(0, 140)}…` : message.body}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{formatDate(message.createdAt)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No v2 messages yet.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/5 bg-[#0B0F1A] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Linked contacts</p>
                      {accountContacts.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {accountContacts.slice(0, 4).map((contact) => (
                            <div key={contact.leadId} className="rounded-lg border border-white/5 bg-black/20 p-3">
                              <p className="text-sm font-medium text-white">{contact.name || contact.email}</p>
                              <p className="mt-1 text-xs text-slate-400">{contact.title || "No title"}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{contact.relationship}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No linked leads yet.</p>
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
                          <p className="mt-3 text-sm text-slate-500">No v2 outcomes yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
