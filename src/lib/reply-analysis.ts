// ---------------------------------------------------------------------------
// Reply Analysis — Classification + Suggested Response
// ---------------------------------------------------------------------------

export type ReplyCategory =
  | "interested"
  | "objection_budget"
  | "objection_timing"
  | "objection_authority"
  | "objection_need"
  | "objection_competitor"
  | "objection_status_quo"
  | "not_now"
  | "wrong_person"
  | "unsubscribe"
  | "ooo";

export type ReplyClassification = {
  category: ReplyCategory;
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
  suggestedAction: "respond" | "pause" | "stop" | "reassign";
};

// Quick regex-based detection for obvious cases
export function classifyReplyText(text: string): ReplyCategory | null {
  const lower = text.toLowerCase();

  if (/out of (the )?office|ooo|auto.?reply|i('m| am) (away|on leave|on vacation)/i.test(lower)) {
    return "ooo";
  }

  if (/unsubscribe|remove me|stop (emailing|contacting|sending)|opt.?out|do not (contact|email)/i.test(lower)) {
    return "unsubscribe";
  }

  if (/wrong (person|department|team)|not the right (person|contact)|try (reaching|contacting)|you should (contact|reach|email)/i.test(lower)) {
    return "wrong_person";
  }

  return null;
}

const CLASSIFICATION_PROMPT = `You classify sales email replies. Given a reply, the original hook, and conversation history, classify it.

Return a JSON object:
{
  "category": one of: "interested", "objection_budget", "objection_timing", "objection_authority", "objection_need", "objection_competitor", "objection_status_quo", "not_now", "wrong_person", "unsubscribe", "ooo",
  "sentiment": "positive" | "neutral" | "negative",
  "summary": "One sentence summary of the reply intent",
  "suggested_action": "respond" | "pause" | "stop" | "reassign"
}

Return ONLY valid JSON, no markdown.`;

export async function classifyReply(
  replyText: string,
  originalHook: string | null,
  previousMessages: Array<{ direction: string; body: string }>,
  claudeApiKey: string,
): Promise<ReplyClassification> {
  const quickCategory = classifyReplyText(replyText);
  if (quickCategory) {
    const actionMap: Record<string, ReplyClassification["suggestedAction"]> = {
      ooo: "pause",
      unsubscribe: "stop",
      wrong_person: "reassign",
    };
    return {
      category: quickCategory,
      sentiment: quickCategory === "ooo" ? "neutral" : "negative",
      summary: quickCategory === "ooo"
        ? "Auto-reply or out of office"
        : quickCategory === "unsubscribe"
          ? "Requested to stop receiving emails"
          : "Directed to another contact",
      suggestedAction: actionMap[quickCategory] || "pause",
    };
  }

  const context = previousMessages
    .slice(-3)
    .map((m) => `[${m.direction}]: ${m.body}`)
    .join("\n\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: CLASSIFICATION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Reply text:\n${replyText}\n\n${originalHook ? `Original hook:\n${originalHook}\n\n` : ""}${context ? `Previous messages:\n${context}` : ""}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    return {
      category: "not_now",
      sentiment: "neutral",
      summary: "Could not classify reply",
      suggestedAction: "respond",
    };
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";

  try {
    const parsed = JSON.parse(text);
    return {
      category: parsed.category || "not_now",
      sentiment: parsed.sentiment || "neutral",
      summary: parsed.summary || "",
      suggestedAction: parsed.suggested_action || "respond",
    };
  } catch {
    return {
      category: "not_now",
      sentiment: "neutral",
      summary: "Could not parse classification",
      suggestedAction: "respond",
    };
  }
}

// ---------------------------------------------------------------------------
// Suggested response generation
// ---------------------------------------------------------------------------

const RESPONSE_PROMPTS: Record<string, string> = {
  interested: "Generate a brief meeting-booking response. Reference their interest and suggest 2-3 time slots. Keep under 100 words.",
  objection_budget: "Generate a value-focused rebuttal that acknowledges the budget concern. Reference the original evidence. Keep under 120 words.",
  objection_timing: "Generate a response acknowledging timing. Offer to reconnect at a specific future date. Keep under 80 words.",
  objection_authority: "Generate a response asking for a warm intro to the decision maker. Keep under 80 words.",
  objection_need: "Generate a response that reframes the need using evidence. Keep under 100 words.",
  objection_competitor: "Generate a differentiation response without bashing the competitor. Keep under 100 words.",
  objection_status_quo: "Generate a response highlighting risks of the status quo using evidence. Keep under 100 words.",
  not_now: "Generate a nurture response. Offer a relevant resource or insight. Keep under 80 words.",
  wrong_person: "Generate a polite referral request asking for the right person's name/email. Keep under 60 words.",
};

export async function generateSuggestedResponse(
  classification: ReplyClassification,
  replyText: string,
  originalHook: string | null,
  leadName: string | null,
  claudeApiKey: string,
): Promise<string | null> {
  const prompt = RESPONSE_PROMPTS[classification.category];
  if (!prompt) return null;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: prompt,
      messages: [
        {
          role: "user",
          content: `Lead name: ${leadName || "there"}\nTheir reply: ${replyText}\n${originalHook ? `Original hook evidence: ${originalHook}` : ""}`,
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.content?.[0]?.text || null;
}
