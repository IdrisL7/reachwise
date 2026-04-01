import { describe, expect, it } from "vitest";
import {
  assessLearningLoopHealth,
  getLearningLoopForecast,
  getLearningLoopRecommendations,
  getLearningLoopTrend,
  type LearningLoopHealthStats,
} from "./dashboard";

function makeStats(
  overrides: Partial<LearningLoopHealthStats> = {},
): LearningLoopHealthStats {
  return {
    globalMemoryRows: 12,
    segmentMemoryRows: 8,
    pathMemoryRows: 5,
    totalMemoryRows: 25,
    staleMemoryRows: 4,
    pendingNoReplyPenalties: 2,
    recentSequenceMessages7d: 18,
    recentMessagesMissingOrchestration7d: 1,
    recentMessagesMissingOrchestrationRate: 0.06,
    ...overrides,
  };
}

describe("assessLearningLoopHealth", () => {
  it("returns ok when operational signals are healthy", () => {
    expect(assessLearningLoopHealth(makeStats())).toEqual({
      status: "ok",
      reasons: [],
    });
  });

  it("warns when no-reply learning starts to backlog", () => {
    const result = assessLearningLoopHealth(
      makeStats({ pendingNoReplyPenalties: 24 }),
    );

    expect(result.status).toBe("warn");
    expect(result.reasons[0]).toContain("24");
  });

  it("errors when orchestration attribution is missing too often", () => {
    const result = assessLearningLoopHealth(
      makeStats({
        recentMessagesMissingOrchestration7d: 8,
        recentMessagesMissingOrchestrationRate: 0.44,
      }),
    );

    expect(result.status).toBe("error");
    expect(result.reasons.some((reason) => reason.includes("orchestration metadata"))).toBe(true);
  });

  it("warns when traffic exists but learned sequence memory is still empty", () => {
    const result = assessLearningLoopHealth(
      makeStats({
        globalMemoryRows: 0,
        segmentMemoryRows: 0,
        pathMemoryRows: 0,
        totalMemoryRows: 0,
      }),
    );

    expect(result.status).toBe("warn");
    expect(result.reasons.some((reason) => reason.includes("no learned sequence memory"))).toBe(true);
  });
});

describe("getLearningLoopRecommendations", () => {
  it("returns a no-action recommendation when the loop is healthy", () => {
    const stats = makeStats();
    const assessment = assessLearningLoopHealth(stats);

    expect(
      getLearningLoopRecommendations({ stats, assessment }),
    ).toEqual([
      {
        title: "No action needed",
        action:
          "The learning loop looks healthy. Keep the maintenance cron running and watch for new alert transitions.",
        priority: "low",
      },
    ]);
  });

  it("prioritizes maintenance when no-reply backlog is high", () => {
    const stats = makeStats({ pendingNoReplyPenalties: 120 });
    const assessment = assessLearningLoopHealth(stats);
    const recommendations = getLearningLoopRecommendations({
      stats,
      assessment,
    });

    expect(recommendations[0]).toEqual({
      title: "Run follow-up maintenance",
      action:
        "Trigger the follow-up maintenance cron to backfill delayed no-reply learning and shrink the cooled-off backlog.",
      priority: "high",
    });
  });

  it("includes orchestration repair guidance when attribution is missing", () => {
    const stats = makeStats({
      recentMessagesMissingOrchestration7d: 8,
      recentMessagesMissingOrchestrationRate: 0.44,
    });
    const assessment = assessLearningLoopHealth(stats);
    const recommendations = getLearningLoopRecommendations({
      stats,
      assessment,
    });

    expect(
      recommendations.some(
        (item) =>
          item.title === "Repair orchestration attribution" &&
          item.priority === "high",
      ),
    ).toBe(true);
  });
});

