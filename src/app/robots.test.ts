import { describe, it, expect } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
  it("allows crawling root", () => {
    const result = robots();
    expect(result.rules).toBeDefined();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
  });

  it("blocks /app/ and /api/", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule.disallow).toContain("/app/");
    expect(rule.disallow).toContain("/api/");
  });

  it("includes sitemap URL", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://www.getsignalhooks.com/sitemap.xml");
  });
});
