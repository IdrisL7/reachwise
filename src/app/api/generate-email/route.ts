import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import {
  callClaudeText,
  containsBannedPhrase,
  PERSONA_DATA,
  type Hook,
} from "@/lib/hooks";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SenderProfile = {
  name: string;
  role?: string;
  company?: string;
  email?: string;
};

type GenerateEmailRequest = {
  companyUrl: string;
  hook: Hook;
  senderProfile?: SenderProfile;
  tone?: "concise" | "warm" | "direct";
  sequenceStep?: "first" | "bump" | "breakup";
  wordCountHint?: number;
};

type GeneratedEmail = {
  subject: string;
  body: string;
};

type GenerateEmailResponse = {
  email: GeneratedEmail;
  meta?: {
    hookAngle?: Hook["angle"];
    confidence?: Hook["confidence"];
  };
};

// ---------------------------------------------------------------------------
// Email-specific banned phrases (superset of hook bans)
// ---------------------------------------------------------------------------

const EMAIL_BANNED_PHRASES = [
  "curious",
  "worth a quick",
  "just checking in",
  "just following up",
  "touching base",
  "quick chat",
  "quick call",
  "bugging you",
  "bothering you",
  "synergy",
  "win-win",
];

// ---------------------------------------------------------------------------
// Helpers: email post-processing
// ---------------------------------------------------------------------------

function stripTrailingSignature(body: string): string {
  const lines = body.split("\n");

  // Remove trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  if (lines.length === 0) return body;

  const lastLine = lines[lines.length - 1].trim();

  const signoffPatterns = [
    /^(best|cheers|thanks|thank you|regards|kind regards|warm regards)[,!\s]*$/i,
    /^(best|cheers|thanks|thank you|regards|kind regards|warm regards)[,!\s]+[a-zA-Z]+$/i,
  ];

  const looksLikeJustAName = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(lastLine);

  const isExplicitSignoff = signoffPatterns.some((re) => re.test(lastLine));

  if (isExplicitSignoff || looksLikeJustAName) {
    lines.pop();

    // Also drop another trailing blank line if present
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    return lines.join("\n");
  }

  return body;
}

function containsEmailBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of EMAIL_BANNED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

