import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { SequenceStep } from "@/lib/db/schema";

const PRESET_TEMPLATES: Array<{ name: string; steps: SequenceStep[] }> = [
  {
    name: "Email Only (3-step)",
    steps: [
      { order: 0, channel: "email", delayDays: 0, type: "first" },
      { order: 1, channel: "email", delayDays: 3, type: "bump" },
      { order: 2, channel: "email", delayDays: 5, type: "breakup" },
    ],
  },
  {
    name: "Multi-Channel (5-step)",
    steps: [
      { order: 0, channel: "email", delayDays: 0, type: "first" },
      { order: 1, channel: "linkedin_connection", delayDays: 1, type: "bump" },
      { order: 2, channel: "email", delayDays: 3, type: "bump" },
      { order: 3, channel: "cold_call", delayDays: 2, type: "bump" },
      { order: 4, channel: "email", delayDays: 4, type: "breakup" },
    ],
  },
  {
    name: "LinkedIn-First (3-step)",
    steps: [
      { order: 0, channel: "linkedin_connection", delayDays: 0, type: "first" },
      { order: 1, channel: "linkedin_message", delayDays: 2, type: "bump" },
      { order: 2, channel: "email", delayDays: 3, type: "breakup" },
    ],
  },
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userSequences = await db
    .select()
    .from(schema.sequences)
    .where(eq(schema.sequences.userId, session.user.id));

  // Seed preset templates if user has none
  if (userSequences.length === 0) {
    for (const template of PRESET_TEMPLATES) {
      await db.insert(schema.sequences).values({
        userId: session.user.id,
        name: template.name,
        steps: template.steps,
        isDefault: template.name === "Email Only (3-step)" ? 1 : 0,
      });
    }
    userSequences = await db
      .select()
      .from(schema.sequences)
      .where(eq(schema.sequences.userId, session.user.id));
  }

  return NextResponse.json({ sequences: userSequences });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.name || !Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: "Name and steps are required" }, { status: 400 });
  }

  // Tier check: Starter gets 1 custom sequence max
  const existing = await db
    .select()
    .from(schema.sequences)
    .where(eq(schema.sequences.userId, session.user.id));

  const presetNames = PRESET_TEMPLATES.map((p) => p.name);
  const customCount = existing.filter((s) => !presetNames.includes(s.name)).length;
  const tierId = (session.user as any).tierId || "starter";
  if (tierId === "starter" && customCount >= 1) {
    return NextResponse.json(
      { error: "Starter plan allows 1 custom sequence. Upgrade for unlimited." },
      { status: 402 },
    );
  }

  const [sequence] = await db.insert(schema.sequences).values({
    userId: session.user.id,
    name: body.name,
    steps: body.steps,
  }).returning();

  return NextResponse.json({ sequence }, { status: 201 });
}
