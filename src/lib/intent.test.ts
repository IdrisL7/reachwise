import { describe, it, expect } from "vitest";
import {
  buildHiringQuery,
  buildFundingQuery,
  buildTechChangeQuery,
  computeIntentScore,
  getTemperature,
  type IntentSignal,
} from "./intent";

describe("intent query builders", () => {
  it("builds hiring query with company name", () => {
    const q = buildHiringQuery("Gong");
    expect(q).toContain("Gong");
    expect(q).toContain("hiring");
    expect(q).not.toContain("-site:gong.io");
  });

  it("builds funding query with company name", () => {
    const q = buildFundingQuery("Gong");
    expect(q).toContain("Gong");
    expect(q).toContain("funding");
    expect(q).not.toContain("-site:gong.io");
  });

  it("builds tech change query with company name", () => {
    const q = buildTechChangeQuery("Gong");
    expect(q).toContain("Gong");
    expect(q).toContain("migrated");
    expect(q).not.toContain("-site:gong.io");
  });
});

describe("computeIntentScore", () => {
  it("returns 0 for no signals", () => {
    expect(computeIntentScore([])).toBe(0);
  });

  it("scores hiring signal correctly", () => {
    const signals: IntentSignal[] = [
      { type: "hiring", summary: "Hiring SDRs", confidence: 0.9, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
    ];
    const score = computeIntentScore(signals);
    // 25 * 0.9 = 22.5 → 23 (rounded) + 10 recency = 33
    expect(score).toBeGreaterThanOrEqual(30);
  });

  it("scores funding signal correctly", () => {
    const signals: IntentSignal[] = [
      { type: "funding", summary: "Series B", confidence: 0.9, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
    ];
    const score = computeIntentScore(signals);
    // 20 * 0.9 = 18 + 10 recency = 28
    expect(score).toBeGreaterThanOrEqual(25);
  });

  it("caps at 100", () => {
    const signals: IntentSignal[] = [
      { type: "hiring", summary: "a", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
      { type: "funding", summary: "b", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
      { type: "tech_change", summary: "c", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
      { type: "growth", summary: "d", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
      { type: "news", summary: "e", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
    ];
    expect(computeIntentScore(signals)).toBeLessThanOrEqual(100);
  });

  it("applies compound bonus for 3+ signal types", () => {
    const base: IntentSignal = { type: "hiring", summary: "a", confidence: 0.8, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" };
    const twoSignals = [
      { ...base, type: "hiring" as const },
      { ...base, type: "funding" as const },
    ];
    const threeSignals = [
      ...twoSignals,
      { ...base, type: "tech_change" as const },
    ];
    const twoScore = computeIntentScore(twoSignals);
    const threeScore = computeIntentScore(threeSignals);
    expect(threeScore - twoScore).toBeGreaterThan(15);
  });

  it("applies recency bonus for signals < 7 days old", () => {
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const newDate = new Date().toISOString();

    const oldSignal: IntentSignal[] = [
      { type: "hiring", summary: "a", confidence: 0.9, sourceUrl: "", detectedAt: oldDate, rawEvidence: "" },
    ];
    const newSignal: IntentSignal[] = [
      { type: "hiring", summary: "a", confidence: 0.9, sourceUrl: "", detectedAt: newDate, rawEvidence: "" },
    ];

    expect(computeIntentScore(newSignal) - computeIntentScore(oldSignal)).toBe(10);
  });
});

describe("getTemperature", () => {
  it("returns hot for 70+", () => {
    expect(getTemperature(70)).toBe("hot");
    expect(getTemperature(100)).toBe("hot");
  });

  it("returns warm for 40-69", () => {
    expect(getTemperature(40)).toBe("warm");
    expect(getTemperature(69)).toBe("warm");
  });

  it("returns cold for 0-39", () => {
    expect(getTemperature(0)).toBe("cold");
    expect(getTemperature(39)).toBe("cold");
  });
});
