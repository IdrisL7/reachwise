import { db, schema } from "@/lib/db";

interface AuditEntry {
  userId?: string;
  leadId?: string;
  event: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      userId: entry.userId,
      leadId: entry.leadId,
      event: entry.event,
      reason: entry.reason,
      metadata: entry.metadata,
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
