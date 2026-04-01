import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assessLearningLoopHealth,
  getAlertAcknowledgementState,
  getLearningLoopForecast,
  getLearningLoopHealthStats,
  getLearningLoopRecommendations,
  getLearningLoopTrend,
  getLatestMaintenanceSnapshot,
  getOverviewStats,
  getRecentMaintenanceAlerts,
  getRecentMaintenanceRuns,
  getSequenceStepCounts,
  getRecentFollowups,
} from "@/lib/followup/dashboard";
import { planLearningLoopMaintenance, runLearningLoopMaintenance } from "@/lib/followup/maintenance";
import { logAudit } from "@/lib/audit";

type DashboardSearchParams = {
  token?: string;
  preview?: string;
  alertStatus?: string;
  alertEvent?: string;
  runStatus?: string;
  notice?: "maintenance-ran" | "alert-acknowledged" | "unauthorized-action";
};

function buildDashboardUrl(params: DashboardSearchParams): string {
  const query = new URLSearchParams();
  if (params.token) query.set("token", params.token);
  if (params.preview) query.set("preview", params.preview);
  if (params.alertStatus) query.set("alertStatus", params.alertStatus);
  if (params.alertEvent) query.set("alertEvent", params.alertEvent);
  if (params.runStatus) query.set("runStatus", params.runStatus);
  if (params.notice) query.set("notice", params.notice);
  const qs = query.toString();
  return `/internal/followup-dashboard${qs ? `?${qs}` : ""}`;
}

async function runMaintenanceAction(formData: FormData) {
  "use server";

  const token = String(formData.get("token") || "");
  const preview = String(formData.get("preview") || "");
  const alertStatus = String(formData.get("alertStatus") || "");
  const alertEvent = String(formData.get("alertEvent") || "");
  const runStatus = String(formData.get("runStatus") || "");
  const hasAccess = await checkAccess(token);

  if (!hasAccess) {
    redirect(
      buildDashboardUrl({
        token,
        preview,
        alertStatus,
        alertEvent,
        runStatus,
        notice: "unauthorized-action",
      }),
    );
  }

  await runLearningLoopMaintenance({ noReplySweepLimit: 500 });
  revalidatePath("/internal/followup-dashboard");
  redirect(
    buildDashboardUrl({
      token,
      preview,
      alertStatus,
      alertEvent,
      runStatus,
      notice: "maintenance-ran",
    }),
  );
}

async function acknowledgeAlertAction(formData: FormData) {
  "use server";

  const token = String(formData.get("token") || "");
  const preview = String(formData.get("preview") || "");
  const alertStatus = String(formData.get("alertStatus") || "");
  const alertEvent = String(formData.get("alertEvent") || "");
  const runStatus = String(formData.get("runStatus") || "");
  const currentStatus = String(formData.get("currentStatus") || "");
  const currentReason = String(formData.get("currentReason") || "");
  const hasAccess = await checkAccess(token);

  if (!hasAccess) {
    redirect(
      buildDashboardUrl({
        token,
        preview,
        alertStatus,
        alertEvent,
        runStatus,
        notice: "unauthorized-action",
      }),
    );
  }

  await logAudit({
    event: "followup_maintenance_acknowledged",
    reason: "Operator acknowledged current learning-loop alert.",
    metadata: {
      status: currentStatus || null,
      primaryReason: currentReason || null,
    },
  });

  revalidatePath("/internal/followup-dashboard");
  redirect(
    buildDashboardUrl({
      token,
      preview,
      alertStatus,
      alertEvent,
      runStatus,
      notice: "alert-acknowledged",
    }),
  );
}

// ---------------------------------------------------------------------------
// Auth guard — check X-Internal-Token header or ?token= query param
// ---------------------------------------------------------------------------

