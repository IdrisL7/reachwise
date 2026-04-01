import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runLearningLoopMaintenance } from "@/lib/followup/maintenance";

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runLearningLoopMaintenance({
    noReplySweepLimit: 500,
  });

  return NextResponse.json({
    status:
      result.assessmentAfter.status === "error"
        ? "degraded"
        : result.assessmentAfter.status === "warn"
          ? "warn"
          : "ok",
    actions: result.actions,
    no_reply_penalized: result.noReplyPenalized,
    learning_loop: {
      before: {
        status: result.assessmentBefore.status,
        reasons: result.assessmentBefore.reasons,
        stats: result.before,
      },
      after: {
        status: result.assessmentAfter.status,
        reasons: result.assessmentAfter.reasons,
        stats: result.after,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
