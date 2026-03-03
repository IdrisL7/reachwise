import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { prospectDb, prospectSchema } from "@/lib/prospect-agent/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { checkDailyLimit, checkLeadCooldown } from "@/lib/prospect-agent/limits";
import { generateDmText, classifyLeadTypeWithAI } from "@/lib/prospect-agent/generate-dm";

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();
    const {
      mode,
      limit = 10,
      context,
      daily_cap = 20,
      cooldown_days = 30,
    } = body;

    if (!mode || !["auto", "review"].includes(mode)) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "mode must be 'auto' or 'review'." },
        { status: 400 },
      );
    }

    // Check daily limit
    const dailyCheck = await checkDailyLimit(daily_cap);
    if (!dailyCheck.allowed) {
      return NextResponse.json({
        status: "rate_limited",
        message: `Daily DM cap reached (${dailyCheck.sent}/${daily_cap}).`,
        sent_today: dailyCheck.sent,
        daily_cap,
      }, { status: 429 });
    }

    const maxToSend = Math.min(limit, dailyCheck.remaining);

    // Find eligible leads: have linkedin_url, status is "new", not recently DM'd
    const eligibleLeads = await prospectDb
      .select()
      .from(prospectSchema.prospectLeads)
      .where(
        and(
          isNotNull(prospectSchema.prospectLeads.linkedinUrl),
          eq(prospectSchema.prospectLeads.status, "new"),
        ),
      )
      .limit(maxToSend * 3); // fetch extra to filter by cooldown

    // Filter by cooldown
    const filteredLeads = [];
    for (const lead of eligibleLeads) {
      if (filteredLeads.length >= maxToSend) break;

      const cooldownCheck = await checkLeadCooldown(lead.id, cooldown_days);
      if (cooldownCheck.allowed) {
        filteredLeads.push(lead);
      }
    }

    if (filteredLeads.length === 0) {
      return NextResponse.json({
        status: "ok",
        message: "No eligible leads found (all either DM'd recently or missing LinkedIn URL).",
        dms: [],
        generated: 0,
      });
    }

    // Generate DMs and insert into log
    const dms = [];
    const errors = [];

    for (const lead of filteredLeads) {
      try {
        const leadInfo = {
          name: lead.name,
          title: lead.title,
          companyName: lead.companyName,
          companyWebsite: lead.companyWebsite,
          linkedinHeadline: lead.linkedinHeadline,
        };

        const leadType = await classifyLeadTypeWithAI(leadInfo);
        const dmText = await generateDmText(leadInfo, context);

        const status = mode === "auto" ? "sent" : "queued";
        const sentAt = mode === "auto" ? new Date().toISOString() : null;

        const [dmRecord] = await prospectDb
          .insert(prospectSchema.dmLog)
          .values({
            leadId: lead.id,
            dmText,
            status,
            sentAt,
          })
          .returning();

        // Update lead status and lastContactedAt
        const leadStatus = mode === "auto" ? "dm_sent" : "dm_queued";
        await prospectDb
          .update(prospectSchema.prospectLeads)
          .set({
            status: leadStatus,
            lastContactedAt: mode === "auto" ? new Date().toISOString() : undefined,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(prospectSchema.prospectLeads.id, lead.id));

        dms.push({
          dm_id: dmRecord.id,
          lead_id: lead.id,
          lead_name: lead.name,
          lead_type: leadType,
          linkedin_url: lead.linkedinUrl,
          dm_text: dmText,
          status,
          sent_at: sentAt,
        });
      } catch (err: any) {
        errors.push({
          lead_id: lead.id,
          lead_name: lead.name,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      status: "ok",
      mode,
      generated: dms.length,
      errors: errors.length,
      daily_usage: {
        sent_today: dailyCheck.sent + (mode === "auto" ? dms.length : 0),
        daily_cap,
        remaining: dailyCheck.remaining - (mode === "auto" ? dms.length : 0),
      },
      dms,
      ...(errors.length > 0 ? { error_details: errors } : {}),
    });
  } catch (error) {
    console.error("Send DMs error:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to generate/send DMs." },
      { status: 500 },
    );
  }
}
