import { describe, it, expect } from "vitest";
import { computeCompanyResolution } from "../src/lib/hooks";

const makeResult = (overrides: Partial<{
  title: string;
  url: string;
  description: string;
  snippet: string;
  page_age: string;
  meta_url: { hostname?: string };
}> = {}) => ({
  title: overrides.title,
  url: overrides.url,
  description: overrides.description,
  snippet: overrides.snippet,
  page_age: overrides.page_age,
  meta_url: overrides.meta_url,
});

describe("computeCompanyResolution", () => {
  it("returns no_match when there are no usable results", () => {
    const result = computeCompanyResolution("Acme", []);
    expect(result.status).toBe("no_match");
    expect(result.candidates).toHaveLength(0);
  });

  it("returns ok when there is a single distinct candidate", () => {
    const result = computeCompanyResolution("Acme", [
      makeResult({
        title: "Acme Inc.",
        url: "https://acme.com",
        description: "Official site",
        meta_url: { hostname: "acme.com" },
      }),
    ]);

    expect(result.status).toBe("ok");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      name: "Acme Inc.",
      url: "https://acme.com",
    });
  });

  it("returns needs_disambiguation when there are multiple distinct hostnames", () => {
    const result = computeCompanyResolution("Acme", [
      makeResult({
        title: "Acme Corp",
        url: "https://acme.com",
        description: "Official site",
        meta_url: { hostname: "acme.com" },
      }),
      makeResult({
        title: "Acme Widgets",
        url: "https://acmewidgets.io",
        description: "Product page",
        meta_url: { hostname: "acmewidgets.io" },
      }),
    ]);

    expect(result.status).toBe("needs_disambiguation");
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
  });
});
