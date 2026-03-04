import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

async function hashUrl(url: string): Promise<string> {
  const normalized = url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "")
    .toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCachedHooks(url: string) {
  const urlHash = await hashUrl(url);
  const [cached] = await db
    .select()
    .from(schema.hookCache)
    .where(eq(schema.hookCache.urlHash, urlHash))
    .limit(1);

  if (!cached) return null;
  if (new Date(cached.expiresAt) < new Date()) {
    await db.delete(schema.hookCache).where(eq(schema.hookCache.id, cached.id));
    return null;
  }
  return { hooks: cached.hooks, citations: cached.citations };
}

export async function setCachedHooks(
  url: string,
  hooks: unknown,
  citations: unknown,
) {
  const urlHash = await hashUrl(url);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  await db
    .insert(schema.hookCache)
    .values({ urlHash, url, hooks, citations, expiresAt })
    .onConflictDoUpdate({
      target: schema.hookCache.urlHash,
      set: { hooks, citations, expiresAt, createdAt: new Date().toISOString() },
    });
}