function forcePromiseAtEndOfParagraphOne(body: string, promise?: string): string {
  if (!promise) return body;

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return body;

  const cleanedPromise = promise.trim();
  const removePromise = (text: string) => text.replace(new RegExp(cleanedPromise.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").replace(/\s{2,}/g, " ").trim();

  for (let i = 0; i < paragraphs.length; i++) {
    paragraphs[i] = removePromise(paragraphs[i]);
  }

  paragraphs[0] = paragraphs[0].replace(/[\s.?!]+$/, "").trim() + ". " + cleanedPromise;
  return paragraphs.join("\n\n");
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildEmailSystemPrompt(
  tone: string,
  sequenceStep: string,
  wordCountHint: number,
): string {
  const toneGuide: Record<string, string> = {
    concise:
      "Write as a thoughtful SDR: clear, direct, respectful. Personable but professional. Be short and punchy. No filler. Every sentence earns its place.",
    warm:
      "Write as a thoughtful SDR: clear, direct, respectful. Personable but professional. Be conversational and human. Still direct, but friendly in tone.",
    direct:
      "Write as a thoughtful SDR: clear, direct, respectful. Personable but professional. Be blunt and to the point. No small talk. Lead with the signal.",
  };

  const stepGuide: Record<string, string> = {
    first:
      "This is a first-touch cold email. The recipient has never heard from the sender. Open strong with the signal.",
    bump:
      "This is a follow-up to an unanswered first email. Reference the original signal briefly, add a new angle or implication, and keep it shorter than the first email.",
    breakup:
      "This is a final follow-up. Be respectful, brief, and give the recipient an easy out. Still anchor on the original signal but frame it as a last note.",
  };

  return [
    "CRITICAL RULE — READ BEFORE GENERATING:",
    "",
    "This email is written TO a person whose job title is [PERSONA].",
    "Their challenges are internal sales team challenges.",
    "",
    "Do NOT write about the prospect's product, their customers, or their industry operations.",
    "The trigger is CONTEXT ONLY.",
    "Write about their INTERNAL sales team challenges only.",
    "",
    "STRUCTURE RULE:",
    "The closing promise must always be the FINAL sentence of paragraph 1.",
    "It must not appear in paragraph 2 or later.",
    "It must match the promise field from the hook JSON output exactly.",
    "",
    "CORRECT structure:",
    "  Paragraph 1: Trigger reference (1 sentence) + bridge to internal pain (1-2 sentences) + [PROMISE — final sentence]",
    "  Paragraph 2: Question or CTA only",
    "",
    "WRONG structure (do not do this):",
    "  Paragraph 1: About the prospect's product or customers",
    "  Paragraph 2: Pain elaboration",
    "  Paragraph 3: Question + promise buried here",
    "",
    "You are an elite cold email copywriter. You write emails that get replies by being relevant, specific, and respectful of the reader's time.",
    "",
    "## Doctrine (HARD rules)",
    "- You are writing FROM a seller TO the prospect. The prospect's company/product is CONTEXT, not the subject.",
    "- NEVER sell the prospect's own product back to them. The evidence is a trigger signal — use it to frame a relevant question about the prospect's INTERNAL operations, not about their external product.",
    "- The email must address the prospect's JOB CHALLENGES (their persona's pain points), not describe what their company does.",
    "- Every email is anchored on the hook's evidence: Signal → Implication for their role → Promise → Question.",
    "- No invented results or guarantees. Only reference what the hook's evidence_snippet supports.",
    "- BANNED phrases (never use): " + EMAIL_BANNED_PHRASES.join(", ") + ".",
    "- Avoid apologetic or needy language such as: 'bugging you', 'bothering you', 'just checking in', 'just following up', 'touching base', or similar.",
    "- STRUCTURE (2 paragraphs only):",
    "  P1: Open with the signal/evidence → bridge to an implication for the prospect's role → If a promise line is provided, it MUST appear as the FINAL sentence of P1. The promise is what the sender offers to share/show — place it last.",
    "  P2: Question or CTA only — derived from the hook's question. Do not default to generic 'jump on a quick call' / 'worth a quick chat' style CTAs.",
    "- Do NOT include any name or signature at the end. End the email body after the last sentence of the message.",
    "- Each email must be UNIQUE — different signal angle, different implication, different promise placement. Never repeat the same structure or framing across multiple emails for the same prospect.",
    "",
    `## Tone: ${tone}`,
    toneGuide[tone] || toneGuide["direct"],
    "",
    `## Sequence step: ${sequenceStep}`,
    stepGuide[sequenceStep] || stepGuide["first"],
    "",
    `## Length: aim for roughly ${wordCountHint} words in the body. Shorter is better than longer.`,
    "",
    "## Output format",
    "Return ONLY valid JSON with no markdown fences:",
    '{ "subject": "<subject line>", "body": "<email body>" }',
    "",
    "The body should use \\n for line breaks between paragraphs. Do not include a greeting line like 'Hi [Name]' since the sender will add that.",
  ].join("\n");
}

function buildEmailUserPrompt(
  req: GenerateEmailRequest,
): string {
  const hook = req.hook;
  const sender = req.senderProfile;

  const role = hook.role_used && hook.role_used !== "General" ? hook.role_used : "Custom";
  const personaPain = role !== "Custom" ? PERSONA_DATA[role].pain_points.join("; ") : "Internal sales team execution, visibility, and performance issues.";

  const lines: string[] = [
    `## Prospect company URL: ${req.companyUrl}`,
    `## PERSONA: ${role}`,
    `## PERSONA_PAIN: ${personaPain}`,
    "",
    "## Hook to base the email on:",
    `- Angle: ${hook.angle}`,
    `- Hook text: ${hook.hook}`,
    `- Evidence snippet: ${hook.evidence_snippet}`,
    `- Source: ${hook.source_title}`,
    `- Confidence: ${hook.confidence}`,
  ];
  if (hook.promise) lines.push(`- Promise/closing line: ${hook.promise}`);

  if (sender) {
    lines.push("", "## Sender info:");
    lines.push(`- Name: ${sender.name}`);
    if (sender.role) lines.push(`- Role: ${sender.role}`);
    if (sender.company) lines.push(`- Company: ${sender.company}`);
  }

  lines.push("", "Write the email now. Return JSON only.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(getClientIp(request), "auth:email");
  if (rateLimited) return rateLimited;

  try {
    const body = (await request.json().catch(() => null)) as GenerateEmailRequest | null;

    if (!body || !body.companyUrl?.trim() || !body.hook) {
      return NextResponse.json(
        { error: "Missing 'companyUrl' or 'hook' in request body." },
        { status: 400 },
      );
    }

    if (!body.hook.hook) {
      return NextResponse.json(
        { error: "Hook must include 'hook' text." },
        { status: 400 },
      );
    }

    const claudeApiKey = process.env.CLAUDE_API_KEY;
    if (!claudeApiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: missing CLAUDE_API_KEY." },
        { status: 500 },
      );
    }

    const tone = body.tone || "direct";
    const sequenceStep = body.sequenceStep || "first";
    const wordCountHint = body.wordCountHint || 80;

    const systemPrompt = buildEmailSystemPrompt(tone, sequenceStep, wordCountHint);
    const userPrompt = buildEmailUserPrompt(body);

    const raw = await callClaudeText(systemPrompt, userPrompt, claudeApiKey, 1200);

    // Parse the JSON response
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleaned) as GeneratedEmail;

    if (!parsed.subject || !parsed.body) {
      return NextResponse.json(
        { error: "LLM returned an invalid email structure." },
        { status: 502 },
      );
    }

    // Ensure promise is always the final sentence of paragraph 1
    parsed.body = forcePromiseAtEndOfParagraphOne(parsed.body, body.hook.promise);

    // Post-generation quality check on banned phrases (global and email-specific)
    const globalBodyBanned = containsBannedPhrase(parsed.body);
    const subjectBanned = containsBannedPhrase(parsed.subject);
    const emailBodyBanned = containsEmailBannedPhrase(parsed.body);

    if (globalBodyBanned || subjectBanned || emailBodyBanned) {
      console.warn(
        `generate-email: banned phrase detected: "${
          emailBodyBanned || globalBodyBanned || subjectBanned
        }"`,
      );
    }

    // Strip trailing signature / name if present
    parsed.body = stripTrailingSignature(parsed.body);

    const response: GenerateEmailResponse = {
      email: parsed,
      meta: {
        hookAngle: body.hook.angle,
        confidence: body.hook.confidence,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    Sentry.captureException(error);
    console.error("Unexpected error in /api/generate-email", error);
    return NextResponse.json(
      { error: "Unexpected server error while generating email." },
      { status: 500 },
    );
  }
}
