import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap.xml", () => {
  it("includes homepage with priority 1", () => {
    const result = sitemap();
    const homepage = result.find((entry) => entry.url === "https://www.getsignalhooks.com");
    expect(homepage).toBeDefined();
    expect(homepage!.priority).toBe(1);
  });

  it("includes login page", () => {
    const result = sitemap();
    const login = result.find((entry) => entry.url === "https://www.getsignalhooks.com/login");
    expect(login).toBeDefined();
    expect(login!.priority).toBe(0.5);
  });

  it("does not include app routes", () => {
    const result = sitemap();
    const appRoutes = result.filter((entry) => entry.url.includes("/app"));
    expect(appRoutes).toHaveLength(0);
  });
});
