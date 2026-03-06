import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { classifyReply, generateSuggestedResponse } from "@/lib/reply-analysis";

export async function POST(request: NextRequest) {
  // Basic auth check — SendGrid Inbound Parse doesn't support HMAC signing
  const inboundSecret = process.env.SENDGRID_INBOUND_SECRET;
  if (inboundSecret) {
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    const authHeader = request.headers.get("authorization");
    const basicSecret = authHeader?.startsWith("Basic ")
      ? Buffer.from(authHeader.slice(6), "base64").toString().split(":")[1]
      : null;

    if (querySecret !== inboundSecret && basicSecret !== inboundSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // SendGrid Inbound Parse sends multipart form data
    const formData = await request.formData();
    const from = formData.get("from") as string;
    const subject = formData.get("subject") as string;
    const text = formData.get("text") as string;

    if (!from || !text) {
      return NextResponse.json({ status: "ok" });
    }

    // Extract email from "Name <email>" format
    const emailMatch = from.match(/<(.+?)>/);
    const senderEmail = (emailMatch ? emailMatch[1] : from.trim()).toLowerCase();

    if (!senderEmail) {
      return NextResponse.json({ status: "ok" });
    }

    // Match to lead
    const [lead] = await db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.email, senderEmail))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ status: "ok", matched: false });
    }

    // Strip quoted text
    const cleanedText = text
      .split("\n")
      .filter((line) => !line.startsWith(">"))
      .join("\n")
      .replace(/On .+ wrote:[\s\S]*$/, "")
      .replace(/[-]{2,}[\s\S]*Original Message[\s\S]*$/, "")
      .trim();

    const now = new Date().toISOString();

    // Store inbound message
    const [msg] = await db
      .insert(schema.outboundMessages)
      .values({
        leadId: lead.id,
        direction: "inbound",
        sequenceStep: lead.sequenceStep,
        channel: "email",
        subject: subject || null,
        body: cleanedText,
        sentAt: now,
        status: "sent",
      })
      .returning();

    // Track as usage event
    if (lead.userId) {
      await db.insert(schema.usageEvents).values({
        userId: lead.userId,
        event: "email_replied",
        metadata: { email: senderEmail, messageId: msg?.id, subject },
      });
    }

    // Update lead status
    await db
      .update(schema.leads)
      .set({ status: "in_conversation", updatedAt: now })
      .where(eq(schema.leads.id, lead.id));

    // Pause active sequences
    await db
      .update(schema.leadSequences)
      .set({ status: "paused", pausedAt: now })
      .where(
        and(
          eq(schema.leadSequences.leadId, lead.id),
          eq(schema.leadSequences.status, "active"),
        ),
      );

    // Classify reply
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    if (claudeApiKey) {
      const prevMessages = await db
        .select()
        .from(schema.outboundMessages)
        .where(eq(schema.outboundMessages.leadId, lead.id))
        .orderBy(desc(schema.outboundMessages.createdAt))
        .limit(5);

      const classification = await classifyReply(
        cleanedText,
        null,
        prevMessages.map((m) => ({ direction: m.direction, body: m.body })),
        claudeApiKey,
      );

      // Store classification in message metadata
      if (msg?.id) {
        await db
          .update(schema.outboundMessages)
          .set({
            metadata: {
              classification: classification.category,
              sentiment: classification.sentiment,
              summary: classification.summary,
              suggestedAction: classification.suggestedAction,
            },
          })
          .where(eq(schema.outboundMessages.id, msg.id));
      }

      // Create notification
      if (lead.userId) {
        await db.insert(schema.notifications).values({
          userId: lead.userId,
          type: "lead_replied",
          title: `${lead.name || lead.email} replied`,
          body: `${classification.summary} (${classification.category.replace(/_/g, " ")})`,
          leadId: lead.id,
          messageId: msg?.id,
        });
      }

      // Generate suggested response for actionable replies
      if (classification.suggestedAction === "respond") {
        const suggestedResponse = await generateSuggestedResponse(
          classification,
          cleanedText,
          null,
          lead.name,
          claudeApiKey,
        );

        if (suggestedResponse) {
          const [draft] = await db
            .insert(schema.outboundMessages)
            .values({
              leadId: lead.id,
              direction: "outbound",
              sequenceStep: lead.sequenceStep,
              channel: "email",
              subject: `Re: ${subject || ""}`,
              body: suggestedResponse,
              status: "draft",
            })
            .returning();

          if (draft?.id && lead.userId) {
            await db.insert(schema.notifications).values({
              userId: lead.userId,
              type: "draft_pending",
              title: `Suggested response for ${lead.name || lead.email}`,
              body: `Based on their ${classification.category.replace(/_/g, " ")} reply`,
              leadId: lead.id,
              messageId: draft.id,
            });
          }
        }
      }
    }

    return NextResponse.json({ status: "ok", matched: true, leadId: lead.id });
  } catch (error) {
    console.error("SendGrid inbound webhook error:", error);
    return NextResponse.json({ status: "ok" }); // Always 200
  }
}