describe("getLearningLoopTrend", () => {
  it("returns unknown when there is no previous maintenance snapshot", () => {
    const stats = makeStats();
    const assessment = assessLearningLoopHealth(stats);

    expect(
      getLearningLoopTrend({
        currentStats: stats,
        currentAssessment: assessment,
      }),
    ).toEqual({
      previousCapturedAt: null,
      statusChange: "unknown",
      pendingNoReplyDelta: 0,
      missingOrchestrationRateDelta: 0,
      staleMemoryDelta: 0,
      summary: "No previous maintenance snapshot is available yet.",
    });
  });

  it("marks the trend as improved when backlog and attribution issues shrink", () => {
    const previousStats = makeStats({
      pendingNoReplyPenalties: 42,
      recentMessagesMissingOrchestrationRate: 0.3,
      staleMemoryRows: 18,
    });
    const currentStats = makeStats({
      pendingNoReplyPenalties: 8,
      recentMessagesMissingOrchestrationRate: 0.06,
      staleMemoryRows: 10,
    });

    expect(
      getLearningLoopTrend({
        currentStats,
        currentAssessment: assessLearningLoopHealth(currentStats),
        previousStats,
        previousAssessment: assessLearningLoopHealth(previousStats),
        previousCapturedAt: "2026-03-30T10:00:00.000Z",
      }).statusChange,
    ).toBe("improved");
  });

  it("marks the trend as regressed when metrics worsen despite the same status", () => {
    const previousStats = makeStats({
      pendingNoReplyPenalties: 2,
      recentMessagesMissingOrchestrationRate: 0.06,
      staleMemoryRows: 4,
    });
    const currentStats = makeStats({
      pendingNoReplyPenalties: 12,
      recentMessagesMissingOrchestrationRate: 0.12,
      staleMemoryRows: 9,
    });

    expect(
      getLearningLoopTrend({
        currentStats,
        currentAssessment: assessLearningLoopHealth(currentStats),
        previousStats,
        previousAssessment: assessLearningLoopHealth(previousStats),
        previousCapturedAt: "2026-03-30T10:00:00.000Z",
      }).statusChange,
    ).toBe("regressed");
  });
});

describe("getLearningLoopForecast", () => {
  it("returns low risk when health is clean and stable", () => {
    const stats = makeStats();
    const assessment = assessLearningLoopHealth(stats);
    const trend = getLearningLoopTrend({
      currentStats: stats,
      currentAssessment: assessment,
      previousStats: stats,
      previousAssessment: assessment,
      previousCapturedAt: "2026-03-30T10:00:00.000Z",
    });

    expect(
      getLearningLoopForecast({ stats, assessment, trend }),
    ).toEqual({
      horizon: "next_maintenance_window",
      riskLevel: "low",
      likelyIssue: "No major operational issue is likely before the next maintenance window.",
      summary:
        "Current health and recent trend suggest the loop should stay stable if traffic patterns remain similar.",
    });
  });

  it("returns medium risk when the loop is warning but not collapsing", () => {
    const stats = makeStats({ pendingNoReplyPenalties: 24 });
    const assessment = assessLearningLoopHealth(stats);
    const trend = getLearningLoopTrend({
      currentStats: stats,
      currentAssessment: assessment,
      previousStats: makeStats({ pendingNoReplyPenalties: 18 }),
      previousAssessment: assessLearningLoopHealth(
        makeStats({ pendingNoReplyPenalties: 18 }),
      ),
      previousCapturedAt: "2026-03-30T10:00:00.000Z",
    });

    expect(getLearningLoopForecast({ stats, assessment, trend }).riskLevel).toBe(
      "medium",
    );
  });

  it("returns high risk when health has regressed into an error path", () => {
    const stats = makeStats({
      pendingNoReplyPenalties: 120,
      recentMessagesMissingOrchestrationRate: 0.45,
      recentMessagesMissingOrchestration7d: 9,
    });
    const assessment = assessLearningLoopHealth(stats);
    const trend = getLearningLoopTrend({
      currentStats: stats,
      currentAssessment: assessment,
      previousStats: makeStats({
        pendingNoReplyPenalties: 60,
        recentMessagesMissingOrchestrationRate: 0.2,
        recentMessagesMissingOrchestration7d: 4,
      }),
      previousAssessment: assessLearningLoopHealth(
        makeStats({
          pendingNoReplyPenalties: 60,
          recentMessagesMissingOrchestrationRate: 0.2,
          recentMessagesMissingOrchestration7d: 4,
        }),
      ),
      previousCapturedAt: "2026-03-30T10:00:00.000Z",
    });

    expect(getLearningLoopForecast({ stats, assessment, trend }).riskLevel).toBe(
      "high",
    );
  });
});
