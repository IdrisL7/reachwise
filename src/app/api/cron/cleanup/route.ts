import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, schema } from "@/lib/db";
import { lt } from "drizzle-orm";

/** GET /api/cron/cleanup — clean up expired claim locks, rate limits, and hook cache */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expected = `Bearer ${cronSecret}`;
  const isValid =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  await db.delete(schema.claimLocks).where(lt(schema.claimLocks.expiresAt, now));
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.resetAt, now));
  await db.delete(schema.hookCache).where(lt(schema.hookCache.expiresAt, now));

  return NextResponse.json({
    cleaned: ["claimLocks", "rateLimits", "hookCache"],
    timestamp: now,
  });
}
