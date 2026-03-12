import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { pushHookToHubSpot } from "@/lib/integrations/hubspot";
import { pushHookToSalesforce } from "@/lib/integrations/salesforce";

type Body = {
  hookId?: string;
  batchId?: string;
  provider?: "hubspot" | "salesforce";
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.hookId && !body.batchId) {
    return NextResponse.json({ error: "hookId or batchId is required" }, { status: 400 });
  }

  const where = body.hookId
    ? and(eq(schema.generatedHooks.id, body.hookId), eq(schema.generatedHooks.userId, session.user.id))
    : and(eq(schema.generatedHooks.batchId, body.batchId!), eq(schema.generatedHooks.userId, session.user.id));

  const hooks = await db.select().from(schema.generatedHooks).where(where).limit(200);
  if (hooks.length === 0) {
    return NextResponse.json({ error: "No hooks found" }, { status: 404 });
  }

  const integrations = await db
    .select()
    .from(schema.integrations)
    .where(and(
      eq(schema.integrations.userId, session.user.id),
      eq(schema.integrations.status, "active"),
      body.provider ? eq(schema.integrations.provider, body.provider) : inArray(schema.integrations.provider, ["hubspot", "salesforce"]),
    ));

  if (integrations.length === 0) {
    return NextResponse.json({ error: "No active CRM integration found" }, { status: 400 });
  }

  const pushedHookIds: string[] = [];
  const errors: string[] = [];

  for (const hook of hooks) {
    for (const integration of integrations) {
      try {
        let crmRecordId: string | undefined;
        if (integration.provider === "hubspot") {
          crmRecordId = await pushHookToHubSpot(integration.id, {
            companyName: hook.companyName,
            companyUrl: hook.companyUrl,
            hookText: hook.hookText,
            sourceUrl: hook.sourceUrl || undefined,
            sourceTitle: hook.sourceTitle || undefined,
            sourceDate: hook.sourceDate || undefined,
            sourceSnippet: hook.sourceSnippet || undefined,
            qualityScore: hook.qualityScore,
          });
        } else {
          crmRecordId = await pushHookToSalesforce(integration.id, {
            companyName: hook.companyName,
            companyUrl: hook.companyUrl,
            hookText: hook.hookText,
            sourceUrl: hook.sourceUrl || undefined,
            sourceTitle: hook.sourceTitle || undefined,
            sourceDate: hook.sourceDate || undefined,
            sourceSnippet: hook.sourceSnippet || undefined,
            qualityScore: hook.qualityScore,
          });
        }

        await db.insert(schema.hookCrmPushes).values({
          generatedHookId: hook.id,
          userId: session.user.id,
          provider: integration.provider,
          crmRecordId: crmRecordId || null,
          status: "success",
        });

        if (!pushedHookIds.includes(hook.id)) pushedHookIds.push(hook.id);
      } catch (err) {
        const message = (err as Error).message;
        errors.push(`${integration.provider}:${hook.id}:${message}`);
        await db.insert(schema.hookCrmPushes).values({
          generatedHookId: hook.id,
          userId: session.user.id,
          provider: integration.provider,
          status: "failed",
          errorMessage: message,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    pushed: pushedHookIds.length,
    pushedHookIds,
    errors,
  });
}