async function checkAccess(tokenFromUrl?: string) {
  const expected = process.env.FOLLOWUP_ENGINE_API_TOKEN;
  if (!expected) return false;
  if (tokenFromUrl === expected) return true;

  const h = await headers();
  const headerToken = h.get("x-internal-token");
  if (headerToken === expected) return true;

  // Also allow ?token= for easy browser access
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

function getAlertEventKey(event: string): "degraded" | "recovered" | "acknowledged" {
  if (event === "followup_maintenance_recovered") return "recovered";
  if (event === "followup_maintenance_acknowledged") return "acknowledged";
  return "degraded";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function FollowUpDashboard({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
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

  const [learningStats, overviewStats, stepCounts, recentFollowups, maintenanceRuns, maintenanceAlerts, previousSnapshot] = await Promise.all([
    getLearningLoopHealthStats(),
    getOverviewStats(),
    getSequenceStepCounts(),
    getRecentFollowups(50),
    getRecentMaintenanceRuns(8),
    getRecentMaintenanceAlerts(8),
    getLatestMaintenanceSnapshot(),
  ]);
  const learningLoop = assessLearningLoopHealth(learningStats);
  const recommendations = getLearningLoopRecommendations({
    stats: learningStats,
    assessment: learningLoop,
  });
  const trend = getLearningLoopTrend({
    currentStats: learningStats,
    currentAssessment: learningLoop,
    previousStats: previousSnapshot?.stats,
    previousAssessment: previousSnapshot?.assessment,
    previousCapturedAt: previousSnapshot?.createdAt ?? null,
  });
  const forecast = getLearningLoopForecast({
    stats: learningStats,
    assessment: learningLoop,
    trend,
  });
  const lastMaintenanceAt = maintenanceRuns[0]?.createdAt ?? null;
  const previewActions =
    params.preview === "1"
      ? planLearningLoopMaintenance(learningStats, learningLoop)
      : [];
  const filteredMaintenanceAlerts = maintenanceAlerts.filter((alert) => {
    if (params.alertStatus && params.alertStatus !== "all" && alert.status !== params.alertStatus) {
      return false;
    }
    if (params.alertEvent && params.alertEvent !== "all") {
      const eventKey = getAlertEventKey(alert.event);
      if (eventKey !== params.alertEvent) return false;
    }
    return true;
  });
  const filteredMaintenanceRuns = maintenanceRuns.filter((run) => {
    if (params.runStatus && params.runStatus !== "all" && run.status !== params.runStatus) {
      return false;
    }
    return true;
  });
  const currentPrimaryReason = learningLoop.reasons[0] ?? null;
  const acknowledgementState = await getAlertAcknowledgementState(currentPrimaryReason);
  const latestCurrentReasonAlertAt = acknowledgementState.latestAlertAt
    ? Date.parse(acknowledgementState.latestAlertAt)
    : undefined;
  const latestCurrentReasonAckAt = acknowledgementState.latestAcknowledgedAt
    ? Date.parse(acknowledgementState.latestAcknowledgedAt)
    : undefined;
  const showAcknowledge =
    learningLoop.status !== "ok" &&
    !!currentPrimaryReason &&
    (
      latestCurrentReasonAlertAt === undefined ||
      latestCurrentReasonAckAt === undefined ||
      latestCurrentReasonAckAt < latestCurrentReasonAlertAt
    );

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Follow-Up Engine Dashboard</h1>
          <p className="mt-1 text-[0.9375rem] text-zinc-500">
            Internal monitoring and control for sequence state, learned memory, maintenance, and operator intervention.
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            Last maintenance run: {lastMaintenanceAt ? new Date(lastMaintenanceAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) : "not yet run"}
          </p>
        </div>

        {params.notice === "maintenance-ran" ? (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Maintenance ran successfully and the dashboard was refreshed with the latest health state.
          </div>
        ) : null}
        {params.notice === "alert-acknowledged" ? (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            The current learning-loop alert was acknowledged and logged for operators.
          </div>
        ) : null}
        {params.notice === "unauthorized-action" ? (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            That action was blocked because the dashboard token could not be verified.
          </div>
        ) : null}

        <div className="mb-8 flex flex-wrap gap-3">
          <form action={runMaintenanceAction}>
            <input type="hidden" name="token" value={params.token ?? ""} />
            <input type="hidden" name="preview" value={params.preview ?? ""} />
            <input type="hidden" name="alertStatus" value={params.alertStatus ?? ""} />
            <input type="hidden" name="alertEvent" value={params.alertEvent ?? ""} />
            <input type="hidden" name="runStatus" value={params.runStatus ?? ""} />
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">
              Run Maintenance Now
            </button>
          </form>
          {showAcknowledge ? (
            <form action={acknowledgeAlertAction}>
              <input type="hidden" name="token" value={params.token ?? ""} />
              <input type="hidden" name="preview" value={params.preview ?? ""} />
              <input type="hidden" name="alertStatus" value={params.alertStatus ?? ""} />
              <input type="hidden" name="alertEvent" value={params.alertEvent ?? ""} />
              <input type="hidden" name="runStatus" value={params.runStatus ?? ""} />
              <input type="hidden" name="currentStatus" value={learningLoop.status} />
              <input type="hidden" name="currentReason" value={learningLoop.reasons[0] ?? ""} />
              <button className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20">
                Acknowledge Current Alert
              </button>
            </form>
          ) : null}
          <a
            href={buildDashboardUrl({
              token: params.token,
              preview: params.preview === "1" ? undefined : "1",
              alertStatus: params.alertStatus,
              alertEvent: params.alertEvent,
              runStatus: params.runStatus,
            })}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
          >
            {params.preview === "1" ? "Hide Dry Run" : "Preview Maintenance"}
          </a>
          <a
            href={buildDashboardUrl({
              token: params.token,
              preview: params.preview,
              alertStatus: params.alertStatus,
              alertEvent: params.alertEvent,
              runStatus: params.runStatus,
            })}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
          >
            Recheck Health Now
          </a>
        </div>
        <p className="mb-8 text-xs text-zinc-500">
          `Run Maintenance Now` applies queued repairs immediately. `Preview Maintenance` shows the planned actions without writing changes.
        </p>

        <div
          className={`mb-8 rounded-xl border px-5 py-4 ${
            learningLoop.status === "error"
              ? "border-rose-500/30 bg-rose-500/10"
              : learningLoop.status === "warn"
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-emerald-500/30 bg-emerald-500/10"
          }`}
        >
          <p className="text-sm font-semibold">
            Learning Loop Status: {learningLoop.status.toUpperCase()}
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {learningLoop.reasons[0] || "No operational issues detected in the learned follow-up loop."}
          </p>
          {learningLoop.reasons.length > 1 ? (
            <div className="mt-3 space-y-1 text-xs text-zinc-400">
              {learningLoop.reasons.slice(1).map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          ) : null}
          <div className="mt-4 space-y-2">
            {recommendations.map((recommendation) => (
              <div
                key={`${recommendation.title}-${recommendation.action}`}
                className="rounded-lg border border-white/10 bg-black/10 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.12em] ${
                      recommendation.priority === "high"
                        ? "bg-rose-500/15 text-rose-300"
                        : recommendation.priority === "medium"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-emerald-500/15 text-emerald-300"
                    }`}
                  >
                    {recommendation.priority}
                  </span>
                  <p className="text-sm font-semibold text-white">
                    {recommendation.title}
                  </p>
                </div>
                <p className="mt-1 text-sm text-zinc-300">
                  {recommendation.action}
                </p>
              </div>
            ))}
          </div>
          {params.preview === "1" ? (
            <div className="mt-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-sky-100">
                Dry Run Preview
              </p>
              <p className="mt-1 text-sm text-sky-50/90">
                Planned actions: {previewActions.length > 0 ? previewActions.join(", ") : "none"}
              </p>
            </div>
          ) : null}
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Leads in Sequences"
            value={overviewStats.activeLeads}
          />
          <StatCard
            label="Follow-Ups Sent (24h)"
            value={overviewStats.sent24h}
          />
          <StatCard
            label="Follow-Ups Sent (7d)"
            value={overviewStats.sent7d}
          />
          <StatCard
            label="Reply Rate (7d)"
            value={`${overviewStats.replyRate}%`}
            subtitle={
              overviewStats.sent7d > 0
                ? `Based on ${overviewStats.sent7d} outbound`
                : "No outbound data yet"
            }
          />
        </div>

        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">
            Learning Loop Health
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Learned Memory Rows"
              value={learningStats.totalMemoryRows}
              subtitle={`${learningStats.globalMemoryRows} global, ${learningStats.segmentMemoryRows} segment, ${learningStats.pathMemoryRows} path`}
            />
            <StatCard
              label="Stale Memory Rows"
              value={learningStats.staleMemoryRows}
              subtitle="Rows untouched for 30+ days"
            />
            <StatCard
              label="Pending No-Reply Learning"
              value={learningStats.pendingNoReplyPenalties}
              subtitle="Eligible sent messages still waiting for penalty writeback"
            />
            <StatCard
              label="Missing Orchestration (7d)"
              value={`${Math.round(learningStats.recentMessagesMissingOrchestrationRate * 100)}%`}
              subtitle={`${learningStats.recentMessagesMissingOrchestration7d} of ${learningStats.recentSequenceMessages7d} recent sent messages`}
            />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] ${
                  trend.statusChange === "improved"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : trend.statusChange === "regressed"
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-zinc-500/15 text-zinc-300"
                }`}
              >
                {trend.statusChange}
              </span>
              <p className="text-sm text-zinc-200">
                {trend.summary}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                <p className="text-[0.75rem] text-zinc-500">Pending no-reply delta</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {trend.pendingNoReplyDelta > 0 ? "+" : ""}{trend.pendingNoReplyDelta}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                <p className="text-[0.75rem] text-zinc-500">Missing orchestration delta</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {trend.missingOrchestrationRateDelta > 0 ? "+" : ""}{Math.round(trend.missingOrchestrationRateDelta * 100)}%
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                <p className="text-[0.75rem] text-zinc-500">Stale memory delta</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {trend.staleMemoryDelta > 0 ? "+" : ""}{trend.staleMemoryDelta}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Baseline: {trend.previousCapturedAt ? new Date(trend.previousCapturedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }) : "no previous maintenance snapshot"}
            </p>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="flex items-center gap-3">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] ${
                  forecast.riskLevel === "high"
                    ? "bg-rose-500/15 text-rose-300"
                    : forecast.riskLevel === "medium"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {forecast.riskLevel} risk
              </span>
              <p className="text-sm text-zinc-200">
                Forecast for the next maintenance window
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">
              {forecast.likelyIssue}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {forecast.summary}
            </p>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">
            Alert History
          </h2>
          <form className="mb-4 flex flex-wrap gap-3" method="GET">
            <input type="hidden" name="token" value={params.token ?? ""} />
            <input type="hidden" name="preview" value={params.preview ?? ""} />
            <input type="hidden" name="runStatus" value={params.runStatus ?? ""} />
            <select
              name="alertStatus"
              defaultValue={params.alertStatus ?? "all"}
              className="rounded-lg border border-white/10 bg-[#131320] px-3 py-2 text-sm text-white"
            >
              <option value="all">All alert statuses</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="ok">Ok</option>
            </select>
            <select
              name="alertEvent"
              defaultValue={params.alertEvent ?? "all"}
              className="rounded-lg border border-white/10 bg-[#131320] px-3 py-2 text-sm text-white"
            >
              <option value="all">All alert events</option>
              <option value="degraded">Degraded</option>
              <option value="recovered">Recovered</option>
              <option value="acknowledged">Acknowledged</option>
            </select>
            <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200">
              Apply Alert Filters
            </button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/30">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-zinc-700/30 bg-[#131320]/60">
                  <th className="px-4 py-3 font-medium text-zinc-400 whitespace-nowrap">
                    Time
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Event
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMaintenanceAlerts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-zinc-500"
                    >
                      No alert transitions logged yet.
                    </td>
                  </tr>
                ) : (
                  filteredMaintenanceAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="border-b border-zinc-800/40 last:border-0"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-400">
                        {new Date(alert.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {alert.event === "followup_maintenance_recovered"
                          ? "Recovered"
                          : alert.event === "followup_maintenance_acknowledged"
                            ? "Acknowledged"
                          : "Degraded"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${
                            alert.status === "error"
                              ? "bg-rose-500/10 text-rose-400"
                              : alert.status === "warn"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-emerald-500/10 text-emerald-400"
                          }`}
                        >
                          {alert.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 max-w-[360px]">
                        {alert.primaryReason || alert.reason || "Learning-loop state changed."}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">
            Recent Maintenance Runs
          </h2>
          <form className="mb-4 flex flex-wrap gap-3" method="GET">
            <input type="hidden" name="token" value={params.token ?? ""} />
            <input type="hidden" name="preview" value={params.preview ?? ""} />
            <input type="hidden" name="alertStatus" value={params.alertStatus ?? ""} />
            <input type="hidden" name="alertEvent" value={params.alertEvent ?? ""} />
            <select
              name="runStatus"
              defaultValue={params.runStatus ?? "all"}
              className="rounded-lg border border-white/10 bg-[#131320] px-3 py-2 text-sm text-white"
            >
              <option value="all">All run statuses</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="ok">Ok</option>
            </select>
            <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200">
              Apply Run Filters
            </button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/30">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-zinc-700/30 bg-[#131320]/60">
                  <th className="px-4 py-3 font-medium text-zinc-400 whitespace-nowrap">
                    Run Time
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Actions
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Repairs
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-400">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMaintenanceRuns.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-zinc-500"
                    >
                      No maintenance runs logged yet.
                    </td>
                  </tr>
                ) : (
                  filteredMaintenanceRuns.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-zinc-800/40 last:border-0"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-400">
                        {new Date(run.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${
                            run.status === "error"
                              ? "bg-rose-500/10 text-rose-400"
                              : run.status === "warn"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-emerald-500/10 text-emerald-400"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {run.actions.length > 0 ? run.actions.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {run.noReplyPenalized} no-reply
                      </td>
                      <td className="px-4 py-3 text-zinc-400 max-w-[320px]">
                        {run.reasons[0] || run.reason || "Observed healthy follow-up state."}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
