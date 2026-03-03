import { prospectDb, prospectSchema } from "@/lib/prospect-agent/db";
import { eq, and, gte, sql } from "drizzle-orm";

const DEFAULT_DAILY_CAP = 20;
const DEFAULT_COOLDOWN_DAYS = 30;

function toSqliteDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
}

export async function getDmsSentToday(): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const result = await prospectDb
    .select({ count: sql<number>`count(*)` })
    .from(prospectSchema.dmLog)
    .where(
      and(
        gte(prospectSchema.dmLog.createdAt, toSqliteDate(todayStart)),
        eq(prospectSchema.dmLog.status, "sent"),
      ),
    );

  return result[0]?.count ?? 0;
}

export async function checkDailyLimit(
  dailyCap = DEFAULT_DAILY_CAP,
): Promise<{ allowed: boolean; sent: number; remaining: number }> {
  const sent = await getDmsSentToday();
  const remaining = Math.max(0, dailyCap - sent);
  return { allowed: remaining > 0, sent, remaining };
}

export async function checkLeadCooldown(
  leadId: string,
  cooldownDays = DEFAULT_COOLDOWN_DAYS,
): Promise<{ allowed: boolean; lastDmAt: string | null }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cooldownDays);

  const recent = await prospectDb
    .select({ sentAt: prospectSchema.dmLog.sentAt, createdAt: prospectSchema.dmLog.createdAt })
    .from(prospectSchema.dmLog)
    .where(
      and(
        eq(prospectSchema.dmLog.leadId, leadId),
        gte(prospectSchema.dmLog.createdAt, toSqliteDate(cutoff)),
      ),
    )
    .limit(1);

  if (recent.length === 0) {
    return { allowed: true, lastDmAt: null };
  }

  return {
    allowed: false,
    lastDmAt: recent[0].sentAt || recent[0].createdAt,
  };
}
