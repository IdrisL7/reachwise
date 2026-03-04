import { NextRequest, NextResponse } from "next/server";
import {
  validateBearerToken,
  unauthorized,
  generateApiKey,
  hashApiKey,
} from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, isNull } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

const VALID_SCOPES = ["leads", "hooks", "followups", "templates"] as const;

/** POST /api/api-keys — create a new API key (bearer-token-only, admin action) */
export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "name is required." },
        { status: 400 },
      );
    }

    const scopes = body.scopes ?? ["leads", "hooks", "followups"];
    for (const s of scopes) {
      if (!VALID_SCOPES.includes(s)) {
        return NextResponse.json(
          {
            status: "error",
            code: "INVALID_SCOPE",
            message: `Invalid scope '${s}'. Valid: ${VALID_SCOPES.join(", ")}`,
          },
          { status: 400 },
        );
      }
    }

    const expiresAt = body.expires_at ?? null;
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12); // "gsh_xxxxxxxx"

    const [record] = await db
      .insert(schema.apiKeys)
      .values({ name, keyHash, keyPrefix, scopes, expiresAt })
      .returning();

    logAudit({
      event: "api_key_created",
      metadata: { keyId: record.id, name: record.name, scopes: record.scopes },
    }).catch(() => {});

    return NextResponse.json(
      {
        id: record.id,
        name: record.name,
        key: rawKey, // only shown once
        key_prefix: record.keyPrefix,
        scopes: record.scopes,
        expires_at: record.expiresAt,
        created_at: record.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to create API key." },
      { status: 500 },
    );
  }
}

/** GET /api/api-keys — list all active API keys (bearer-token-only) */
export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const keys = await db
      .select({
        id: schema.apiKeys.id,
        name: schema.apiKeys.name,
        keyPrefix: schema.apiKeys.keyPrefix,
        scopes: schema.apiKeys.scopes,
        lastUsedAt: schema.apiKeys.lastUsedAt,
        expiresAt: schema.apiKeys.expiresAt,
        createdAt: schema.apiKeys.createdAt,
      })
      .from(schema.apiKeys)
      .where(isNull(schema.apiKeys.revokedAt));

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("Error listing API keys:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to list API keys." },
      { status: 500 },
    );
  }
}

/** DELETE /api/api-keys — revoke an API key (bearer-token-only) */
export async function DELETE(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { status: "error", code: "INVALID_PARAMS", message: "id query param required." },
        { status: 400 },
      );
    }

    const [revoked] = await db
      .update(schema.apiKeys)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(schema.apiKeys.id, id))
      .returning();

    if (!revoked) {
      return NextResponse.json(
        { status: "error", code: "NOT_FOUND", message: "API key not found." },
        { status: 404 },
      );
    }

    logAudit({
      event: "api_key_revoked",
      metadata: { keyId: revoked.id, name: revoked.name },
    }).catch(() => {});

    return NextResponse.json({ status: "ok", revoked: revoked.id });
  } catch (error) {
    console.error("Error revoking API key:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to revoke API key." },
      { status: 500 },
    );
  }
}
