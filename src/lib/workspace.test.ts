import { describe, it, expect } from "vitest";
import { OFFER_CATEGORIES, PROFILE_PRESETS, type OfferCategory } from "./workspace";

describe("OFFER_CATEGORIES", () => {
  it("has exactly 10 categories", () => {
    expect(OFFER_CATEGORIES).toHaveLength(10);
  });

  it("contains no duplicates", () => {
    const unique = new Set(OFFER_CATEGORIES);
    expect(unique.size).toBe(OFFER_CATEGORIES.length);
  });
});

describe("PROFILE_PRESETS", () => {
  it("has exactly 6 presets", () => {
    expect(PROFILE_PRESETS).toHaveLength(6);
  });

  it("each preset has a valid offerCategory", () => {
    for (const preset of PROFILE_PRESETS) {
      expect(OFFER_CATEGORIES).toContain(preset.offerCategory);
    }
  });

  it("each preset has all required fields", () => {
    const requiredFields = [
      "label",
      "whatYouSell",
      "icpIndustry",
      "icpCompanySize",
      "buyerRoles",
      "primaryOutcome",
      "offerCategory",
    ] as const;

    for (const preset of PROFILE_PRESETS) {
      for (const field of requiredFields) {
        expect(preset[field], `${preset.label} missing ${field}`).toBeDefined();
      }
      expect(
        Array.isArray(preset.buyerRoles) && preset.buyerRoles.length > 0,
        `${preset.label} buyerRoles should be a non-empty array`,
      ).toBe(true);
      expect(
        preset.whatYouSell.length > 0,
        `${preset.label} whatYouSell should be non-empty`,
      ).toBe(true);
    }
  });

  it("each preset has a unique label", () => {
    const labels = PROFILE_PRESETS.map((p) => p.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});
