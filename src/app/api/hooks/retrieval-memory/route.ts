import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  dampenRetrievalMemory,
  getRetrievalMemorySummary,
  pinRetrievalPreference,
  resetRetrievalMemory,
  type RetrievalMemorySourceType,
  unpinRetrievalPreference,
} from "@/lib/retrieval-memory";

function isSourceType(value: string | undefined): value is RetrievalMemorySourceType {
  return value === "first_party" || value === "trusted_news" || value === "semantic_web" || value === "fallback_web";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as {
    action?: "dampen" | "reset" | "pin" | "unpin";
    sourceType?: string;
    triggerType?: string | null;
    targetRole?: string | null;
  };

  if (body.action !== "dampen" && body.action !== "reset" && body.action !== "pin" && body.action !== "unpin") {
    return NextResponse.json({ error: "action must be 'dampen', 'reset', 'pin', or 'unpin'" }, { status: 400 });
  }

  if (body.action === "dampen") {
    await dampenRetrievalMemory({
      userId: session.user.id,
      factor: 0.5,
    });
    const summary = await getRetrievalMemorySummary({
      userId: session.user.id,
      targetRole: body.targetRole ?? null,
    });

    await logAudit({
      userId: session.user.id,
      event: "hook_retrieval_memory_dampened",
      metadata: {
        factor: 0.5,
        topSourcePreferences: summary.topSourcePreferences,
        topTriggerPreferences: summary.topTriggerPreferences,
      },
    });

    return NextResponse.json({
      ok: true,
      action: "dampen",
      learnedPreferences: summary,
    });
  }

  if (body.action === "pin" || body.action === "unpin") {
    if (!isSourceType(body.sourceType)) {
      return NextResponse.json({ error: "valid sourceType is required" }, { status: 400 });
    }

    if (body.action === "pin") {
      await pinRetrievalPreference({
        userId: session.user.id,
        targetRole: body.targetRole ?? null,
        sourceType: body.sourceType,
        triggerType: body.triggerType ?? null,
      });
    } else {
      await unpinRetrievalPreference({
        userId: session.user.id,
        targetRole: body.targetRole ?? null,
        sourceType: body.sourceType,
        triggerType: body.triggerType ?? null,
      });
    }

    const summary = await getRetrievalMemorySummary({
      userId: session.user.id,
      targetRole: body.targetRole ?? null,
    });

    await logAudit({
      userId: session.user.id,
      event: body.action === "pin" ? "hook_retrieval_preference_pinned" : "hook_retrieval_preference_unpinned",
      metadata: {
        sourceType: body.sourceType,
        triggerType: body.triggerType ?? null,
        targetRole: body.targetRole ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      action: body.action,
      learnedPreferences: summary,
    });
  }

  await resetRetrievalMemory({
    userId: session.user.id,
  });
  const summary = await getRetrievalMemorySummary({
    userId: session.user.id,
    targetRole: body.targetRole ?? null,
  });

  await logAudit({
    userId: session.user.id,
    event: "hook_retrieval_memory_reset",
  });

  return NextResponse.json({
    ok: true,
    action: "reset",
    learnedPreferences: summary,
  });
}
