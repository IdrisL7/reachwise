import {
  callClaudeText,
  containsBannedPhrase,
  generateHooksForUrl,
  type Hook,
} from "@/lib/hooks";
import { mapStepToSequenceType, type SequenceConfig } from "./sequences";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeadInfo = {
  name?: string | null;
  title?: string | null;
  companyName?: string | null;
  companyWebsite?: string | null;
  email: string;
};

export type PreviousMessage = {
  direction: string;
  sequenceStep: number;
  subject?: string | null;
  body: string;
  sentAt?: string | null;
};

export type FollowUpResult = {
  subject?: string;
  body: string;
  channel: string;
  hookUsed?: {
    angle: string;
    evidence: string;
  };
};

// ---------------------------------------------------------------------------
// Email-specific banned phrases (same as generate-email route)
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
// Prompt builders (adapted from generate-email/route.ts)
// ---------------------------------------------------------------------------

function buildFollowUpSystemPrompt(
  tone: string,
  sequenceStep: "first" | "bump" | "breakup",
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
      "This is a follow-up to an unanswered previous email. Reference the original signal briefly, add a new angle or implication, and keep it shorter than the first email.",
    breakup:
      "This is a final follow-up. Be respectful, brief, and give the recipient an easy out. Still anchor on the original signal but frame it as a last note.",
  };

  return [
    "You are an elite cold email copywriter. You write emails that get replies by being relevant, specific, and respectful of the reader's time.",
    "",
    "## Doctrine (HARD rules)",
    "- Every email is anchored on the hook's evidence: Signal, then Implication, then Question.",
    "- No invented results or guarantees. Only reference what the hook's evidence_snippet supports.",
    "- BANNED phrases (never use): " + EMAIL_BANNED_PHRASES.join(", ") + ".",
    "- Avoid apologetic or needy language such as: 'bugging you', 'bothering you', 'just checking in', 'just following up', 'touching base', or similar.",
    "- First line: clearly tie to the signal and evidence snippet. No generic openers.",
    "- One short paragraph: pull out the implication in the prospect's own language.",
    "- Close with a simple, concrete question about the problem or next step, derived from the hook's question. Do not default to generic 'jump on a quick call' / 'worth a quick chat' style CTAs.",
    "- Do NOT include any name or signature at the end. End the email body after the last sentence of the message.",
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

function buildFollowUpUserPrompt(
  lead: LeadInfo,
  hook: Hook,
  previousMessages: PreviousMessage[],
  sequenceStep: "first" | "bump" | "breakup",
): string {
  const lines: string[] = [];

  if (lead.companyWebsite) {
    lines.push(`## Prospect company URL: ${lead.companyWebsite}`);
  }
  if (lead.companyName) {
    lines.push(`## Prospect company: ${lead.companyName}`);
  }
  if (lead.name) {
    lines.push(`## Prospect name: ${lead.name}`);
  }
  if (lead.title) {
    lines.push(`## Prospect title: ${lead.title}`);
  }

  lines.push("");
  lines.push("## Hook to base the email on:");
  lines.push(`- Angle: ${hook.angle}`);
  lines.push(`- Hook text: ${hook.hook}`);
  lines.push(`- Evidence snippet: ${hook.evidence_snippet}`);
  lines.push(`- Source: ${hook.source_title}`);
  lines.push(`- Confidence: ${hook.confidence}`);

  if (previousMessages.length > 0 && sequenceStep !== "first") {
    lines.push("");
    lines.push("## Previous messages sent (for context — reference but don't repeat):");
    for (const msg of previousMessages) {
      lines.push(`### Step ${msg.sequenceStep} (${msg.direction}, ${msg.sentAt || "unknown date"}):`);
      if (msg.subject) lines.push(`Subject: ${msg.subject}`);
      lines.push(`Body: ${msg.body}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("Write the email now. Return JSON only.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Strip trailing signature (same logic as generate-email route)
// ---------------------------------------------------------------------------

function stripTrailingSignature(body: string): string {
  const lines = body.split("\n");

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
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
    return lines.join("\n");
  }

  return body;
}

// ---------------------------------------------------------------------------
// Pick the best hook (prefer different angle than previous messages)
// ---------------------------------------------------------------------------

function pickBestHook(hooks: Hook[], previousMessages: PreviousMessage[], avoidAngle?: string): Hook {
  if (hooks.length === 0) {
    throw new Error("No hooks available for this company");
  }

  // Filter out avoided angle if specified
  const candidates = avoidAngle
    ? hooks.filter((h) => h.angle !== avoidAngle)
    : hooks;

  // Fall back to all hooks if filtering removed everything
  const pool = candidates.length > 0 ? candidates : hooks;

  // If no previous messages, just pick the first high-confidence one
  if (previousMessages.length === 0) {
    const highConf = pool.find((h) => h.confidence === "high");
    return highConf || pool[0];
  }

  // Try to pick a hook with a different angle than the most recent message's hook
  // We don't have the exact angle used before, so just diversify by picking
  // high-confidence hooks and rotating through angles
  const usedCount = previousMessages.length;
  const angleOrder: Hook["angle"][] = ["trigger", "risk", "tradeoff"];
  const preferredAngle = angleOrder[usedCount % angleOrder.length];

  const preferred = pool.find(
    (h) => h.angle === preferredAngle && h.confidence === "high",
  );
  if (preferred) return preferred;

  const anyPreferred = pool.find((h) => h.angle === preferredAngle);
  if (anyPreferred) return anyPreferred;

  return pool[0];
}

// ---------------------------------------------------------------------------
// Channel-specific system prompts
// ---------------------------------------------------------------------------

function getChannelSystemPrompt(channel: string): string {
  switch (channel) {
    case "linkedin_connection":
      return `You write LinkedIn connection request messages. Keep under 300 characters. Be personal, reference something specific about the person or company. No salesy language. Just a genuine reason to connect.`;
    case "linkedin_message":
      return `You write LinkedIn direct messages. Keep under 1900 characters. Reference evidence about their company. Be conversational, not formal. No "Dear" or "Hi there". Get to the point quickly.`;
    case "cold_call":
      return `You write cold call opener scripts. Keep under 150 words. Structure: introduce yourself (1 sentence), reference trigger/evidence (1 sentence), ask permission-based opener question. Include a talk track for likely objections.`;
    case "video_script":
      return `You write personalized video outreach scripts. Keep under 200 words. Structure: greet by name, reference specific evidence about their company, explain why it matters to them, soft CTA. Conversational tone, meant to be spoken on camera.`;
    default:
      return ""; // email uses existing system prompt
  }
}

// ---------------------------------------------------------------------------
// Build user prompt for non-email channels
// ---------------------------------------------------------------------------

function buildChannelUserPrompt(lead: LeadInfo, hook: Hook): string {
  const lines: string[] = [];

  if (lead.companyWebsite) lines.push(`Company URL: ${lead.companyWebsite}`);
  if (lead.companyName) lines.push(`Company: ${lead.companyName}`);
  if (lead.name) lines.push(`Prospect name: ${lead.name}`);
  if (lead.title) lines.push(`Prospect title: ${lead.title}`);

  lines.push("");
  lines.push("## Hook / evidence to reference:");
  lines.push(`- Angle: ${hook.angle}`);
  lines.push(`- Hook text: ${hook.hook}`);
  lines.push(`- Evidence snippet: ${hook.evidence_snippet}`);
  lines.push(`- Source: ${hook.source_title}`);

  lines.push("");
  lines.push("Write the message now. Return only the message text, no JSON wrapping.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main: generate a follow-up email
// ---------------------------------------------------------------------------

export async function generateFollowUp(opts: {
  lead: LeadInfo;
  previousMessages: PreviousMessage[];
  sequence: SequenceConfig;
  currentStep: number;
  hooks?: Hook[];
  tone?: string;
  wordCountHint?: number;
  senderProfile?: { name: string; role?: string; company?: string };
  avoidAngle?: string;
  channel?: string;
}): Promise<FollowUpResult> {
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  if (!claudeApiKey) {
    throw new Error("Server misconfiguration: missing CLAUDE_API_KEY");
  }

  // Get hooks — use provided or auto-generate
  let hooks = opts.hooks;
  if (!hooks || hooks.length === 0) {
    const companyUrl = opts.lead.companyWebsite || opts.lead.companyName;
    if (!companyUrl) {
      throw new Error("Lead must have company_website or company_name to generate hooks");
    }
    const result = await generateHooksForUrl({ url: companyUrl, count: 6 });
    hooks = result.hooks;
  }

  if (hooks.length === 0) {
    throw new Error("Could not generate any hooks for this lead's company");
  }

  const channel = opts.channel || "email";
  const hook = pickBestHook(hooks, opts.previousMessages, opts.avoidAngle);

  // --- Non-email channels: simpler Claude call, no subject line ---
  if (channel !== "email") {
    const channelPrompt = getChannelSystemPrompt(channel);
    if (!channelPrompt) {
      throw new Error(`Unsupported channel: ${channel}`);
    }

    const userPrompt = buildChannelUserPrompt(opts.lead, hook);
    const raw = await callClaudeText(channelPrompt, userPrompt, claudeApiKey, 800);

    // Strip any accidental markdown fences
    const body = raw
      .replace(/^```(?:\w+)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    if (!body) {
      throw new Error("LLM returned empty content for channel message");
    }

    return {
      body,
      channel,
      hookUsed: {
        angle: hook.angle,
        evidence: hook.evidence_snippet,
      },
    };
  }

  // --- Email channel: full generation with subject line ---
  const sequenceType = mapStepToSequenceType(opts.currentStep, opts.sequence.maxSteps);
  const tone = opts.tone || "direct";
  const wordCountHint = opts.wordCountHint || (sequenceType === "first" ? 80 : 60);

  const systemPrompt = buildFollowUpSystemPrompt(tone, sequenceType, wordCountHint);
  const userPrompt = buildFollowUpUserPrompt(
    opts.lead,
    hook,
    opts.previousMessages,
    sequenceType,
  );

  const raw = await callClaudeText(systemPrompt, userPrompt, claudeApiKey, 1200);

  // Parse JSON response
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as { subject: string; body: string };

  if (!parsed.subject || !parsed.body) {
    throw new Error("LLM returned an invalid email structure");
  }

  // Quality check — warn but don't block
  const banned = containsBannedPhrase(parsed.body);
  if (banned) {
    console.warn(`generate-followup: banned phrase detected in body: "${banned}"`);
  }

  parsed.body = stripTrailingSignature(parsed.body);

  return {
    subject: parsed.subject,
    body: parsed.body,
    channel,
    hookUsed: {
      angle: hook.angle,
      evidence: hook.evidence_snippet,
    },
  };
}
