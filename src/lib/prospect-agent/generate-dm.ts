import { callClaudeText } from "@/lib/hooks";

interface LeadInfo {
  name?: string | null;
  title?: string | null;
  companyName?: string | null;
  companyWebsite?: string | null;
  linkedinHeadline?: string | null;
}

export type LeadType = "founder" | "sdr_ae" | "agency" | "generic";

// --- Reference templates from outreach-demo-invites.md ---

const TEMPLATES: Record<LeadType, string> = {
  founder: `Hey [Name] – I'm building GetSignalHooks, a small engine for founder-led B2B SaaS teams doing outbound. It takes a target account's website/URL and turns it into specific hooks for your first message (based on triggers, risks, tradeoffs) plus follow-up suggestions that sound like you, not a spam bot.

I'm looking for 1–2 founders to demo and pressure-test it on a real, small project (e.g. 20–50 accounts you actually care about). You keep using your usual tools — I wire in GetSignalHooks to generate hooks + follow-ups for that list and we see together where it helps and where it falls short.

No cost, and you can be as blunt as you like. Would you be open to a short call or async walkthrough where we plug in one of your current outbound targets?`,

  sdr_ae: `Hey [Name] – I'm building GetSignalHooks, a tool that takes a prospect's site/URL and produces a few concrete angles you can use in your first message, plus suggested follow-ups so you're not staring at a blank screen on step 2/3.

I'm looking for a couple of SDRs/AEs willing to smoke-test it on real accounts and tell me where it actually helps and where it's useless. You bring a small list (even 10–20 accounts) you're working right now, I run them through and share the hooks/follow-ups, and you tell me what you'd actually send and what misses.

No cost, no long setup. Would you be up for a quick demo session where we use your real pipeline instead of made-up examples?`,

  agency: `Hey [Name] – I know you probably get a lot of "AI for outbound" noise, so I'll keep this tight.

I'm working on GetSignalHooks, which turns a target's website/URL into research-driven hooks your writers can drop into cold email copy, plus draft follow-ups that respect your tone, touch counts, and industry rules.

I'm looking for 1–2 boutique B2B agencies happy to kick the tyres on it. We use a small live campaign (20–100 leads) you're already planning, I generate hooks + follow-ups around your current workflow, your team tells me what's actually useful. You get extra angles and copy for an upcoming campaign, I get unfiltered feedback. No cost.

If that sounds interesting, I can send a 1-pager and we can look at one of your current campaigns together.`,

  generic: `Hey [Name] – I'm building GetSignalHooks, a small engine that turns a prospect's site/URL into concrete outbound hooks + suggested follow-ups.

I'm looking for a couple of [type] willing to demo it on a real list (20–50 accounts) and tell me where it actually helps vs gets in the way. No cost, just honest feedback.

Open to giving it a spin with one of your current campaigns?`,
};

const CLASSIFICATION_PROMPT = `You classify LinkedIn leads into one of four outreach categories based on their profile info.

Categories:
- "founder" — Founder, CEO, or co-founder of a SaaS or tech company. They likely do their own outbound or oversee it directly.
- "sdr_ae" — SDR, BDR, AE, Account Executive, Sales Development Rep, or similar individual contributor sales role.
- "agency" — Works at or runs a boutique outbound/lead-gen/sales agency that manages outbound for clients.
- "generic" — Doesn't clearly fit the above, or not enough info to tell.

Output ONLY the category name (one word), nothing else.`;

const DM_SYSTEM_PROMPT = `You are writing a LinkedIn DM to invite someone to demo GetSignalHooks. You will be given:
1. The lead's profile info
2. A reference template for their lead type

Your job: Adapt the template into a personalised LinkedIn DM for this specific person.

Rules:
- Keep the core pitch and structure from the template — do NOT invent new value props
- Personalise the opening with something specific from their headline, role, or company
- Keep it under 500 characters for LinkedIn DM limits
- Replace [Name] with their actual name (first name only)
- For the generic template, replace [type] with the appropriate word (founders/SDRs/agencies)
- Sound like a human, conversational, direct — not salesy
- Sign off with "– Idris"
- Do NOT add a subject line — this is a DM
- Do NOT use quotes or blockquotes

Output ONLY the final DM text, nothing else.`;

export function classifyLeadType(lead: LeadInfo): LeadType {
  const headline = (lead.linkedinHeadline || "").toLowerCase();
  const title = (lead.title || "").toLowerCase();
  const combined = `${headline} ${title}`;

  // Founder signals
  if (/\b(founder|co-founder|cofounder|ceo|chief executive)\b/.test(combined)) {
    if (/\b(saas|b2b|tech|software|platform|startup)\b/.test(combined)) {
      return "founder";
    }
    return "founder";
  }

  // SDR/AE signals
  if (/\b(sdr|bdr|account executive|sales development|business development rep|ae\b|sales rep)/.test(combined)) {
    return "sdr_ae";
  }

  // Agency signals
  if (/\b(agency|outbound agency|lead gen|leadgen|growth agency|boutique|cold email agency)/.test(combined)) {
    return "agency";
  }

  return "generic";
}

export async function classifyLeadTypeWithAI(lead: LeadInfo): Promise<LeadType> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return classifyLeadType(lead);

  const parts: string[] = [];
  if (lead.name) parts.push(`Name: ${lead.name}`);
  if (lead.title) parts.push(`Title: ${lead.title}`);
  if (lead.companyName) parts.push(`Company: ${lead.companyName}`);
  if (lead.linkedinHeadline) parts.push(`LinkedIn headline: ${lead.linkedinHeadline}`);

  if (parts.length < 2) return classifyLeadType(lead);

  try {
    const result = await callClaudeText(CLASSIFICATION_PROMPT, parts.join("\n"), apiKey, 20);
    const cleaned = result.trim().toLowerCase();
    if (["founder", "sdr_ae", "agency", "generic"].includes(cleaned)) {
      return cleaned as LeadType;
    }
  } catch {
    // Fall back to regex classification
  }

  return classifyLeadType(lead);
}

export async function generateDmText(
  lead: LeadInfo,
  context?: string,
): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY not set");

  const leadType = await classifyLeadTypeWithAI(lead);
  const template = TEMPLATES[leadType];

  const parts: string[] = [];
  parts.push(`LEAD TYPE: ${leadType}`);
  if (lead.name) parts.push(`Name: ${lead.name}`);
  if (lead.title) parts.push(`Title: ${lead.title}`);
  if (lead.companyName) parts.push(`Company: ${lead.companyName}`);
  if (lead.companyWebsite) parts.push(`Website: ${lead.companyWebsite}`);
  if (lead.linkedinHeadline) parts.push(`LinkedIn headline: ${lead.linkedinHeadline}`);
  if (context) parts.push(`\nAdditional context:\n${context}`);
  parts.push(`\n--- REFERENCE TEMPLATE (adapt this, do not copy verbatim) ---\n${template}`);

  const userPrompt = parts.join("\n");
  const dmText = await callClaudeText(DM_SYSTEM_PROMPT, userPrompt, apiKey, 600);

  return dmText.trim();
}
