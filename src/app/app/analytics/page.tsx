import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, sql, and, gte } from "drizzle-orm";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch usage events for this user
  const eventCounts = await db
    .select({
      event: schema.usageEvents.event,
      count: sql<number>`count(*)`,
    })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.userId, userId),
        gte(schema.usageEvents.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(schema.usageEvents.event);

  const eventMap = Object.fromEntries(
    eventCounts.map((e) => [e.event, e.count]),
  );

  const recentEvents = await db
    .select()
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.userId, userId),
        gte(schema.usageEvents.createdAt, sevenDaysAgo),
      ),
    )
    .orderBy(sql`created_at DESC`)
    .limit(20);

  const hooksGenerated = eventMap.hook_generated || 0;
  const emailsSent = eventMap.email_sent || 0;
  const emailsOpened = eventMap.email_opened || 0;
  const emailsClicked = eventMap.email_clicked || 0;
  const emailsBounced = eventMap.email_bounced || 0;

  const openRate = emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 100) : 0;
  const clickRate = emailsOpened > 0 ? Math.round((emailsClicked / emailsOpened) * 100) : 0;

  const stats = [
    { label: "Hooks Generated", value: hooksGenerated, sub: "last 30 days" },
    { label: "Emails Sent", value: emailsSent, sub: "last 30 days" },
    { label: "Open Rate", value: `${openRate}%`, sub: `${emailsOpened} opens` },
    { label: "Click Rate", value: `${clickRate}%`, sub: `${emailsClicked} clicks` },
    { label: "Bounced", value: emailsBounced, sub: emailsBounced > 0 ? "check list hygiene" : "healthy" },
  ];

  const eventLabels: Record<string, string> = {
    hook_generated: "Hook generated",
    email_generated: "Email drafted",
    email_sent: "Email sent",
    email_opened: "Email opened",
    email_clicked: "Link clicked",
    email_replied: "Reply received",
    email_bounced: "Bounce",
    lead_created: "Lead created",
    followup_generated: "Follow-up generated",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-xs text-zinc-600">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <h2 className="text-lg font-semibold mb-4">Recent Activity (7 days)</h2>
      {recentEvents.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-500">No activity yet. Generate some hooks to get started.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => {
                const meta = (event.metadata || {}) as Record<string, unknown>;
                return (
                  <tr
                    key={event.id}
                    className="border-t border-zinc-800/50"
                  >
                    <td className="px-4 py-3 text-zinc-300">
                      {eventLabels[event.event] || event.event}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs font-mono">
                      {(meta.to as string) || (meta.subject as string) || (meta.url as string) || "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
