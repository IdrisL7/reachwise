/**
 * Enhanced caching system for GetSignalHooks
 * Provides multi-level caching for hooks, sources, and intermediate results
 */

import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// Bump this whenever tier rules, gating logic, or prompt templates change.
export const RULES_VERSION = 19;

// Cache TTLs for different data types
const CACHE_DURATIONS = {
  HOOKS: 48 * 60 * 60 * 1000,        // 48 hours (existing)
  SOURCES: 6 * 60 * 60 * 1000,       // 6 hours (new)
  COMPANY_INTEL: 24 * 60 * 60 * 1000, // 24 hours (new)
  INTENT_SIGNALS: 12 * 60 * 60 * 1000, // 12 hours (new)
  EXA_RESULTS: 4 * 60 * 60 * 1000,  // 4 hours (new)
} as const;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  version: number;
}

/**
 * In-memory cache for hot data (with TTL cleanup)
 * Reduces database hits for frequently accessed data
 */
class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  set<T>(key: string, data: T, ttl: number, version: number = RULES_VERSION): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      version,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Check version compatibility
    if (entry.version !== RULES_VERSION) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt || entry.version !== RULES_VERSION) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Global in-memory cache instance
const memCache = new InMemoryCache();

/**
 * Async hash function (non-blocking)
 */
async function hashKey(...parts: string[]): Promise<string> {
  const input = parts.join('::');
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Multi-level cache: Check memory first, then database, with write-through
 */
export class EnhancedCache {
  /**
   * Get cached hooks (existing functionality, enhanced with memory cache)
   */
  static async getHooks(
    url: string,
    profileUpdatedAt?: string | null,
    targetRole?: string,
  ): Promise<{ hooks: any; citations: any; variants: any } | null> {
    const memKey = `hooks:${url}:${targetRole || 'general'}:${profileUpdatedAt || 'none'}`;
    
    // Check memory cache first
    const cached = memCache.get(memKey) as { hooks: any; citations: any; variants: any } | undefined;
    if (cached && cached.hooks && cached.citations !== undefined && cached.variants !== undefined) {
      console.log('[CACHE] Hook memory hit:', url);
      return cached;
    }

    // Check database cache
    const urlHash = await hashKey(url, targetRole || '');
    const [dbCached] = await db
      .select()
      .from(schema.hookCache)
      .where(eq(schema.hookCache.urlHash, urlHash))
      .limit(1);

    if (!dbCached) return null;

    // Check expiration
    if (new Date(dbCached.expiresAt) < new Date()) {
      await db.delete(schema.hookCache).where(eq(schema.hookCache.id, dbCached.id));
      return null;
    }

    // Check profile staleness
    if (profileUpdatedAt !== undefined) {
      const cachedProfileTs = dbCached.profileUpdatedAt ?? null;
      const currentTs = profileUpdatedAt ?? null;
      if (cachedProfileTs !== currentTs) return null;
    }

    // Check rules version
    const rulesVersion = (dbCached as any).rulesVersion ?? null;
    if (rulesVersion !== RULES_VERSION) return null;

    const result = {
      hooks: dbCached.hooks,
      citations: dbCached.citations,
      variants: (dbCached as any).variants ?? null,
    };

    // Store in memory cache for next time
    memCache.set(memKey, result, CACHE_DURATIONS.HOOKS);
    console.log('[CACHE] Hook database hit:', url);
    
    return result;
  }

  /**
   * Cache hooks with memory write-through
   */
  static async setHooks(
    url: string,
    hooks: any,
    citations: any,
    profileUpdatedAt?: string | null,
    targetRole?: string,
    variants?: any,
  ): Promise<void> {
    const urlHash = await hashKey(url, targetRole || '');
    const expiresAt = new Date(Date.now() + CACHE_DURATIONS.HOOKS).toISOString();

    // Store in database
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

    // Store in memory cache
    const memKey = `hooks:${url}:${targetRole || 'general'}:${profileUpdatedAt || 'none'}`;
    memCache.set(memKey, { hooks, citations, variants }, CACHE_DURATIONS.HOOKS);
  }

  /**
   * Cache source discovery results (NEW)
   */
  static async getSources(url: string): Promise<any[] | null> {
    const memKey = `sources:${url}`;
    
    // Check memory cache first  
    const cached = memCache.get<any[]>(memKey);
    if (cached) {
      console.log('[CACHE] Source memory hit:', url);
      return cached;
    }

    return null; // For now, only use memory cache for sources
  }

  static async setSources(url: string, sources: any[]): Promise<void> {
    const memKey = `sources:${url}`;
    memCache.set(memKey, sources, CACHE_DURATIONS.SOURCES);
    console.log('[CACHE] Sources cached:', url, sources.length);
  }

  /**
   * Cache company intelligence results (NEW)
   */
  static async getCompanyIntel(url: string): Promise<any | null> {
    const memKey = `intel:${url}`;
    return memCache.get(memKey);
  }

  static async setCompanyIntel(url: string, intel: any): Promise<void> {
    const memKey = `intel:${url}`;
    memCache.set(memKey, intel, CACHE_DURATIONS.COMPANY_INTEL);
    console.log('[CACHE] Company intel cached:', url);
  }

  /**
   * Cache intent signals (NEW)
   */
  static async getIntentSignals(url: string, companyName: string): Promise<any[] | null> {
    const memKey = `intent:${url}:${companyName}`;
    return memCache.get(memKey);
  }

  static async setIntentSignals(url: string, companyName: string, signals: any[]): Promise<void> {
    const memKey = `intent:${url}:${companyName}`;
    memCache.set(memKey, signals, CACHE_DURATIONS.INTENT_SIGNALS);
    console.log('[CACHE] Intent signals cached:', url, signals.length);
  }

  /**
   * Cache Exa API results (NEW)
   */
  static async getExaResult(query: string): Promise<any | null> {
    const memKey = `exa:${await hashKey(query)}`;
    return memCache.get(memKey);
  }

  static async setExaResult(query: string, result: any): Promise<void> {
    const memKey = `exa:${await hashKey(query)}`;
    memCache.set(memKey, result, CACHE_DURATIONS.EXA_RESULTS);
  }

  /**
   * Clear all caches (for testing/debugging)
   */
  static clearAll(): void {
    memCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getStats(): { memoryEntries: number } {
    return {
      memoryEntries: (memCache as any).cache.size,
    };
  }
}

// Export backward-compatible functions for existing code
export async function getCachedHooks(
  url: string,
  profileUpdatedAt?: string | null,
  targetRole?: string,
) {
  const result = await EnhancedCache.getHooks(url, profileUpdatedAt, targetRole);
  if (!result) return null;
  
  return {
    ...result,
    rulesVersion: RULES_VERSION,
  };
}

export async function setCachedHooks(
  url: string,
  hooks: any,
  citations: any,
  profileUpdatedAt?: string | null,
  targetRole?: string,
  variants?: any,
) {
  return EnhancedCache.setHooks(url, hooks, citations, profileUpdatedAt, targetRole, variants);
}