import { describe, expect, it } from "vitest";
import { assessLearningLoopHealth, type LearningLoopHealthStats } from "./dashboard";
import { decideLearningLoopAlert, planLearningLoopMaintenance } from "./maintenance";

function makeStats(
  overrides: Partial<LearningLoopHealthStats> = {},
): LearningLoopHealthStats {
  return {
    globalMemoryRows: 12,
    segmentMemoryRows: 8,
    pathMemoryRows: 5,
    totalMemoryRows: 25,
    staleMemoryRows: 4,
    pendingNoReplyPenalties: 0,
    recentSequenceMessages7d: 18,
    recentMessagesMissingOrchestration7d: 1,
    recentMessagesMissingOrchestrationRate: 0.06,
    ...overrides,
  };
}

describe("planLearningLoopMaintenance", () => {
  it("chooses observe_only when the loop is healthy", () => {
    const stats = makeStats();
    const assessment = assessLearningLoopHealth(stats);

    expect(planLearningLoopMaintenance(stats, assessment)).toEqual([
      "observe_only",
    ]);
  });

  it("prioritizes backfilling cooled-off no-reply penalties", () => {
    const stats = makeStats({ pendingNoReplyPenalties: 14 });
    const assessment = assessLearningLoopHealth(stats);

    expect(planLearningLoopMaintenance(stats, assessment)).toContain(
      "backfill_no_reply_penalties",
    );
  });

  it("still plans repair work when health is degraded", () => {
    const stats = makeStats({
      pendingNoReplyPenalties: 120,
      recentMessagesMissingOrchestration7d: 9,
      recentMessagesMissingOrchestrationRate: 0.5,
    });
    const assessment = assessLearningLoopHealth(stats);

    expect(assessment.status).toBe("error");
    expect(planLearningLoopMaintenance(stats, assessment)).toEqual([
      "backfill_no_reply_penalties",
    ]);
  });
});

describe("decideLearningLoopAlert", () => {
  it("emits an alert when status degrades from ok to warn", () => {
    const assessment = assessLearningLoopHealth(
      makeStats({ pendingNoReplyPenalties: 30 }),
    );

    expect(
      decideLearningLoopAlert({
        previous: { status: "ok", primaryReason: null },
        next: assessment,
      }),
    ).toEqual({
      event: "followup_maintenance_alert",
      reason: "Learning-loop health changed to warn.",
    });
  });

  it("does not re-emit an alert when status and primary reason are unchanged", () => {
    const assessment = assessLearningLoopHealth(
      makeStats({ pendingNoReplyPenalties: 30 }),
    );

    expect(
      decideLearningLoopAlert({
        previous: {
          status: "warn",
          primaryReason: assessment.reasons[0] ?? null,
        },
        next: assessment,
      }),
    ).toBeNull();
  });

  it("emits recovery once when the loop returns to ok", () => {
    expect(
      decideLearningLoopAlert({
        previous: {
          status: "error",
          primaryReason: "A large share of recent sequence messages were sent without orchestration metadata.",
        },
        next: { status: "ok", reasons: [] },
      }),
    ).toEqual({
      event: "followup_maintenance_recovered",
      reason: "Learning-loop health recovered to ok.",
    });
  });
});
