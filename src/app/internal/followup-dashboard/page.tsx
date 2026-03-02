import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getOverviewStats,
  getSequenceStepCounts,
  getRecentFollowups,
} from "@/lib/followup/dashboard";

// ---------------------------------------------------------------------------
// Auth guard — check X-Internal-Token header or ?token= query param
// ---------------------------------------------------------------------------

async function checkAccess() {
  const expected = process.env.FOLLOWUP_ENGINE_API_TOKEN;
  if (!expected) return false;

  const h = await headers();
  const headerToken = h.get("x-internal-token");
  if (headerToken === expected) return true;

  // Also allow ?token= for easy browser access
  const referer = h.get("referer") || "";
  const url = h.get("x-url") || h.get("x-invoke-path") || "";

  // For server components, we check via a cookie or just allow if token matches
  // Simple approach: check cookie
  const cookieHeader = h.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  if (cookies["internal_token"] === expected) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-5">
      <p className="text-[0.8125rem] text-zinc-500">{label}</p>
      <p className="mt-1 text-[2rem] font-bold tracking-tight text-white">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-[0.75rem] text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}

function truncate(str: string | null | undefined, len: number): string {
  if (!str) return "—";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function FollowUpDashboard({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;

  // Auth: allow ?token= for browser access
  const expected = process.env.FOLLOWUP_ENGINE_API_TOKEN;
  const hasAccess =
    (expected && params.token === expected) || (await checkAccess());

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="mt-2 text-zinc-500">
            Append <code className="text-zinc-400">?token=YOUR_TOKEN</code> to
            access this dashboard.
          </p>
        </div>
      </div>
    );
  }

  const [stats, stepCounts, recentFollowups] = await Promise.all([
    getOverviewStats(),
    getSequenceStepCounts(),
    getRecentFollowups(50),
  ]);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Follow-Up Engine Dashboard</h1>
          <p className="mt-1 text-[0.9375rem] text-zinc-500">
            Internal monitoring — sequence state, follow-ups, and reply rates.
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Leads in Sequences"
            value={stats.activeLeads}
          />
          <StatCard
            label="Follow-Ups Sent (24h)"
            value={stats.sent24h}
          />
          <StatCard
            label="Follow-Ups Sent (7d)"
            value={stats.sent7d}
          />
          <StatCard
            label="Reply Rate (7d)"
            value={`${stats.replyRate}%`}
            subtitle={
              stats.sent7d > 0
                ? `Based on ${stats.sent7d} outbound`
                : "No outbound data yet"
            }
          />
        </div>

        {/* Leads by Sequence Step */}
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">
            Leads by Sequence Step
          </h2>
          <div className="overflow-hidden rounded-xl border border-zinc-700/30">
            <table className="w-full text-left text-[0.875rem]">
              <thead>
                <tr className="border-b border-zinc-700/30 bg-[#131320]/60">
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Step
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Lead Count
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Label
                  </th>
                </tr>
              </thead>
              <tbody>
                {stepCounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-zinc-500"
                    >
                      No leads in sequences yet.
                    </td>
                  </tr>
                ) : (
                  stepCounts.map((row) => (
                    <tr
                      key={row.sequenceStep}
                      className="border-b border-zinc-800/40 last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-zinc-300">
                        {row.sequenceStep}
                      </td>
                      <td className="px-4 py-3 text-white font-semibold">
                        {row.count}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {row.sequenceStep === 0
                          ? "Not yet contacted"
                          : row.sequenceStep === 1
                            ? "First email sent"
                            : row.sequenceStep === 2
                              ? "First follow-up sent"
                              : row.sequenceStep === 3
                                ? "Second follow-up sent"
                                : `Step ${row.sequenceStep}`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Follow-Up Emails */}
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">
            Recent Follow-Up Emails
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/30">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-zinc-700/30 bg-[#131320]/60">
                  <th className="px-4 py-3 font-medium text-zinc-400 whitespace-nowrap">
                    Sent At
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Lead
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Company
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Step
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Subject
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Preview
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentFollowups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-zinc-500"
                    >
                      No follow-up emails yet.
                    </td>
                  </tr>
                ) : (
                  recentFollowups.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-zinc-800/40 last:border-0"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-400">
                        {row.sentAt
                          ? new Date(row.sentAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {row.leadName || row.leadEmail}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {row.companyName || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400">
                        {row.sequenceStep}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${
                            row.status === "sent"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : row.status === "draft"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-zinc-500/10 text-zinc-400"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 max-w-[200px]">
                        {truncate(row.subject, 80)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 max-w-[240px]">
                        {truncate(row.body, 120)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
