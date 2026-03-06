import { describe, it, expect } from "vitest";
import { hashApiKey, generateApiKey } from "./auth";

describe("auth utilities", () => {
  describe("generateApiKey", () => {
    it("generates key with gsh_ prefix", () => {
      const key = generateApiKey();
      expect(key.startsWith("gsh_")).toBe(true);
    });

    it("generates 64 hex chars after prefix", () => {
      const key = generateApiKey();
      const hex = key.slice(4);
      expect(hex).toHaveLength(64);
      expect(hex).toMatch(/^[0-9a-f]+$/);
    });

    it("generates unique keys", () => {
      const keys = new Set(Array.from({ length: 10 }, () => generateApiKey()));
      expect(keys.size).toBe(10);
    });
  });

  describe("hashApiKey", () => {
    it("returns a 64-char hex string", async () => {
      const hash = await hashApiKey("gsh_test123");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("produces consistent hashes", async () => {
      const hash1 = await hashApiKey("gsh_test123");
      const hash2 = await hashApiKey("gsh_test123");
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different inputs", async () => {
      const hash1 = await hashApiKey("gsh_key1");
      const hash2 = await hashApiKey("gsh_key2");
      expect(hash1).not.toBe(hash2);
    });
  });
});
