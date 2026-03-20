import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// Bump this whenever tier rules, gating logic, or prompt templates change.
// Cached entries with a different version will be treated as stale.
export const RULES_VERSION = 25;

async function hashUrl(url: string, targetRole?: string, messagingStyle?: string): Promise<string> {
  const normalized = url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "")
    .toLowerCase();
  // Include targetRole and messagingStyle so each combination gets its own cache entry
  const rolePart = targetRole ? `::role=${targetRole}` : "";
  const stylePart = messagingStyle && messagingStyle !== "evidence" ? `::style=${messagingStyle}` : "";
  const input = `${normalized}${rolePart}${stylePart}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface CachedHookResult {
  hooks: unknown;
  citations: unknown;
  variants: unknown;
  rulesVersion: number | null;
}

export async function getCachedHooks(
  url: string,
  currentProfileUpdatedAt?: string | null,
  targetRole?: string,
  messagingStyle?: string,
): Promise<CachedHookResult | null> {
  const urlHash = await hashUrl(url, targetRole, messagingStyle);
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

  // Profile-based cache busting: if profile timestamp differs, treat as cache miss
  if (currentProfileUpdatedAt !== undefined) {
    const cachedProfileTs = cached.profileUpdatedAt ?? null;
    const currentTs = currentProfileUpdatedAt ?? null;
    if (cachedProfileTs !== currentTs) {
      return null;
    }
  }

  // Parse rulesVersion from the stored payload (column may not exist yet in old rows)
  const rulesVersion = (cached as Record<string, unknown>).rulesVersion as number | null ?? null;

  return { hooks: cached.hooks, citations: cached.citations, variants: (cached as any).variants ?? null, rulesVersion };
}

export async function setCachedHooks(
  url: string,
  hooks: unknown,
  citations: unknown,
  profileUpdatedAt?: string | null,
  targetRole?: string,
  variants?: unknown,
  messagingStyle?: string,
) {
  const urlHash = await hashUrl(url, targetRole, messagingStyle);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  await db
    .insert(schema.hookCache)
    .values({
      urlHash,
      url,
      hooks,
      citations,
      variants: variants ?? null,
      rulesVersion: RULES_VERSION,
      profileUpdatedAt: profileUpdatedAt ?? null,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: schema.hookCache.urlHash,
      set: {
        hooks,
        citations,
        variants: variants ?? null,
        rulesVersion: RULES_VERSION,
        profileUpdatedAt: profileUpdatedAt ?? null,
        expiresAt,
        createdAt: new Date().toISOString(),
      },
    });
}
