import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { generateHooksForUrl, generateChannelVariants, type Hook, type MessagingStyle } from "@/lib/hooks";
import { auth } from "@/lib/auth";
import { checkTrialActive, checkBatchSize, getLimits } from "@/lib/tier-guard";
import { researchIntentSignals, computeIntentScore, getTemperature } from "@/lib/intent";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import type { TierId } from "@/lib/tiers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BatchItemInput = {
  url: string;
  pitchContext?: string;
};

type BatchRequest = {
  items: BatchItemInput[];
  maxHooksPerUrl?: number;
  messagingStyle?: MessagingStyle;
};

type BatchItemResult = {
  url: string;
  hooks: Hook[];
  error: string | null;
  suggestion?: string;
  lowSignal?: boolean;
  hookVariants?: Array<{ hook_index: number; variants: Array<{ channel: string; text: string }> }>;
  intent?: { score: number; temperature: string; signalsCount: number } | null;
};

type BatchResponse = {
  results: BatchItemResult[];
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Trial check
    const trialCheck = await checkTrialActive(session.user.id);
    if (trialCheck) return trialCheck;

    const body = (await request.json().catch(() => null)) as BatchRequest | null;

    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Missing 'items' array in request body." },
        { status: 400 },
      );
    }

    // Get user tier
    const [user] = await db
      .select({ tierId: schema.users.tierId, hooksUsedThisMonth: schema.users.hooksUsedThisMonth })
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id))
      .limit(1);

    const tierId = (user?.tierId as TierId) || "starter";
    const limits = getLimits(tierId);

    // Check batch size against tier limit
    const batchCheck = checkBatchSize(tierId, body.items.length);
    if (batchCheck) return batchCheck;

    // Check remaining hook quota
    const remaining = limits.hooksPerMonth - (user?.hooksUsedThisMonth ?? 0);
    if (remaining < body.items.length) {
      return NextResponse.json(
        {
          status: "error",
          code: "TIER_LIMIT",
          message: `You have ${remaining} hook generation${remaining !== 1 ? "s" : ""} remaining this month, but requested ${body.items.length}. Upgrade for more.`,
        },
        { status: 402 },
      );
    }

    const maxHooksPerUrl = body.maxHooksPerUrl;
    const VALID_MESSAGING_STYLES: MessagingStyle[] = ["evidence", "challenger", "implication", "risk"];
    const messagingStyle: MessagingStyle =
      body.messagingStyle && VALID_MESSAGING_STYLES.includes(body.messagingStyle)
        ? body.messagingStyle
        : "evidence";

    const results: BatchItemResult[] = await Promise.all(
      body.items.map(async (item): Promise<BatchItemResult> => {
        const url = item.url?.trim();

        if (!url) {
          return { url: "", hooks: [], error: "Missing url" };
        }

        try {
          const result = await generateHooksForUrl({
            url,
            pitchContext: item.pitchContext,
            count: maxHooksPerUrl,
            messagingStyle,
          });
          let itemVariants: Array<{ hook_index: number; variants: Array<{ channel: string; text: string }> }> | undefined;
          if ((tierId === "pro" || tierId === "concierge") && result.hooks.length > 0) {
            try {
              const claudeKey = process.env.CLAUDE_API_KEY!;
              const withVars = await generateChannelVariants(result.hooks, claudeKey);
              itemVariants = withVars.map((h, i) => ({ hook_index: i, variants: h.variants }));
            } catch {}
          }
          let intentData: { score: number; temperature: string; signalsCount: number } | null = null;
          if ((tierId === "pro" || tierId === "concierge") && result.hooks.length > 0) {
            try {
              const tavilyKey = process.env.EXA_API_KEY;
              const claudeKey = process.env.CLAUDE_API_KEY;
              if (tavilyKey && claudeKey) {
                // Derive company name from URL hostname
                let companyName: string;
                try {
                  companyName = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").split(".")[0];
                } catch {
                  companyName = url;
                }
                const signals = await researchIntentSignals(url, companyName, tavilyKey, claudeKey);
                const score = computeIntentScore(signals);
                intentData = {
                  score,
                  temperature: getTemperature(score),
                  signalsCount: signals.length,
                };
              }
            } catch {
              // Non-blocking
            }
          }
          return {
            url,
            hooks: result.hooks,
            error: null,
            suggestion: result.suggestion,
            lowSignal: result.lowSignal,
            hookVariants: itemVariants,
            intent: intentData,
          };
        } catch (err) {
          console.error(`generate-hooks-batch: failed for ${url}`, err);
          return { url, hooks: [], error: "Failed to generate hooks" };
        }
      }),
    );

    // Increment hook usage by the number of successful results
    const successCount = results.filter((r) => !r.error).length;
    if (successCount > 0) {
      await db
        .update(schema.users)
        .set({
          hooksUsedThisMonth: sql`${schema.users.hooksUsedThisMonth} + ${successCount}`,
        })
        .where(eq(schema.users.id, session.user.id));
    }

    const response: BatchResponse = { results };
    return NextResponse.json(response);
  } catch (error) {
    Sentry.captureException(error);
    console.error("Unexpected error in /api/generate-hooks-batch", error);
    return NextResponse.json(
      { error: "Unexpected server error while generating hooks batch." },
      { status: 500 },
    );
  }
}
