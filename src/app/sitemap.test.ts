import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap.xml", () => {
  it("includes homepage with priority 1", async () => {
    const result = await sitemap();
    const homepage = result.find((entry) => entry.url === "https://www.getsignalhooks.com");
    expect(homepage).toBeDefined();
    expect(homepage!.priority).toBe(1);
  });

  it("includes docs page", async () => {
    const result = await sitemap();
    const docs = result.find((entry) => entry.url === "https://www.getsignalhooks.com/docs");
    expect(docs).toBeDefined();
    expect(docs!.priority).toBe(0.7);
  });

  it("does not include app routes", async () => {
    const result = await sitemap();
    const appRoutes = result.filter((entry) => entry.url.includes("/app"));
    expect(appRoutes).toHaveLength(0);
  });
});
