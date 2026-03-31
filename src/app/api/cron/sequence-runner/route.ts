import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, schema } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";
import { resolveSequence } from "@/lib/followup/sequences";
import { generateFollowUp } from "@/lib/followup/generate";
import type { SequenceStep } from "@/lib/db/schema";

const BATCH_LIMIT = 25;
const LOCK_TTL_MINUTES = 30;
const DAILY_SEND_CAP = 50;

// ---------------------------------------------------------------------------
// Auth (same pattern as watchlist-scan)
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

// ---------------------------------------------------------------------------
// GET handler — Vercel cron
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const nowISO = now.toISOString();
  const runId = crypto.randomUUID();

  let processed = 0;
  let draftsCreated = 0;
  let skipped = 0;

  try {
    // ── 1. Query due leads via active leadSequences ──────────────────────

    const activeLeadSeqs = await db
      .select({
        ls: schema.leadSequences,
        lead: schema.leads,
        seqSteps: schema.sequences.steps,
        seqName: schema.sequences.name,
        seqId: schema.sequences.id,
      })
      .from(schema.leadSequences)
      .innerJoin(schema.leads, eq(schema.leadSequences.leadId, schema.leads.id))
      .innerJoin(schema.sequences, eq(schema.leadSequences.sequenceId, schema.sequences.id))
      .where(eq(schema.leadSequences.status, "active"))
      .limit(200);

    const dueLeads: Array<{
      lead: typeof activeLeadSeqs[number]["lead"];
      ls: typeof activeLeadSeqs[number]["ls"];
      steps: SequenceStep[];
      seqId: string;
      seqName: string;
    }> = [];

    for (const row of activeLeadSeqs) {
      if (dueLeads.length >= BATCH_LIMIT) break;

      const steps = row.seqSteps as SequenceStep[];
      const currentStepIdx = row.ls.currentStep;

      // Past all steps — not due
      if (currentStepIdx >= steps.length) continue;

      const step = steps[currentStepIdx];

      // Terminal or replied statuses — skip
      if (["in_conversation", "won", "lost", "unreachable"].includes(row.lead.status)) continue;

      // Check delay since last contact
      if (row.lead.lastContactedAt) {
        const lastContact = new Date(row.lead.lastContactedAt).getTime();
        const delayMs = step.delayDays * 24 * 60 * 60 * 1000;
        if (now.getTime() - lastContact < delayMs) continue;
      }

      dueLeads.push({
        lead: row.lead,
        ls: row.ls,
        steps,
        seqId: row.seqId,
        seqName: row.seqName,
      });
    }

    // ── 2. Check daily send cap once (shared across all leads) ───────────

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sentToday = await db
      .select()
      .from(schema.outboundMessages)
      .where(
        and(
          eq(schema.outboundMessages.direction, "outbound"),
          gte(schema.outboundMessages.createdAt, todayStart.toISOString()),
        ),
      );

    let dailySendCount = sentToday.length;

    // ── 3. Process each due lead ─────────────────────────────────────────

    for (const entry of dueLeads) {
      const { lead, ls, steps, seqId } = entry;
      const currentStep = ls.currentStep;
      const step = steps[currentStep];

      processed++;

      try {
        // ── 3a. Claim lock ───────────────────────────────────────────────

        const existingLock = await db.query.claimLocks.findFirst({
          where: eq(schema.claimLocks.leadId, lead.id),
        });

        if (existingLock) {
          const lockExpiry = new Date(existingLock.expiresAt);
          if (lockExpiry > now) {
            // Still locked by another process
            skipped++;
            continue;
          }
          // Expired lock — remove it
          await db.delete(schema.claimLocks).where(eq(schema.claimLocks.id, existingLock.id));
        }

        const lockId = crypto.randomUUID();
        const lockExpires = new Date(now.getTime() + LOCK_TTL_MINUTES * 60 * 1000);

        try {
          await db.insert(schema.claimLocks).values({
            id: lockId,
            leadId: lead.id,
            runId,
            lockedAt: nowISO,
            expiresAt: lockExpires.toISOString(),
          });
        } catch (err: any) {
          // Unique constraint race — another process claimed it
          const errStr = String(err?.message ?? "") + String(err?.cause?.message ?? "");
          if (errStr.includes("UNIQUE") || errStr.includes("SQLITE_CONSTRAINT")) {
            skipped++;
            continue;
          }
          throw err;
        }

        try {
          // ── 3b. Safety checks ────────────────────────────────────────────

          // Check if lead replied (inbound message exists)
          const inboundMsg = await db.query.outboundMessages.findFirst({
            where: and(
              eq(schema.outboundMessages.leadId, lead.id),
              eq(schema.outboundMessages.direction, "inbound"),
            ),
          });

          if (inboundMsg) {
            console.log(`[sequence-runner] skipping ${lead.email} — lead replied`);
            skipped++;
            continue;
          }

          // Check terminal status
          if (["won", "lost", "unreachable"].includes(lead.status)) {
            console.log(`[sequence-runner] skipping ${lead.email} — terminal status: ${lead.status}`);
            skipped++;
            continue;
          }

          // Check daily send cap
          if (dailySendCount >= DAILY_SEND_CAP) {
            console.log(`[sequence-runner] skipping ${lead.email} — daily cap reached`);
            skipped++;
            continue;
          }

          // Check if already sent at this step
          const alreadySent = await db.query.outboundMessages.findFirst({
            where: and(
              eq(schema.outboundMessages.leadId, lead.id),
              eq(schema.outboundMessages.sequenceStep, currentStep),
              eq(schema.outboundMessages.direction, "outbound"),
            ),
          });

          if (alreadySent) {
            console.log(`[sequence-runner] skipping ${lead.email} — already sent at step ${currentStep}`);
            skipped++;
            continue;
          }

          // ── 3c. Resolve sequence config & generate draft ─────────────────

          const sequenceConfig = await resolveSequence(seqId);
          if (!sequenceConfig) {
            console.error(`[sequence-runner] sequence ${seqId} not found`);
            skipped++;
            continue;
          }

          // Fetch previous messages for context
          const previousMessages = await db
            .select()
            .from(schema.outboundMessages)
            .where(eq(schema.outboundMessages.leadId, lead.id));

          const result = await generateFollowUp({
            lead: {
              userId: lead.userId,
              name: lead.name,
              title: lead.title,
              companyName: lead.companyName,
              companyWebsite: lead.companyWebsite,
              email: lead.email,
            },
            previousMessages: previousMessages.map((m) => ({
              direction: m.direction,
              sequenceStep: m.sequenceStep,
              subject: m.subject,
              body: m.body,
              sentAt: m.sentAt,
            })),
            sequence: sequenceConfig,
            currentStep,
            channel: step.channel,
          });

          // ── 3d. Save as draft ────────────────────────────────────────────

          const messageId = crypto.randomUUID();

          await db.insert(schema.outboundMessages).values({
            id: messageId,
            leadId: lead.id,
            direction: "outbound",
            sequenceStep: currentStep,
            channel: step.channel,
            subject: result.subject ?? null,
            body: result.body,
            status: "draft",
            metadata: JSON.stringify({
              hookUsed: result.hookUsed,
              hookSource: result.hookSource,
              runId,
              generatedAt: nowISO,
            }),
            createdAt: nowISO,
          });

          dailySendCount++;

          // ── 3e. Create notification ──────────────────────────────────────

          await db.insert(schema.notifications).values({
            userId: lead.userId!,
            type: "draft_pending",
            title: `Draft ready: ${lead.name || lead.email}`,
            body: `Step ${currentStep + 1} ${step.channel} draft for ${lead.companyName || lead.email} is ready for review.`,
            leadId: lead.id,
            messageId,
            createdAt: nowISO,
          });

          draftsCreated++;

          console.log(`[sequence-runner] draft created for ${lead.email} — step ${currentStep} (${step.channel}) source=${result.hookSource || "unknown"}`);
        } finally {
          // ── 3f. Release lock ─────────────────────────────────────────────
          await db.delete(schema.claimLocks).where(eq(schema.claimLocks.id, lockId));
        }
      } catch (err) {
        console.error(`[sequence-runner] error processing ${lead.email}:`, err);
        skipped++;
      }
    }

    return NextResponse.json({
      processed,
      drafts_created: draftsCreated,
      skipped,
      timestamp: nowISO,
    });
  } catch (error) {
    console.error("[sequence-runner] fatal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
