import { describe, expect, it } from "vitest";
import { inferHookOutcomeFromReply } from "./hook-feedback";

describe("inferHookOutcomeFromReply", () => {
  it("treats interested replies as reply wins", () => {
    expect(
      inferHookOutcomeFromReply({
        category: "interested",
        sentiment: "positive",
        suggestedAction: "respond",
      }),
    ).toBe("reply_win");
  });

  it("treats constructive objection replies as positive replies", () => {
    expect(
      inferHookOutcomeFromReply({
        category: "objection_timing",
        sentiment: "neutral",
        suggestedAction: "respond",
      }),
    ).toBe("positive_reply");
  });

  it("ignores replies that should not strengthen hook memory", () => {
    expect(
      inferHookOutcomeFromReply({
        category: "unsubscribe",
        sentiment: "negative",
        suggestedAction: "stop",
      }),
    ).toBeNull();

    expect(
      inferHookOutcomeFromReply({
        category: "wrong_person",
        sentiment: "neutral",
        suggestedAction: "reassign",
      }),
    ).toBeNull();
  });
});
