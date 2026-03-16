import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { SenderContext } from "@/lib/workspace";

/**
 * Finds the user's existing workspace or creates a default one.
 * Returns the workspace id.
 */
export async function getOrCreateDefaultWorkspace(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerUserId, userId))
    .limit(1);

  if (existing) return existing.id;

  const [ws] = await db
    .insert(schema.workspaces)
    .values({ ownerUserId: userId })
    .returning({ id: schema.workspaces.id });

  return ws.id;
}

/**
 * Returns the workspace profile as a SenderContext, or null if not set.
 */
export async function getWorkspaceProfile(
  workspaceId: string,
): Promise<SenderContext | null> {
  const [profile] = await db
    .select()
    .from(schema.workspaceProfiles)
    .where(eq(schema.workspaceProfiles.workspaceId, workspaceId))
    .limit(1);

  if (!profile) return null;

  return {
    whatYouSell: profile.whatYouSell,
    icpIndustry: profile.icpIndustry,
    icpCompanySize: profile.icpCompanySize,
    buyerRoles: profile.buyerRoles,
    primaryOutcome: profile.primaryOutcome,
    offerCategory: profile.offerCategory as SenderContext["offerCategory"],
    proof: profile.proof,
    voiceTone: profile.voiceTone ?? null,
  };
}

/**
 * Returns the profile's updatedAt timestamp, or null if no profile exists.
 */
export async function getProfileUpdatedAt(
  workspaceId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ updatedAt: schema.workspaceProfiles.updatedAt })
    .from(schema.workspaceProfiles)
    .where(eq(schema.workspaceProfiles.workspaceId, workspaceId))
    .limit(1);

  return row?.updatedAt ?? null;
}

/**
 * Convenience: resolve the default workspace id for a user.
 */
export async function resolveWorkspaceId(userId: string): Promise<string> {
  return getOrCreateDefaultWorkspace(userId);
}
