import { describe, it, expect } from "vitest";
import { buildVariantsSystemPrompt, buildVariantsUserPrompt, type Hook } from "./hooks";

describe("buildVariantsSystemPrompt", () => {
  it("includes channel limits", () => {
    const prompt = buildVariantsSystemPrompt();
    expect(prompt).toContain("300 characters");
    expect(prompt).toContain("1900 characters");
    expect(prompt).toContain("150 words");
    expect(prompt).toContain("200 words");
  });

  it("includes role context when provided", () => {
    const prompt = buildVariantsSystemPrompt("VP Sales");
    expect(prompt).toContain("VP Sales");
  });

  it("omits role context for General", () => {
    const prompt = buildVariantsSystemPrompt("General");
    expect(prompt).not.toContain("recipient is a General");
  });
});

describe("buildVariantsUserPrompt", () => {
  it("includes all hooks with evidence", () => {
    const hooks: Hook[] = [
      {
        news_item: 1, angle: "trigger", hook: "Test hook 1",
        evidence_snippet: "Evidence 1", source_title: "Source 1",
        source_date: "2026-03-01", source_url: "https://example.com",
        evidence_tier: "A", confidence: "high",
      },
      {
        news_item: 2, angle: "risk", hook: "Test hook 2",
        evidence_snippet: "Evidence 2", source_title: "Source 2",
        source_date: "2026-03-01", source_url: "https://example.com/2",
        evidence_tier: "B", confidence: "med",
      },
    ];
    const prompt = buildVariantsUserPrompt(hooks);
    expect(prompt).toContain("Hook 0:");
    expect(prompt).toContain("Hook 1:");
    expect(prompt).toContain("Test hook 1");
    expect(prompt).toContain("Evidence 1");
    expect(prompt).toContain("2 hooks");
  });
});
