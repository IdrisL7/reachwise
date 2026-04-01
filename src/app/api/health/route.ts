import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getClaudeApiKey } from "@/lib/env";
import {
  assessLearningLoopHealth,
  getLearningLoopForecast,
  getLearningLoopHealthStats,
  getLatestMaintenanceSnapshot,
  getLearningLoopRecommendations,
  getLearningLoopTrend,
} from "@/lib/followup/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};
  let learningLoop:
    | {
        status: "ok" | "warn" | "error";
        reasons: string[];
        stats: Awaited<ReturnType<typeof getLearningLoopHealthStats>>;
        recommendations: ReturnType<typeof getLearningLoopRecommendations>;
        trend: ReturnType<typeof getLearningLoopTrend>;
        forecast: ReturnType<typeof getLearningLoopForecast>;
      }
    | undefined;

  try {
    await db.select({ n: sql<number>`1` }).from(schema.users).limit(1);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  checks.exaApiKey = process.env.EXA_API_KEY ? "ok" : "error";
  checks.claudeApiKey = getClaudeApiKey() ? "ok" : "error";
  checks.sendgridInboundSecret = process.env.SENDGRID_INBOUND_SECRET ? "ok" : "error";

  try {
    const stats = await getLearningLoopHealthStats();
    const assessment = assessLearningLoopHealth(stats);
    const previousSnapshot = await getLatestMaintenanceSnapshot();
    const trend = getLearningLoopTrend({
      currentStats: stats,
      currentAssessment: assessment,
      previousStats: previousSnapshot?.stats,
      previousAssessment: previousSnapshot?.assessment,
      previousCapturedAt: previousSnapshot?.createdAt ?? null,
    });
    checks.learningLoop = assessment.status === "error" ? "error" : "ok";
    learningLoop = {
      status: assessment.status,
      reasons: assessment.reasons,
      stats,
      recommendations: getLearningLoopRecommendations({
        stats,
        assessment,
      }),
      trend,
      forecast: getLearningLoopForecast({
        stats,
        assessment,
        trend,
      }),
    };
  } catch {
    checks.learningLoop = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      checks,
      learningLoop,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
