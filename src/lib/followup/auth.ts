import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";

export function unauthorized(message = "Missing or invalid authorization token.") {
  return NextResponse.json(
    { status: "error", code: "UNAUTHORIZED", message },
    { status: 401 },
  );
}

export function validateBearerToken(request: Request): boolean {
  const token = process.env.FOLLOWUP_ENGINE_API_TOKEN;
  if (!token) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return false;

  return parts[1] === token;
}

/** Hash an API key using SHA-256 for storage */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a new API key with gsh_ prefix */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `gsh_${hex}`;
}

/**
 * Validate a request using either:
 * 1. Bearer token (env-based, for internal use)
 * 2. API key (gsh_ prefixed, stored in DB)
 *
 * Returns the scopes if authenticated via API key, or null if using bearer token.
 * Throws if neither auth method succeeds.
 */
export async function validateAuth(
  request: Request,
): Promise<{ method: "bearer" | "api_key"; scopes: string[] | null }> {
  // Try bearer token first (fast path)
  if (validateBearerToken(request)) {
    return { method: "bearer", scopes: null };
  }

  // Try API key
  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new AuthError();

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") throw new AuthError();

  const key = parts[1];
  if (!key.startsWith("gsh_")) throw new AuthError();

  const keyHash = await hashApiKey(key);
  const [apiKey] = await db
    .select()
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.keyHash, keyHash), isNull(schema.apiKeys.revokedAt)))
    .limit(1);

  if (!apiKey) throw new AuthError();

  // Check expiry
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    throw new AuthError("API key has expired.");
  }

  // Update last used (fire and forget)
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(schema.apiKeys.id, apiKey.id))
    .then(() => {})
    .catch(() => {});

  return { method: "api_key", scopes: apiKey.scopes };
}

/** Check if API key has the required scope. Returns 403 response if not. */
export function requireScope(
  scopes: string[] | null,
  required: string,
): NextResponse | null {
  if (scopes === null) return null; // Bearer token — no scope restrictions
  if (scopes.includes(required)) return null;

  return NextResponse.json(
    {
      status: "error",
      code: "INSUFFICIENT_SCOPE",
      message: `This API key lacks the '${required}' scope.`,
    },
    { status: 403 },
  );
}

export class AuthError extends Error {
  constructor(message = "Missing or invalid authorization token.") {
    super(message);
    this.name = "AuthError";
  }
}
