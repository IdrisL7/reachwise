import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken } from "@/lib/followup/auth";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { SequenceStep } from "@/lib/db/schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Accept both bearer token (n8n) and session auth (UI)
  const session = await auth();
  const hasBearerToken = validateBearerToken(request);

  if (!session?.user?.id && !hasBearerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => ({})) as {
    currentStep?: number;
    status?: "active" | "paused" | "completed";
  };

  // Find lead_sequence
  const [ls] = await db
    .select()
    .from(schema.leadSequences)
    .where(eq(schema.leadSequences.id, id))
    .limit(1);

  if (!ls) {
    return NextResponse.json({ error: "Lead sequence not found" }, { status: 404 });
  }

  // If session auth, verify ownership through lead
  if (session?.user?.id && !hasBearerToken) {
    const [lead] = await db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, ls.leadId))
      .limit(1);

    if (!lead || lead.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};

  if (body.currentStep !== undefined) {
    updates.currentStep = body.currentStep;

    // Check if sequence is complete
    const [seq] = await db
      .select()
      .from(schema.sequences)
      .where(eq(schema.sequences.id, ls.sequenceId))
      .limit(1);

    if (seq) {
      const steps = seq.steps as SequenceStep[];
      if (body.currentStep >= steps.length) {
        updates.status = "completed";
        updates.completedAt = now;

        // Create completion notification
        const [lead] = await db
          .select()
          .from(schema.leads)
          .where(eq(schema.leads.id, ls.leadId))
          .limit(1);

        if (lead?.userId) {
          await db.insert(schema.notifications).values({
            userId: lead.userId,
            type: "sequence_completed",
            title: `Sequence completed for ${lead.name || lead.email}`,
            body: `${seq.name} has finished all ${steps.length} steps.`,
            leadId: lead.id,
          });
        }
      }
    }
  }

  if (body.status) {
    updates.status = body.status;
    if (body.status === "paused") updates.pausedAt = now;
    if (body.status === "completed") updates.completedAt = now;
    if (body.status === "active") updates.pausedAt = null;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(schema.leadSequences)
      .set(updates)
      .where(eq(schema.leadSequences.id, id));
  }

  // Return updated record
  const [updated] = await db
    .select()
    .from(schema.leadSequences)
    .where(eq(schema.leadSequences.id, id))
    .limit(1);

  return NextResponse.json({ leadSequence: updated });
}
