import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, schema } from "@/lib/db";
import { eq, isNull, or, lt } from "drizzle-orm";
import {
  fetchSourcesWithGating,
  buildSystemPrompt,
  buildUserPrompt,
  callClaude,
  validateHook,
  scoreHookQuality,
  getDomain,
} from "@/lib/hooks";
import { watchlistDigestHtml } from "@/lib/email/sendgrid";
import { sendEmail } from "@/lib/email/sendgrid";

const BATCH_SIZE = 10;
const STALE_HOURS = 23;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

/** Returns true if a source date string is newer than the last recorded signal */
function isSourceFresh(sourceDate: string | undefined, lastSignalAt: string | null): boolean {
  if (!sourceDate) return false;
  const sourceTime = new Date(sourceDate).getTime();
  if (isNaN(sourceTime)) return false;
  if (!lastSignalAt) return true; // never checked before
  return sourceTime > new Date(lastSignalAt).getTime();
}

/** Infer signal type from source content */
function inferSignalType(sources: Array<{ title: string; facts: string[] }>): string {
  const text = sources.map((s) => `${s.title} ${s.facts.join(" ")}`).join(" ").toLowerCase();
  if (/fund|raise|series|invest|million|billion/.test(text)) return "funding";
  if (/hir|recruit|talent|open role|job|position/.test(text)) return "hiring";
  if (/expand|launch|new market|open|office/.test(text)) return "expansion";
  if (/partner|integrat|acqui/.test(text)) return "news";
  return "news";
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exaApiKey = process.env.EXA_API_KEY || process.env.TAVILY_API_KEY;
  const claudeApiKey = process.env.CLAUDE_API_KEY;

  if (!exaApiKey || !claudeApiKey) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  // Fetch all watchlist entries that need checking
  const entries = await db
    .select()
    .from(schema.watchlist)
    .where(
      or(
        isNull(schema.watchlist.lastCheckedAt),
        lt(schema.watchlist.lastCheckedAt, staleThreshold),
      ),
    );

  console.log(`[watchlist-scan] ${entries.length} entries to check`);

  // Group hits by userId for digest emails
  const hitsByUser = new Map<string, { companyName: string; hookCount: number }[]>();

  // Process in batches
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (entry) => {
        try {
          const url = `https://${entry.domain}`;

          // Check if there's already an unreviewed draft for this entry — skip if so
          const [existingDraft] = await db
            .select({ id: schema.drafts.id })
            .from(schema.drafts)
            .where(
              eq(schema.drafts.watchlistId, entry.id),
            )
            .limit(1);

          // isNull check on approved
          if (existingDraft) {
            const [pendingDraft] = await db
              .select({ id: schema.drafts.id, approved: schema.drafts.approved })
              .from(schema.drafts)
              .where(eq(schema.drafts.id, existingDraft.id))
              .limit(1);
            if (pendingDraft && pendingDraft.approved === null) {
              console.log(`[watchlist-scan] skipping ${entry.domain} — unreviewed draft exists`);
              await db
                .update(schema.watchlist)
                .set({ lastCheckedAt: now.toISOString() })
                .where(eq(schema.watchlist.id, entry.id));
              return;
            }
          }

          // Fetch signals
          const result = await fetchSourcesWithGating(url, exaApiKey);

          // Check for fresh signals
          const freshSources = result.sources.filter(
            (s) => s.tier !== "C" && isSourceFresh(s.date, entry.lastSignalAt),
          );

          // Always update lastCheckedAt
          const updatePayload: Partial<typeof schema.watchlist.$inferInsert> = {
            lastCheckedAt: now.toISOString(),
          };

          if (freshSources.length === 0) {
            await db
              .update(schema.watchlist)
              .set(updatePayload)
              .where(eq(schema.watchlist.id, entry.id));
            return;
          }

          // Fresh signal found — generate hooks
          const signalType = inferSignalType(freshSources.map((s) => ({ title: s.title, facts: s.facts })));
          const latestSignalDate = freshSources
            .map((s) => s.date)
            .filter(Boolean)
            .sort()
            .at(-1) ?? now.toISOString();

          const systemPrompt = buildSystemPrompt(null, null);
          const userPrompt = buildUserPrompt(url, result.sources);
          const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

          // Validate and score
          const validHooks = rawHooks
            .map((raw) => validateHook(raw))
            .filter((h): h is NonNullable<typeof h> => h !== null);

          if (validHooks.length === 0) {
            await db
              .update(schema.watchlist)
              .set({ ...updatePayload, lastSignalAt: latestSignalDate, lastSignalType: signalType })
              .where(eq(schema.watchlist.id, entry.id));
            return;
          }

          // Score and take top 2
          const companyDomain = getDomain(url);
          const scored = validHooks
            .map((h) => ({ hook: h, score: scoreHookQuality(h, companyDomain) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 2);

          // Insert drafts
          for (const { hook } of scored) {
            await db.insert(schema.drafts).values({
              userId: entry.userId,
              companyName: entry.companyName,
              domain: entry.domain,
              hookText: hook.hook,
              source: "watchlist",
              watchlistId: entry.id,
            });
          }

          // Update watchlist entry
          await db
            .update(schema.watchlist)
            .set({
              ...updatePayload,
              lastSignalAt: latestSignalDate,
              lastSignalType: signalType,
            })
            .where(eq(schema.watchlist.id, entry.id));

          // Track hit for digest
          const userHits = hitsByUser.get(entry.userId) ?? [];
          userHits.push({ companyName: entry.companyName, hookCount: scored.length });
          hitsByUser.set(entry.userId, userHits);

          console.log(`[watchlist-scan] ${entry.domain} — ${scored.length} hooks generated`);
        } catch (err) {
          console.error(`[watchlist-scan] error processing ${entry.domain}:`, err);
          // Still update lastCheckedAt to avoid hammering a broken company
          await db
            .update(schema.watchlist)
            .set({ lastCheckedAt: now.toISOString() })
            .where(eq(schema.watchlist.id, entry.id));
        }
      }),
    );
  }

  // Send digest emails to users with hits
  const userIds = Array.from(hitsByUser.keys());
  if (userIds.length > 0) {
    const allUsers = await db
      .select({ id: schema.users.id, email: schema.users.email, unsubscribedAt: schema.users.unsubscribedAt })
      .from(schema.users);

    for (const [userId, hits] of hitsByUser) {
      const user = allUsers.find((u) => u.id === userId);
      if (!user || user.unsubscribedAt) continue;

      const totalHooks = hits.reduce((sum, h) => sum + h.hookCount, 0);
      const companyNames = hits.map((h) => h.companyName);

      const subject =
        hits.length === 1
          ? `${hits[0].companyName} has a fresh signal — ${totalHooks} hook${totalHooks !== 1 ? "s" : ""} ready`
          : `${hits.length} of your watched companies have fresh signals`;

      await sendEmail({
        to: user.email,
        subject,
        body: `${hits.length} watched compan${hits.length === 1 ? "y has" : "ies have"} new signals: ${companyNames.join(", ")}. Review your new hooks in the inbox.`,
        html: watchlistDigestHtml(hits, totalHooks),
        userId,
      });
    }
  }

  return NextResponse.json({
    checked: entries.length,
    usersNotified: hitsByUser.size,
    timestamp: now.toISOString(),
  });
}
