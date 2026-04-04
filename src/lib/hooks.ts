// ---------------------------------------------------------------------------
// Shared types and helpers for hook generation
// ---------------------------------------------------------------------------

import type { EvidenceTier } from "./types";
import type { SenderContext } from "./workspace";
import { fetchCrunchbaseSignals, fetchLinkedInPostSignals } from "./apify-signals";
import { getClaudeApiKey } from "@/lib/env";

export type Angle = "trigger" | "risk" | "tradeoff";
export type Confidence = "high" | "med" | "low";
export type PsychMode = "relevance" | "curiosity_gap" | "symptom" | "tradeoff_frame" | "contrarian" | "benefit";

export type MessagingStyle = "evidence" | "challenger" | "implication" | "risk";

export const MESSAGING_STYLE_MAP: Record<MessagingStyle, {
  angle: Angle;
  psych_mode: PsychMode;
  label: string;
  description: string;
}> = {
  evidence: {
    angle: "trigger",
    psych_mode: "relevance",
    label: "Evidence",
    description: "Anchor to the signal directly",
  },
  challenger: {
    angle: "tradeoff",
    psych_mode: "contrarian",
    label: "Challenger",
    description: "Reframe the prospect's reality",
  },
  implication: {
    angle: "risk",
    psych_mode: "symptom",
    label: "Implication",
    description: "Amplify the downstream consequence",
  },
  risk: {
    angle: "risk",
    psych_mode: "tradeoff_frame",
    label: "Risk",
    description: "Frame what inaction costs",
  },
};

export type TargetRole = "VP Sales" | "RevOps" | "SDR Manager" | "Marketing" | "Founder/CEO" | "General";

export type TriggerType = "award" | "stat" | "case_study" | "hiring" | "funding" | "ipo" | "expansion";

export const TARGET_ROLES: TargetRole[] = [
  "VP Sales", "RevOps", "SDR Manager", "Marketing", "Founder/CEO", "General",
];

/**
 * Static responsibility map per role. Used in prompting to frame the question
 * around what this persona owns. Never used to assert pain — only to focus
 * the question on their KPIs/decisions.
 */
export const ROLE_RESPONSIBILITIES: Record<TargetRole, { kpis: string[]; tag: string }> = {
  "VP Sales": {
    kpis: ["pipeline coverage", "meeting quality", "conversion rate", "ramp time", "forecast risk"],
    tag: "pipeline",
  },
  "RevOps": {
    kpis: ["tooling/process", "data quality", "attribution", "automation reliability", "governance"],
    tag: "data_quality",
  },
  "SDR Manager": {
    kpis: ["rep productivity", "QA/coaching", "reply rates", "speed-to-lead", "territory/coverage"],
    tag: "productivity",
  },
  "Marketing": {
    kpis: ["lead quality", "ICP fit", "routing", "conversion", "intent signals"],
    tag: "conversion",
  },
  "Founder/CEO": {
    kpis: ["focus", "efficiency", "CAC/payback", "growth constraints", "prioritization"],
    tag: "governance",
  },
  "General": {
    kpis: ["process", "priority", "decision tradeoff"],
    tag: "general",
  },
};

export const ROLE_PRESSURE_MAP: Record<TargetRole, {
  priorities: string[];
  pains: string[];
  metrics: string[];
  language: string[];
}> = {
  "VP Sales": {
    priorities: ["forecast confidence", "pipeline quality", "rep productivity", "deal progression"],
    pains: ["late-stage surprise", "pipeline drag", "weak conversion visibility", "ramp inefficiency"],
    metrics: ["coverage", "win rate", "stage conversion", "forecast variance"],
    language: ["pipeline risk", "forecast confidence", "deal velocity", "rep focus"],
  },
  "RevOps": {
    priorities: ["process integrity", "clean reporting", "routing reliability", "system trust"],
    pains: ["handoff lag", "attribution gaps", "dirty CRM data", "workflow drift"],
    metrics: ["SLA compliance", "routing speed", "data completeness", "reporting accuracy"],
    language: ["process breakdown", "system trust", "routing lag", "attribution leakage"],
  },
  "SDR Manager": {
    priorities: ["coaching leverage", "rep consistency", "speed-to-lead", "team execution"],
    pains: ["slow ramp", "coaching by hindsight", "uneven execution", "manager bottlenecks"],
    metrics: ["time-to-ramp", "activity quality", "reply rate", "speed-to-lead"],
    language: ["rep consistency", "coaching leverage", "ramp drag", "execution drift"],
  },
  "Marketing": {
    priorities: ["lead quality", "campaign efficiency", "handoff quality", "funnel conversion"],
    pains: ["lead waste", "post-handoff blind spots", "slow SDR follow-up", "attribution leakage"],
    metrics: ["MQL-to-meeting", "CAC efficiency", "speed-to-follow-up", "pipeline contribution"],
    language: ["lead leakage", "handoff quality", "campaign efficiency", "conversion drag"],
  },
  "Founder/CEO": {
    priorities: ["growth leverage", "operating visibility", "team coordination", "efficiency"],
    pains: ["complexity creep", "execution drag", "low visibility", "scaling overhead"],
    metrics: ["revenue per rep", "payback", "operating cadence", "execution speed"],
    language: ["operating visibility", "growth complexity", "execution drag", "scaling overhead"],
  },
  "General": {
    priorities: ["execution visibility", "team responsiveness", "operational clarity", "decision speed"],
    pains: ["blind spots", "lagging signals", "slow follow-up", "coordination gaps"],
    metrics: ["response time", "visibility", "conversion", "operating cadence"],
    language: ["execution visibility", "coordination gaps", "lagging signals", "decision drag"],
  },
};

export const PERSONA_DATA: Record<TargetRole, {
  pain_points: string[];
  bridge_principles: string[];
  promise_guidelines: {
    outcome_themes: string[];
    specificity_rule: string;
  };
}> = {
  "VP Sales": {
    pain_points: [
      "Pipeline visibility becomes the constraint before headcount does",
      "Forecast accuracy erodes without real-time pipeline signals",
      "Deals at risk surface too late in the quarter",
    ],
    bridge_principles: [
      "Funding/PE → investor scrutiny → forecast pressure → board-level pipeline accountability",
      "Hiring surge → management overhead → forecast dilution as new reps ramp",
      "Award/recognition → external credibility outpacing internal operational maturity",
      "Expansion → multi-geo complexity → pipeline fragmentation across regions",
    ],
    promise_guidelines: {
      outcome_themes: ["forecast confidence", "pipeline visibility", "deal risk surfacing", "quarter predictability"],
      specificity_rule: "Must reference the triggering signal. E.g., if PE buyout, reference board scrutiny. If hiring 50 reps, reference ramp visibility at scale.",
    },
  },
  "RevOps": {
    pain_points: [
      "Pipeline data doesn't match CRM reality",
      "Manual reporting layers slow decision-making",
      "Operational discipline externally doesn't translate to internal pipeline ops",
    ],
    bridge_principles: [
      "Funding/PE → investor-grade reporting requirements → CRM accuracy pressure",
      "Hiring surge → more reps entering data differently → data quality erosion",
      "Award/recognition → external polish vs internal spreadsheet chaos",
      "Expansion → multi-region CRM instances → fragmented pipeline views",
    ],
    promise_guidelines: {
      outcome_themes: ["single source of truth", "CRM accuracy", "reporting automation", "data governance"],
      specificity_rule: "Must reference the triggering signal. E.g., if expansion to APAC, reference cross-region pipeline consolidation.",
    },
  },
  "SDR Manager": {
    pain_points: [
      "Rep coaching relies on lagging data instead of real-time visibility",
      "Pipeline coaching still lags behind activity data",
      "Ramp time extends when coaching is based on weekly reviews not real-time signals",
    ],
    bridge_principles: [
      "Hiring surge → coaching infrastructure stress-tested → manager leverage drops",
      "Funding/PE → growth targets escalate → ramp pressure intensifies",
      "Award/recognition → external standards outpacing internal rep development",
      "Expansion → multi-region SDR teams → coaching consistency breaks",
    ],
    promise_guidelines: {
      outcome_themes: ["coaching velocity", "ramp time reduction", "real-time rep visibility", "consistent onboarding"],
      specificity_rule: "Must reference the triggering signal. E.g., if hiring 40 SDRs, reference coaching infrastructure at that scale.",
    },
  },
  "Marketing": {
    pain_points: [
      "SDR follow-up speed on leads doesn't match campaign quality",
      "Attribution gap between MQL and booked meeting",
      "No visibility into what happens to leads after SDR handoff",
    ],
    bridge_principles: [
      "Hiring surge → more leads needed → campaign volume up but handoff quality unknown",
      "Funding/PE → growth expectations → marketing ROI under investor scrutiny",
      "Award/recognition → content credibility high but lead conversion unknown",
      "Expansion → multi-market campaigns → attribution complexity compounds",
    ],
    promise_guidelines: {
      outcome_themes: ["post-handoff visibility", "attribution clarity", "lead-to-meeting velocity", "campaign ROI proof"],
      specificity_rule: "Must reference the triggering signal. E.g., if case study published, reference whether their own marketing sees post-SDR outcomes.",
    },
  },
  "Founder/CEO": {
    pain_points: [
      "GTM efficiency — getting more from current team before scaling it",
      "Revenue per SDR plateaus without operational visibility",
      "GTM predictability is hard to build at the Series A/B stage",
    ],
    bridge_principles: [
      "Funding/PE → investor expectations → GTM efficiency becomes the board metric",
      "Hiring surge → scaling before optimizing → revenue per rep dilution",
      "Award/recognition → founder credibility high but GTM maturity lagging",
      "Expansion → growth adds complexity → founder loses operational visibility",
    ],
    promise_guidelines: {
      outcome_themes: ["revenue per rep", "GTM predictability", "operational efficiency", "growth without proportional headcount"],
      specificity_rule: "Must reference the triggering signal. E.g., if PE buyout at $11B, reference board-level GTM accountability at that scale.",
    },
  },
  "General": {
    pain_points: [
      "Internal visibility doesn't match external execution quality",
      "Coaching and pipeline reviews rely on lagging indicators",
      "Team performance data arrives too late to act on",
    ],
    bridge_principles: [
      "Any growth signal → external success creating internal operational pressure",
      "Any recognition → external credibility vs internal process maturity gap",
      "Any change → transition period where visibility gaps become costly",
    ],
    promise_guidelines: {
      outcome_themes: ["real-time visibility", "operational maturity", "performance data accessibility"],
      specificity_rule: "Must reference the triggering signal specifically. Generic promises are not acceptable.",
    },
  },
};

const STRUCTURAL_VARIANTS = {
  "direct-challenger": {
    description: "Lead with tension from the signal, challenge an assumption, question",
    structure: "Tension statement from signal → challenge assumption → provocative question",
    when: "Best for funding, IPO, or signals that imply a strategic shift",
  },
  "curiosity-gap": {
    description: "Mirror a specific metric or fact, create a gap between what's visible and what's not",
    structure: "Specific observation → gap between external success and internal reality → question that surfaces the gap",
    when: "Best for stats, case studies, or published metrics",
  },
  "pain-forward": {
    description: "Name the consequence first, then tie it to the signal",
    structure: "Consequence statement → tie to their signal as evidence → question about their current approach",
    when: "Best for hiring surges, expansion, or signals with operational implications",
  },
  "signal-mirror": {
    description: "Mirror their own language/metrics back, contrast with internal reality",
    structure: "Quote or reference their own words/numbers → contrast with likely internal reality → question",
    when: "Best for awards, press quotes, or first-party content",
  },
  "hidden-cost": {
    description: "Lead with the operational cost that tends to hide behind the signal",
    structure: "Signal → hidden operational cost → pointed question",
    when: "Best for growth, expansion, new product, or partnership signals",
  },
  "scale-friction": {
    description: "Frame what gets harder as the company scales or adds complexity",
    structure: "Scaling signal → execution friction → forced-choice question",
    when: "Best for hiring, expansion, partnerships, and multi-team coordination",
  },
  "proof-to-problem": {
    description: "Use a strong proof point, then pivot quickly to the pressure it creates internally",
    structure: "Proof point → internal pressure/tension → concrete question",
    when: "Best for case studies, awards, rankings, and public wins",
  },
};

const GENERIC_AI_PATTERNS = [
  /\b(i\s+)?saw\b/i,
  /\bnoticed\b/i,
  /\bcame across\b/i,
  /\brecent article\b/i,
  /\brecent announcement\b/i,
  /\brecent post\b/i,
  /\bbased on your\b/i,
  /\bafter reading\b/i,
  /\bcongrats on\b/i,
  /\bcurious if\b/i,
  /\bjust wanted to\b/i,
];

const GENERIC_BRIDGE_PATTERNS = [
  /\bthat level of\b/i,
  /\bat that level\b/i,
  /\bat this stage\b/i,
  /\bgets dissected weekly\b/i,
  /\bscrambling to explain\b/i,
  /\bteams at (pre-ipo|this stage|that scale|similar scale)\b/i,
  /\bboard scrutiny\b/i,
  /\breal-time pipeline visibility\b/i,
];

const GENERIC_PROMISE_PATTERNS = [
  /\bteams at (pre-ipo|this stage|that scale|similar scale) typically\b/i,
  /\bhappy to show you what that looks like\b/i,
  /\bwith real-time pipeline visibility\b/i,
  /\bcut .* board prep time\b/i,
];

const FEW_SHOT_EXAMPLES = `
EXAMPLE HOOKS — match this tone and quality:

Voice model: Write like a smart colleague who read something interesting about the prospect and is genuinely curious. Not an SDR building to a pitch. No dramatic setup. No rhetorical flourishes. Just: here's what I noticed → here's why it connects to your world → what's actually happening there?

1. [VP Sales + funding, direct-challenger]
Signal: Notion raised $270M PE buyout at $11B valuation.
Hook: "Notion just closed a $270M PE round at $11B. That level of investor oversight usually changes how pipeline gets presented to the board. Are you showing them live data when that happens, or still pulling from last month's spreadsheet? Teams at this stage typically cut forecast prep time by 50% — happy to show you what that looks like for Notion."
Why it works: States the signal plainly, draws a simple direct connection, asks a specific binary question, then closes with a proof-backed promise tied to the signal.

2. [SDR Manager + hiring, pain-forward]
Signal: Gong is hiring 40+ SDRs across 3 regions.
Hook: "Gong's ramping 40 new SDRs across 3 regions. At that scale, are your managers coaching from real-time data, or still working off last week's call recordings — because that's exactly where teams like yours typically lose 30% of ramp velocity."
Why it works: One sentence on the signal, direct question, promise woven naturally after it. The connection is obvious — no buildup needed.

3. [RevOps + expansion, signal-mirror]
Signal: HubSpot opened offices in Tokyo and Sydney, grew APAC revenue 47%.
Hook: "HubSpot grew APAC 47% and opened two new offices. Does your CRM give you one view across all three regions, or are you stitching spreadsheets together? Companies at that expansion stage typically consolidate pipeline reporting in the first 90 days — worth a call to see if it's the same issue."
Why it works: Uses their exact numbers, asks a binary question that surfaces the real gap, closes with an outcome-framed soft CTA tied to the expansion signal.

4. [Founder/CEO + award, curiosity-gap]
Signal: Datadog CEO named EY Entrepreneur of the Year.
Hook: "Congrats on the EY award. Curious whether GTM efficiency is keeping pace with that recognition — are you getting more revenue per rep this year than last? Happy to show you what that looks like for a team at Datadog's stage."
Why it works: Brief human acknowledgment, direct question, then a generic soft close (no proof context assumed).

5. [Marketing + case_study, direct-challenger]
Signal: Outreach published case study: "How Snowflake's SDR team books 3x more meetings."
Hook: "You published that Snowflake's SDR team books 3x more meetings. Does your own marketing team see what happens to leads after SDR handoff, or does visibility stop at MQL — that attribution gap is exactly where teams at your scale typically lose 20% of pipeline visibility."
Why it works: Uses their own content to open the question, promise woven directly into the close as an outcome claim — no first-person framing.
`;

export type Hook = {
  news_item: number;
  angle: Angle;
  hook: string;
  evidence_snippet: string;
  source_title: string;
  source_date: string;
  source_url: string;
  evidence_tier: EvidenceTier;
  confidence: Confidence;
  quality_score?: number;
  quality_label?: "Excellent" | "Strong" | "Decent" | "Weak";
  generated_hook_id?: string;
  psych_mode?: PsychMode;
  why_this_works?: string;
  role_used?: TargetRole;
  role_tag?: string;
  role_token_hit?: string;
  uses_sender_context?: boolean;
  trigger_type?: TriggerType;
  promise?: string;
  bridge_quality?: "strong" | "moderate" | "weak";
  structural_variant?: string;
  buyer_tension?: string;
  why_now?: string;
  affected_metric?: string;
  genericness_penalty?: number;
  novelty_score?: number;
  buyer_tension_score?: number;
  specificity_score?: number;
  interestingness_score?: number;
  tension_richness_score?: number;
  credibility_score?: number;
  ranking_score?: number;
  buyer_tension_id?: string;
  selector_score?: number;
  role_fit_score?: number;
  non_overlap_score?: number;
  duplicate_cluster_key?: string;
  diversity_bucket?: string;
};

export type RetrievedHookPattern = {
  generatedHookId: string;
  buyerTensionId?: string | null;
  structuralVariant?: string | null;
  angle: Angle;
  triggerType?: TriggerType | null;
  targetRole?: string | null;
  evidenceTier: EvidenceTier;
  hookText: string;
  evidenceSnippet?: string | null;
  sourceTitle?: string | null;
  sourceType?: "first_party" | "trusted_news" | "semantic_web" | "fallback_web";
  outcomeScore: number;
};

export type HookSelectionCriteria = {
  credibility: number;
  interestingness: number;
  roleFit: number;
  novelty: number;
  nonOverlap: number;
  priorAdjustment: number;
  explorationBonus: number;
  personalizationBonus: number;
  retrievalBonus: number;
  timingBonus: number;
  counterfactualPenalty: number;
  total: number;
};

export type HookSelectorPriors = {
  buyerTensionBoosts: Record<string, number>;
  structuralVariantBoosts: Record<string, number>;
  angleBoosts: Record<string, number>;
  triggerTypeBoosts: Record<string, number>;
  buyerTensionTrials: Record<string, number>;
  structuralVariantTrials: Record<string, number>;
  angleTrials: Record<string, number>;
  triggerTypeTrials: Record<string, number>;
  totalTrials: number;
  explorationWeight: number;
  workspaceStyle: {
    preferredLength: "short" | "medium" | "long" | null;
    directnessPreference: number;
    conversationalPreference: number;
    formalPreference: number;
    operatorPreference: number;
    explicitVoiceTone?: string | null;
  };
  userStyle?: {
    preferredLength: "short" | "medium" | "long" | null;
    directnessPreference: number;
    conversationalPreference: number;
    formalPreference: number;
    operatorPreference: number;
    preferredTone?: "concise" | "warm" | "direct" | null;
    preferredChannel?: "email" | "linkedin_connection" | "linkedin_message" | "cold_call" | "video_script" | null;
  };
  timingPreference?: {
    preferredFreshness: "fresh" | "recent" | "stale" | "undated" | null;
    freshPreference: number;
    recentPreference: number;
    staleTolerance: number;
    undatedTolerance: number;
    preferredSendWindow: "weekday_morning" | "weekday_afternoon" | "weekday_evening" | "weekend" | null;
  };
  recentCompanyMemory: {
    buyerTensionIds: string[];
    structuralVariants: string[];
    hookTexts: string[];
  };
  currentCompanyDomain?: string | null;
  retrievalLibrary?: RetrievedHookPattern[];
  sourceTypeBoosts?: Partial<Record<"first_party" | "trusted_news" | "semantic_web" | "fallback_web", number>>;
  triggerSourceTypeBoosts?: Partial<Record<string, Partial<Record<"first_party" | "trusted_news" | "semantic_web" | "fallback_web", number>>>>;
  pinnedSourceTypes?: Partial<Record<"first_party" | "trusted_news" | "semantic_web" | "fallback_web", boolean>>;
  pinnedTriggerSourceTypes?: Partial<Record<string, Partial<Record<"first_party" | "trusted_news" | "semantic_web" | "fallback_web", boolean>>>>;
  counterfactuals?: {
    buyerTensionPenalties: Record<string, number>;
    structuralVariantPenalties: Record<string, number>;
    evidenceTierPenalties: Partial<Record<EvidenceTier, number>>;
    targetRolePenalties: Record<string, number>;
    staleSourcePenalty: number;
    undatedSourcePenalty: number;
  };
};

export type TensionPattern =
  | "direct-challenger"
  | "curiosity-gap"
  | "pain-forward"
  | "signal-mirror"
  | "hidden-cost"
  | "scale-friction"
  | "proof-to-problem";

export type BuyerTension = {
  id: string;
  news_item: number;
  source_title: string;
  source_date: string;
  source_url: string;
  evidence_tier: EvidenceTier;
  evidence_snippet: string;
  trigger_type?: TriggerType;
  angle: Angle;
  buyer_tension: string;
  why_now?: string;
  affected_metric?: string;
  pattern_family: TensionPattern;
  specificity_tokens: string[];
  confidence: Confidence;
  richness_score: number;
  specificity_score: number;
  interestingness_score: number;
};

export type IntentSignalInput = {
  triggerType: string;
  summary: string;
  confidence: number;
  sourceUrl: string;
  tier: "A" | "B";
};

export type ChannelVariant = {
  channel: "linkedin_connection" | "linkedin_message" | "cold_call" | "video_script";
  text: string;
};

export type HookWithVariants = Hook & {
  variants: ChannelVariant[];
};

export type Source = {
  title: string;
  publisher: string;
  date: string;
  url: string;
  facts: string[];
};

export type ClassifiedSource = Source & {
  tier: EvidenceTier;
  stale?: boolean;
  anchorScore?: number;
  entity_hit_score?: number;
  entity_matched_term?: string | null;
  entity_mismatch?: boolean;
  tier_reason?: string;
  userProvided?: boolean;
  duplicate_cluster_key?: string;
};

export type CompanyCandidate = {
  id: string;
  name: string;
  url: string;
  description?: string;
  source?: string;
};

export type CompanyResolutionStatus = "ok" | "needs_disambiguation" | "no_match";

export type CompanyResolutionResult = {
  status: CompanyResolutionStatus;
  companyName: string;
  candidates: CompanyCandidate[];
};

export type ClaudeHookPayload = {
  news_item: number;
  angle: string;
  hook: string;
  evidence_snippet: string;
  source_title: string;
  source_date: string;
  source_url: string;
  evidence_tier: string;
  confidence: string;
  psych_mode?: string;
  why_this_works?: string;
  trigger?: string;
  trigger_type?: string;
  promise?: string;
  bridge_quality?: "strong" | "moderate" | "weak";
  structural_variant?: string;
  buyer_tension?: string;
  why_now?: string;
  affected_metric?: string;
  buyer_tension_id?: string;
  tension_richness_score?: number;
  specificity_score?: number;
  interestingness_score?: number;
};

type ClaudeBuyerTensionPayload = {
  id?: string;
  news_item?: number;
  source_title?: string;
  source_date?: string;
  source_url?: string;
  evidence_tier?: string;
  evidence_snippet?: string;
  trigger_type?: string;
  angle?: string;
  buyer_tension?: string;
  why_now?: string;
  affected_metric?: string;
  pattern_family?: string;
  specificity_tokens?: string[];
  confidence?: string;
  richness_score?: number;
  specificity_score?: number;
  interestingness_score?: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BANNED_WORDS = [
  "curious",
  "worth a quick",
  "just checking in",
  "just checking",
  "hope you're well",
  "hope you are well",
  "touching base",
  "i'd love to",
  "i would love to",
  "quick question",
  "quick chat",
  "i came across",
  "i noticed your company",
  "game-changing",
  "innovative solution",
  "disrupting the space",
  "cutting-edge",
  "interested in",
  "teams like you",
  "on your radar",
  // Unsourced-claim blocklist — these are only allowed if literally in the evidence
  "teams lose",
  "teams in your space",
  "usually lose",
  "% of qualified",
  "% better than",
  "% faster than",
  "% more than",
  "industry average",
  "industry benchmark",
  "peers in your space",
  "compared to peers",
];

// Claims that are ONLY allowed if the exact phrase appears in source evidence.
// If the hook contains these but the evidence_snippet does not, the hook is rejected.
const UNSOURCED_CLAIM_PATTERNS = [
  /revamp/i,
  /redesign/i,
  /\bhiring\b/i,
  /performance lift/i,
  /pipeline strength/i,
  /strong pipeline/i,
  /\d+%\s*(better|faster|more|less|higher|lower|improvement|increase|decrease|lift|drop)/i,
  /benchmark/i,
  /outperform/i,
];

// Change verbs that imply a company action/transition. These are ONLY allowed
// if the evidence contains an explicit time marker or change statement.
const CHANGE_VERB_PATTERNS = [
  /\bswitched\b/i, /\brevamped\b/i, /\brecently changed\b/i,
  /\bnow (doing|charging|offering|using|running|building|selling)\b/i,
  /\bhiring across\b/i, /\bmoved to\b/i,
  /\bjust launched\b/i, /\bjust started\b/i, /\bjust added\b/i,
  /\brecently (launched|started|added|introduced|adopted|moved|shifted|pivoted)\b/i,
  /\bstarted (using|offering|doing|building)\b/i,
  /\bshifted (to|from|toward)\b/i, /\bpivoted (to|from|toward)\b/i,
  /\badopted\b/i, /\btransitioned (to|from)\b/i,
];

// Time/change cues that justify using a change verb.
const CHANGE_TIME_CUES = [
  /\b(Q[1-4])\s*\d{4}/i, /\b20\d{2}\b/, /\blast (month|quarter|year|week)\b/i,
  /\brecently\b/i, /\bjust\b/i, /\bnew(ly)?\b/i,
  /\bannounced\b/i, /\blaunched\b/i, /\bintroduced\b/i,
  /\breleased\b/i, /\bmigrat/i, /\bupgrad/i, /\bswitch/i,
  /\bpivot/i, /\btransition/i, /\bshift/i, /\badopt/i,
  /\bJanuary|February|March|April|May|June|July|August|September|October|November|December\b/i,
];

export const VALID_ANGLES: Angle[] = ["trigger", "risk", "tradeoff"];
export const VALID_CONFIDENCES: Confidence[] = ["high", "med"];
export const VALID_PSYCH_MODES: PsychMode[] = [
  "relevance", "curiosity_gap", "symptom", "tradeoff_frame", "contrarian", "benefit",
];
export const MAX_HOOK_CHARS = 400;

// Vague/philosophical question patterns that get rejected.
// Hooks must ask forced-choice, ownership, timing, or mechanism questions.
const VAGUE_QUESTION_PATTERNS = [
  /\bare you seeing\b/i,
  /\bhow are you thinking about\b/i,
  /\bhow do you think about\b/i,
  /\bwhat are your thoughts\b/i,
  /\bwhat do you think\b/i,
  /\bhow does that (feel|land|sit)\b/i,
  /\bhave you considered\b/i,
  /\bis (this|that) something\b/i,
  /\bis (this|that) on your radar\b/i,
  /\bare you looking (at|into)\b/i,
  /\bhow are you (handling|managing|approaching|dealing)\b/i,
  /\bhow does your team (feel|think) about\b/i,
  /\bwhat's your (take|view|stance|perspective)\b/i,
  /\bwhat are you doing about\b/i,
  /\bare you exploring\b/i,
  /\bare you concerned\b/i,
  /\bholding up as\b/i,
  /\bkeeping pace\b/i,
  /\bcurious if\b/i,
  /\bconverting to pipeline\b/i,
];

// Invented causality: ungrounded causal claims that sound authoritative but aren't evidence-based
const INVENTED_CAUSALITY_PATTERNS = [
  /\bthe usual bottleneck is\b/i,
  /\btypically this means\b/i,
  /\bmost teams struggle with\b/i,
  /\bdisconnected systems\b/i,
  /\bthe challenge is\b/i,
  /\bthe problem is usually\b/i,
  /\bcommonly leads to\b/i,
  /\boften results in\b/i,
];

// Abstract nouns that signal consultant-speak when overloaded in questions
const ABSTRACT_NOUNS = [
  "compliance", "engagement", "methodology", "positioning", "strategy",
  "alignment", "optimization", "transformation", "enablement", "governance",
  "framework", "paradigm", "synergy", "ecosystem", "philosophy",
];

// Question framing bans: consultant-speak question patterns
const QUESTION_FRAMING_BANS = [
  /\bfocusing on\b/i,
  /\bdriven by\b/i,
  /\bwhat'?s your (approach|strategy|philosophy)\b/i,
  /\bhow are you (thinking|approaching)\b/i,
];

// Vague date patterns that should be rejected unless the source literally uses them.
// Hooks must use exact dates from the source (e.g. "Jan 2026", "February 2026").
const VAGUE_DATE_PATTERNS = [
  /\bearly\s+\d{4}\b/i,
  /\blate\s+\d{4}\b/i,
  /\bmid[- ]\d{4}\b/i,
  /\bthis year\b/i,
  /\bthis quarter\b/i,
];

// No mock/template hooks — every hook must be sourced from real evidence.
const MOCK_HOOKS: string[] = [];

// Signal keywords for classifying facts as signal vs fundamental
const SIGNAL_KEYWORDS = [
  "announced", "announces", "announcing",
  "launched", "launches", "launching",
  "released", "releases", "releasing",
  "acquired", "acquires", "acquisition",
  "raised", "funding", "series",
  "hired", "hiring", "hires", "job posting",
  "partnered", "partnership", "partners with",
  "expanded", "expands", "expansion",
  "introduced", "introduces", "introducing",
  "updated", "updates", "update",
  "now supports", "added support",
  "migrated", "migration",
  "closed", "closing",
  "won", "awarded",
  "rebranded", "rebrand",
  "merged", "merger",
  "opened", "opening",
  "deprecated", "sunset",
  "Q1", "Q2", "Q3", "Q4",
  "revenue", "ARR", "MRR",
  "customers", "users",
  "headcount", "employees",
  "valuation",
];

// ---------------------------------------------------------------------------
// Company name extraction from URL
// ---------------------------------------------------------------------------

// Common vanity URL prefixes that obscure the real brand name (e.g. "go" in gomotive.com → Motive)
const VANITY_PREFIXES = ["go", "my", "get", "try", "use", "the", "hey", "join", "meet", "with"];

// Generic subdomains that are NOT the brand name (e.g. community.hubspot.com → hubspot)
const GENERIC_SUBDOMAINS = new Set([
  "community", "press", "blog", "news", "newsroom", "support", "help",
  "docs", "api", "app", "mail", "www", "cdn", "static", "assets",
  "developers", "dev", "learn", "academy", "university", "forum", "forums",
  "status", "careers", "jobs", "shop", "store", "portal", "login", "auth",
]);

export function extractCompanyName(url: string): string {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    // Remove www. and TLD
    const parts = hostname.replace(/^www\./, "").split(".");
    // If the first part is a generic subdomain (e.g. community.hubspot.com → use "hubspot")
    let name = (parts.length >= 3 && GENERIC_SUBDOMAINS.has(parts[0].toLowerCase()))
      ? (parts[1] || parts[0])
      : (parts[0] || "");
    // Strip vanity prefixes (e.g. "gomotive" → "motive", "getreachwise" → "reachwise")
    // Only strip if the remaining word is >= 3 chars so we don't over-strip short names
    for (const prefix of VANITY_PREFIXES) {
      if (name.toLowerCase().startsWith(prefix) && name.length > prefix.length + 2) {
        name = name.slice(prefix.length);
        break;
      }
    }
    // Convert hyphens to spaces, capitalize
    return name
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split(".")[0] || url;
  }
}

export function getDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Company anchor scoring
// ---------------------------------------------------------------------------

const SIGNAL_PAGE_PATTERNS = [
  /\/press/i, /\/newsroom/i, /\/blog\b/i, /\/changelog/i,
  /\/release-notes/i, /\/careers/i, /\/jobs\b/i, /\/partners/i,
  /\/announcements/i, /\/whats-new/i, /\/swipefiles?\b/i,
  /\/customers?\b/i, /\/case-stud/i, /\/success-stor/i,
  /\/results?\b/i, /\/roi\b/i,
];

// Common English words that happen to be company names.
// When the extracted name matches one of these, we require domain-level anchoring
// (not just the word appearing in text) to avoid false positives.
const GENERIC_NAME_WORDS = new Set([
  "sales", "data", "cloud", "app", "apps", "tech", "digital", "web",
  "smart", "fast", "go", "get", "one", "hub", "link", "open", "next",
  "base", "core", "flow", "snap", "pay", "trade", "market", "shop",
  "code", "mail", "lead", "leads", "signal", "boost", "click", "bit",
  "box", "plan", "crew", "team", "work", "build", "launch", "scale",
  "guide", "track", "start", "stack", "source", "point", "key",
  "spring", "pulse", "spark", "bridge", "path", "nest", "wave",
]);

// ---------------------------------------------------------------------------
// Entity Match Gate — prevent wrong-entity evidence
// ---------------------------------------------------------------------------

export type EntityMatchResult = {
  entity_hit_score: number;
  entity_matched_term: string | null;
  reason_code?: "ENTITY_MISMATCH";
};

/**
 * Compute how strongly a source's evidence is about the target entity.
 * Returns score + matched term. Score 0 = evidence is about a different entity.
 *
 * Checks title + all facts for:
 *   - Target company name (case-insensitive, non-generic names only)
 *   - Target domain appearing in text
 *   - Source URL is on target domain
 */
export function computeEntityHitScore(
  source: Source,
  companyName: string,
  domain: string,
): EntityMatchResult {
  const titleAndFacts = (source.title + " " + source.facts.join(" ")).toLowerCase();
  const nameLower = companyName.toLowerCase();
  const domainLower = domain.toLowerCase();
  const sourceHost = getDomain(source.url).toLowerCase();

  const isGenericName = GENERIC_NAME_WORDS.has(nameLower) || nameLower.length <= 3;

  // Source is on the target's own domain → always entity match
  if (sourceHost === domainLower || sourceHost.endsWith("." + domainLower)) {
    return { entity_hit_score: 3, entity_matched_term: domainLower };
  }

  // Domain string appears in title/facts (e.g. "benifex.com" mentioned in article)
  if (titleAndFacts.includes(domainLower)) {
    return { entity_hit_score: 2, entity_matched_term: domainLower };
  }

  // Non-generic company name appears in title/facts
  if (!isGenericName && nameLower.length >= 2 && titleAndFacts.includes(nameLower)) {
    return { entity_hit_score: 2, entity_matched_term: nameLower };
  }

  // No entity match found
  return { entity_hit_score: 0, entity_matched_term: null, reason_code: "ENTITY_MISMATCH" };
}

/**
 * Compute how strongly a source is anchored to the target company.
 * Score >= 3 → company-specific (eligible for Tier A).
 * Score < 3 → market context only (forced to Tier B).
 */
export function computeAnchorScore(
  source: Source,
  companyName: string,
  domain: string,
): number {
  let score = 0;
  const titleAndFacts = (source.title + " " + source.facts.join(" ")).toLowerCase();
  const nameLower = companyName.toLowerCase();
  const domainLower = domain.toLowerCase();
  const sourceHost = getDomain(source.url).toLowerCase();

  // Check if the company name is a common word — if so, only domain match counts
  const isGenericName = GENERIC_NAME_WORDS.has(nameLower) || nameLower.length <= 3;

  // +3 if company name appears in title or facts
  // But skip this for generic names (the word "sales" appears in every business article)
  if (!isGenericName && nameLower.length >= 2 && titleAndFacts.includes(nameLower)) {
    score += 3;
  }

  // For generic names, require exact domain or "domain.tld" in text
  if (isGenericName && nameLower.length >= 2) {
    // Only count if the full domain (e.g. "sales.co") appears, not just the word
    if (titleAndFacts.includes(domainLower)) {
      score += 3;
    }
  }

  // +3 if source is on the company domain
  if (sourceHost === domainLower || sourceHost.endsWith("." + domainLower)) {
    score += 3;
  }

  // +3 if domain string appears in title/facts (for third-party articles mentioning the domain)
  if (titleAndFacts.includes(domainLower) && sourceHost !== domainLower) {
    score += 3;
  }

  // +2 if source is on company domain AND path is a signal page
  if (sourceHost === domainLower || sourceHost.endsWith("." + domainLower)) {
    if (SIGNAL_PAGE_PATTERNS.some((p) => p.test(source.url))) {
      score += 2;
    }
  }

  // +2 if source is on company domain AND has specific claims (numbers, pricing, integrations, SLA)
  if (sourceHost === domainLower || sourceHost.endsWith("." + domainLower)) {
    const joined = source.facts.join(" ");
    const hasSpecific =
      /\$[\d,.]+|\d+\s*\/\s*mo/i.test(joined) ||           // pricing
      /\d+%/.test(joined) ||                                 // percentages
      /\d+[,.]?\d*\s*(users|customers|teams|companies)/i.test(joined) || // user counts
      /\b(Salesforce|HubSpot|Slack|Zapier|Gong|Outreach|Marketo|Pardot|Segment|Snowflake)\b/i.test(joined) || // named integrations
      /\b(uptime|SLA|SOC\s*2|GDPR|HIPAA|guarantee)\b/i.test(joined); // SLA/compliance
    if (hasSpecific) score += 2;
  }

  // +1 if source is within 365 days (matches staleness window)
  if (source.date && !isStale(source.date)) {
    score += 1;
  }

  return score;
}

// ---------------------------------------------------------------------------
// First-party / reputable publisher classification
// ---------------------------------------------------------------------------

/**
 * Reputable publisher domains that earn Tier A even as third-party sources.
 * These are major press outlets, financial filings, and government/official sources.
 */
export const REPUTABLE_PUBLISHER_DOMAINS = new Set([
  // Major press
  "reuters.com", "apnews.com", "bloomberg.com", "wsj.com",
  "nytimes.com", "ft.com", "bbc.com", "bbc.co.uk", "cnbc.com",
  "forbes.com", "businessinsider.com", "fortune.com", "inc.com",
  // Tech press
  "techcrunch.com", "theverge.com", "wired.com", "arstechnica.com",
  "venturebeat.com", "zdnet.com", "techtarget.com", "infoworld.com",
  "saastr.com",
  // Financial filings / official
  "sec.gov", "gov.uk", "europa.eu",
  // Industry-specific authoritative
  "prnewswire.com", "businesswire.com", "globenewswire.com",
  "marketwatch.com",
]);

/**
 * Check if a source URL is first-party (on the target's domain or a verified subdomain).
 */
export function isFirstPartySource(sourceUrl: string, targetDomain: string): boolean {
  const sourceHost = getDomain(sourceUrl).toLowerCase();
  const td = targetDomain.toLowerCase();
  if (sourceHost === td || sourceHost.endsWith("." + td)) return true;
  // Also treat newsroom/press/news path patterns on the target's base domain as first-party.
  // Handles cases like press.gomotive.com/news/ where subdomain differs but base domain matches.
  const FIRST_PARTY_PATH_PATTERNS = ['/newsroom/', '/company/news/', '/press/', '/news/'];
  const baseDomain = td.includes(".") ? td.split(".").slice(-2).join(".") : td;
  const urlLower = sourceUrl.toLowerCase();
  return (sourceHost === baseDomain || sourceHost.endsWith("." + baseDomain)) &&
    FIRST_PARTY_PATH_PATTERNS.some((p) => urlLower.includes(p));
}

/**
 * Check if a source is from a reputable publisher (earns Tier A as third-party).
 */
export function isReputablePublisher(sourceUrl: string): boolean {
  const sourceHost = getDomain(sourceUrl).toLowerCase();
  for (const domain of REPUTABLE_PUBLISHER_DOMAINS) {
    if (sourceHost === domain || sourceHost.endsWith("." + domain)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Evidence tier classification
// ---------------------------------------------------------------------------

const TIER_A_URL_PATTERNS = [
  /\/newsroom\//i,
  /\/company\/news\//i,
  /\/press\//i,
  /\/news\//i,
  /\/press/i,
  /\/newsroom/i,
  /\/company\/news/i,
  /\/blog\b/i,
  /\/changelog/i,
  /\/release-notes/i,
  /\/releases/i,
  /\/investor/i,
  /\/earnings/i,
  /\/case-stud/i,
  /\/careers/i,
  /\/jobs\//i,
  /\/announcements/i,
  /\/whats-new/i,
];

const TIER_A_TITLE_PATTERNS = [
  /press release/i,
  /\bannounces?\b/i,
  /\blaunches?\b/i,
  /\bQ[1-4]\b/,
  /\bearnings\b/i,
  /\bchangelog\b/i,
  /\brelease notes?\b/i,
  /\bcase study\b/i,
  /\bpartnership\b/i,
  /\bhiring\b/i,
  /\braises?\b.*\$\d/i,
  /\bacquires?\b/i,
  /\bacquisition\b/i,
  /\bIPO\b/,
  /\bnew feature\b/i,
  /\bproduct update\b/i,
];

const TIER_C_URL_PATTERNS = [
  /crunchbase\.com/i,
  /zoominfo\.com/i,
  /similarweb\.com/i,
  /owler\.com/i,
  /pitchbook\.com/i,
  /dnb\.com/i,
  /glassdoor\.com/i,
  /wikipedia\.org/i,
];

/**
 * Patterns that indicate a source is secondary commentary (agency blog, newsletter,
 * opinion piece) rather than a primary/authoritative source. These domains are NOT
 * the subject company — they're third-party writers reporting on or commenting about it.
 *
 * A secondary source is capped at Tier B unless it links to and cites a primary source
 * that we also fetch.
 */
const SECONDARY_COMMENTARY_URL_PATTERNS = [
  /\/blog\b/i,
  /\/article\b/i,
  /\/opinion\b/i,
  /\/insights?\b/i,
  /\/perspectives?\b/i,
  /\/newsletter\b/i,
  /\/roundup\b/i,
  /\/recap\b/i,
  /\/review\b/i,
  /\/analysis\b/i,
  /\/commentary\b/i,
  /\/podcast\b/i,
  /\/episode\b/i,
];

/** Known secondary/commentary domains — agency blogs, newsletters, aggregators. */
const SECONDARY_COMMENTARY_DOMAINS = [
  /rev-empire\.com/i,
  /saleshacker\.com/i,
  /outreach\.io\/blog/i,
  /gong\.io\/blog/i,
  /hubspot\.com\/blog/i,
  /close\.com\/blog/i,
  /apollo\.io\/blog/i,
  /lemlist\.com\/blog/i,
  /woodpecker\.co\/blog/i,
  /mailshake\.com\/blog/i,
  /smartlead\.ai\/blog/i,
  /instantly\.ai\/blog/i,
  /medium\.com/i,
  /substack\.com/i,
  /forbes\.com\/sites/i,
  /entrepreneur\.com/i,
  /inc\.com/i,
  /techcrunch\.com/i,
  /venturebeat\.com/i,
  /thenextweb\.com/i,
  /businessinsider\.com/i,
  /zdnet\.com/i,
];

/**
 * Returns true if a source URL is from a third-party commentary/secondary site
 * (not the target company's own domain).
 */
function isSecondaryCommentary(sourceUrl: string, targetDomain?: string): boolean {
  const sourceHost = getDomain(sourceUrl).toLowerCase();

  // If we know the target domain and this source IS the target domain, it's not secondary
  if (targetDomain) {
    const td = targetDomain.toLowerCase();
    if (sourceHost === td || sourceHost.endsWith("." + td)) return false;
  }

  // Check known commentary domains
  for (const pattern of SECONDARY_COMMENTARY_DOMAINS) {
    if (pattern.test(sourceUrl)) return true;
  }

  // Check commentary URL path patterns (only for third-party domains)
  if (targetDomain) {
    const td = targetDomain.toLowerCase();
    const isOwnDomain = sourceHost === td || sourceHost.endsWith("." + td);
    if (!isOwnDomain) {
      for (const pattern of SECONDARY_COMMENTARY_URL_PATTERNS) {
        if (pattern.test(sourceUrl)) return true;
      }
    }
  }

  return false;
}

/** Returns true if the facts contain concrete specifics (numbers, dates, dollar amounts). */
function factsHaveSpecifics(facts: string[]): boolean {
  const joined = facts.join(" ");
  if (/\d/.test(joined)) return true;
  if (/Q[1-4]/i.test(joined)) return true;
  return false;
}

/** Check if a source's date makes it stale (>365 days old). */
function isStale(dateStr: string): boolean {
  if (!dateStr) return false; // Unknown date ≠ stale (handled separately)
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return date.getTime() < oneYearAgo;
  } catch {
    return false;
  }
}

/**
 * Classify a source into evidence tiers with recency awareness.
 * Company-site sources from prong C are NOT auto Tier A — they need
 * dated + specific change/intent to earn Tier A.
 *
 * @param targetDomain - The domain of the company being researched (e.g. "linkedin.com").
 *   Used to distinguish the company's own pages from third-party commentary.
 */
export function classifySource(source: Source, isCompanySite = false, targetDomain?: string): EvidenceTier {
  // Tier C: aggregator/scraper sites
  for (const pattern of TIER_C_URL_PATTERNS) {
    if (pattern.test(source.url)) return "C";
  }

  // Tier C: no facts or trivially short
  if (source.facts.length === 0) return "C";
  if (source.facts.every((f) => f.trim().length < 20)) return "C";

  // Secondary commentary cap: third-party blog/agency/newsletter → max Tier B
  // Exception: reputable publishers (Reuters, Bloomberg, TechCrunch, etc.) can still reach Tier A
  // because they're authoritative sources, not opinion commentary.
  if (isSecondaryCommentary(source.url, targetDomain) && !isReputablePublisher(source.url)) {
    // Even with strong facts, secondary sources cap at B
    if (source.facts.length > 0 && sourceHasConcreteEvidence(source.facts)) return "B";
    return factsHaveSpecifics(source.facts) ? "B" : "C";
  }

  // Homepage or generic marketing pages → B, unless they have highly specific claims
  const urlLower = source.url.toLowerCase();
  const isHomepage = /^https?:\/\/[^/]+\/?$/.test(urlLower);
  const isGenericPage = /\/(about|solutions|platform|products|features|pricing|why-|overview)\b/i.test(urlLower);
  if (isHomepage || isGenericPage) {
    // Exception: company-site pages with strong specificity (numbers, pricing, integrations)
    // can reach Tier B (they'll get boosted by anchor scoring later)
    return "B";
  }

  // Tier A: URL pattern match
  for (const pattern of TIER_A_URL_PATTERNS) {
    if (pattern.test(source.url)) {
      if (/\/company\/news\//i.test(source.url) || /\/newsroom\//i.test(source.url) || /\/press\//i.test(source.url) || /\/news\//i.test(source.url)) {
        console.log("[classifySource] newsroom/news URL matched Tier A pattern", {
          url: source.url,
          matchedPattern: pattern.toString(),
        });
      }
      return "A";
    }
  }

  // For company-site sources (prong C): press/newsroom/blog on company domain = Tier A
  // if facts exist, even without date (undated pages are flagged for ranking penalty)
  if (isCompanySite) {
    if (source.facts.length > 0 && TIER_A_URL_PATTERNS.some((p) => p.test(source.url))) {
      if (!source.date) {
        (source as any)._freshnessUnknown = true;
      }
      return "A";
    }
    const hasDate = !!source.date;
    const hasSignalContent = factsContainSignals(source.facts);
    if (hasDate && hasSignalContent && factsHaveSpecifics(source.facts)) return "A";
    return "B";
  }

  // Generic SEO blog post guard: listicle/guide titles like "15 strategies to..."
  // only qualify for Tier A if on company domain AND have concrete quoteable claims
  const isGenericBlogPost = /\b\d+\s+(strategies|tips|ways|steps|tools|tactics|ideas|methods|techniques|examples|templates)\b/i.test(source.title)
    || /\bhow to\b.*\b(generate|get|build|create|increase|boost|grow|improve)\b/i.test(source.title)
    || /\b(ultimate|complete|definitive)\s+guide\b/i.test(source.title);
  if (isGenericBlogPost) {
    // Only usable if on company domain with concrete claims; otherwise force B
    if (sourceHasConcreteEvidence(source.facts)) return "B"; // B, not A — capped at 1 hook
    return "C";
  }

  // Tier A: title pattern match
  for (const pattern of TIER_A_TITLE_PATTERNS) {
    if (pattern.test(source.title)) return "A";
  }

  // Tier A: has date + concrete specifics
  if (source.date && factsHaveSpecifics(source.facts)) return "A";

  // Tier C: no date and no specifics
  if (!source.date && !factsHaveSpecifics(source.facts)) return "C";

  // Default: B
  return "B";
}

/**
 * Apply stale downgrade: A→B, B→C for sources older than 365 days.
 * Exception: reputable publishers (Reuters, TechCrunch, etc.) are never downgraded —
 * a funding round article is valid evidence regardless of age within the Exa window.
 * Sources with no date get capped at Tier B.
 */
function applyRecencyDowngrade(source: ClassifiedSource): ClassifiedSource {
  const stale = isStale(source.date);
  const noDate = !source.date;

  if (stale && !isReputablePublisher(source.url)) {
    const downgraded: EvidenceTier = source.tier === "A" ? "B" : "C";
    return { ...source, tier: downgraded, stale: true };
  }

  // No-date policy:
  // - Keep Tier A for explicit newsroom/press/changelog/case-study style URLs
  //   because index/listing pages often omit a top-level publish date.
  // - Otherwise cap no-date Tier A sources at B to avoid over-trusting vague pages.
  if (noDate && source.tier === "A") {
    const isExplicitSignalPage = TIER_A_URL_PATTERNS.some((p) => p.test(source.url));
    if (isExplicitSignalPage) return { ...source, _freshnessUnknown: true } as ClassifiedSource;
    return { ...source, tier: "B" };
  }

  return source;
}

// ---------------------------------------------------------------------------
// Signal vs Fundamental classification
// ---------------------------------------------------------------------------

/** Check if facts contain signal keywords (change/intent/event). */
function factsContainSignals(facts: string[]): boolean {
  const joined = facts.join(" ").toLowerCase();
  return SIGNAL_KEYWORDS.some((kw) => joined.includes(kw.toLowerCase()));
}

export type FactClassification = "signal" | "fundamental";

/** Classify a single fact as signal or fundamental. */
export function classifyFact(fact: string): FactClassification {
  const lower = fact.toLowerCase();
  if (SIGNAL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) {
    return "signal";
  }
  return "fundamental";
}

/** Count signal facts across all sources. */
export function countSignalFacts(sources: ClassifiedSource[]): number {
  let count = 0;
  for (const source of sources) {
    for (const fact of source.facts) {
      if (classifyFact(fact) === "signal") count++;
    }
  }
  return count;
}

/** Count high-confidence intent signals (>= 80%) used for threshold gating. */
export function countHighConfidenceIntentSignals(intentSignals: IntentSignalInput[] = []): number {
  return intentSignals.filter((s) => s.confidence >= 0.8).length;
}

// ---------------------------------------------------------------------------
// Exa Search API helpers
// ---------------------------------------------------------------------------

type ExaResult = {
  title?: string;
  url?: string;
  text?: string;
  score?: number;
  publishedDate?: string;
};

async function exaSearch(
  query: string,
  apiKey: string,
  options: {
    num_results?: number;
    days?: number;
    include_domains?: string[];
    exclude_domains?: string[];
  } = {},
): Promise<ExaResult[]> {
  const body: Record<string, unknown> = {
    query,
    type: "auto",
    numResults: options.num_results ?? 10,
    contents: { text: true },
  };
  if (options.days) {
    body.startPublishedDate = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString();
  }
  if (options.include_domains?.length) body.includeDomains = options.include_domains;
  if (options.exclude_domains?.length) body.excludeDomains = options.exclude_domains;

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data?.results ?? []) as ExaResult[];
}

function exaResultToSource(r: ExaResult, fallbackUrl: string): Source | null {
  const facts: string[] = [];
  const text = (r.text?.trim() || "").slice(0, 8000);
  if (text) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
    if (sentences.length > 1) {
      facts.push(...sentences.slice(0, 8));
    } else {
      facts.push(text);
    }
  }
  // Fallback: if content is empty but title is meaningful, use title as the fact.
  // This prevents discarding sources like "Gong raises $250M Series E" just because
  // Exa returned an empty snippet — the title alone is enough for tier classification.
  if (facts.length === 0 && r.title?.trim() && r.title.trim().length > 20) {
    facts.push(r.title.trim());
  }

  if (facts.length === 0) return null;

  let publisher = "";
  try {
    publisher = new URL(r.url || fallbackUrl).hostname;
  } catch {
    publisher = fallbackUrl;
  }

  return {
    title: (r.title || "Untitled").trim(),
    publisher,
    date: r.publishedDate || "",
    url: r.url || "",
    facts,
  };
}

// ---------------------------------------------------------------------------
// Prong A: Exa News Search
// ---------------------------------------------------------------------------

async function fetchNewsSignals(
  companyName: string,
  domain: string,
  apiKey: string,
): Promise<ClassifiedSource[]> {
  const query = `"${companyName}" OR "${domain}"`;

  // Single 90-day search; fallback to 365d only if too few results
  const processResults = (results: any[]) =>
    results
      .filter((r) => {
        const text = `${r.title || ""} ${r.text || ""}`.toLowerCase();
        return text.includes(companyName.toLowerCase()) || text.includes(domain.toLowerCase());
      })
      .map((r) => exaResultToSource(r, domain))
      .filter((s): s is Source => s !== null)
      .map((s) => applyRecencyDowngrade({ ...s, tier: classifySource(s, false, domain) }));

  const r90 = await exaSearch(query, apiKey, { num_results: 15, days: 90, exclude_domains: [domain] })
    .then(processResults)
    .catch(() => [] as ClassifiedSource[]);

  if (r90.length >= 1) return r90;

  // Fallback: expand to 365 days when no results in 90 days
  return exaSearch(query, apiKey, { num_results: 15, days: 365, exclude_domains: [domain] })
    .then(processResults)
    .catch(() => [] as ClassifiedSource[]);
}

// ---------------------------------------------------------------------------
// Prong B: Exa Web Search (event-focused, excludes company site)
// ---------------------------------------------------------------------------

async function fetchWebSignals(
  companyName: string,
  domain: string,
  apiKey: string,
): Promise<ClassifiedSource[]> {
  const eventVerbs = [
    "announced", "launches", "launched", "release", "released",
    "changelog", "release notes", "partnership", "partners",
    "hires", "hiring", "job posting", "funding",
    "acquired", "acquisition", "now supports", "introduces",
  ].join(" OR ");

  const query = `("${companyName}" OR "${domain}") (${eventVerbs})`;

  // Single 90-day search — covers most relevant signals
  return exaSearch(query, apiKey, { num_results: 10, days: 90, exclude_domains: [domain] })
    .then((results) =>
      results
        .filter((r) => {
          const text = `${r.title || ""} ${r.text || ""}`.toLowerCase();
          return text.includes(companyName.toLowerCase()) || text.includes(domain.toLowerCase());
        })
        .map((r) => exaResultToSource(r, domain))
        .filter((s): s is Source => s !== null)
        .map((s) => applyRecencyDowngrade({ ...s, tier: classifySource(s, false, domain) })),
    )
    .catch(() => [] as ClassifiedSource[]);
}

// ---------------------------------------------------------------------------
// Prong C: Company's Own Signals (blog, press, changelog, careers)
// ---------------------------------------------------------------------------

async function fetchCompanyOwnSignals(
  domain: string,
  apiKey: string,
): Promise<ClassifiedSource[]> {
  const signalPaths = [
    "changelog", "release notes", "press", "newsroom", "company news", "press release",
    "blog", "careers", "jobs", "partners", "integrations", "case study",
  ].join(" OR ");

  const query = `${signalPaths}`;

  try {
    // Use 365-day window — we're searching the company's own content, freshness matters less than coverage
    const results = await exaSearch(query, apiKey, {
      num_results: 10,
      days: 365,
      include_domains: [domain],
    });

    return results
      .map((r) => exaResultToSource(r, domain))
      .filter((s): s is Source => s !== null)
      .map((s) => applyRecencyDowngrade({
        ...s,
        tier: classifySource(s, true, domain), // isCompanySite=true → stricter Tier A rules
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Prong D: Direct Company Page Fetcher
// ---------------------------------------------------------------------------

/** Strip HTML tags and decode entities to get plain text. */
function stripHtml(html: string): string {
  return html
    // Remove script/style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    // Replace block elements with newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Clean up whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

/** Patterns for signal-rich subpage paths to discover from homepage links. */
const SIGNAL_SUBPAGE_PATTERNS = [
  /\/swipefiles?\b/i,
  /\/case-stud/i,
  /\/customers?\b/i,
  /\/success-stor/i,
  /\/results?\b/i,
  /\/roi\b/i,
  /\/integrations?\b/i,
  /\/partners?\b/i,
  /\/changelog\b/i,
  /\/whats-new\b/i,
  /\/release-notes?\b/i,
  /\/press\b/i,
  /\/newsroom\b/i,
  /\/company\/news\b/i,
  /\/blog\b/i,
  /\/announcements?\b/i,
];

const DIRECT_PAGE_FETCH_TIMEOUT_MS = 4500;
const DIRECT_PAGE_JINA_TIMEOUT_MS = 6000;
const DIRECT_PAGE_BODY_LIMIT = 300_000;
const MAX_DISCOVERED_SIGNAL_PAGES = 3;
const MAX_CLAUDE_SOURCES = 6;
const MAX_CLAUDE_FACTS_PER_SOURCE = 4;
const MAX_CLAUDE_FACT_CHARS = 220;
const MAX_CLAUDE_INTENT_SIGNALS = 3;
const MAX_CLAUDE_CONTEXT_CHARS = 500;
const INTERPRETER_MAX_TOKENS = 1600;
const COMPOSER_MAX_TOKENS = 2200;
const TRUSTED_SOURCE_MAX_TOKENS = 1600;

/** Extract claim-rich sentences from plain text (sentences with numbers, pricing, named tools, etc.). */
function extractClaimSentences(text: string, maxFacts = 15): string[] {
  // Split into sentences (period, newline, or semicolon boundaries)
  const rawSentences = text
    .split(/(?<=[.!?])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 300);

  const claims: string[] = [];
  const seen = new Set<string>();

  for (const sentence of rawSentences) {
    if (claims.length >= maxFacts) break;
    const norm = sentence.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(norm)) continue;

    // Prioritize sentences with quantified claims, integrations, pricing, SLA
    const hasNumber = /\d/.test(sentence);
    const hasPrice = /\$[\d,.]+|\d+\s*\/\s*mo/i.test(sentence);
    const hasPercent = /\d+%/.test(sentence);
    const hasIntegration = /\b(integrat|connect|sync|import|export|API|webhook|Salesforce|HubSpot|Slack|Zapier|CRM|Gong|Outreach|Marketo|Pardot)\b/i.test(sentence);
    const hasSLA = /\b(uptime|SLA|guarantee|compliance|SOC|GDPR|HIPAA|security)\b/i.test(sentence);
    const hasOperational = /\b(automat|eliminat|reduc|increas|improv|sav|acceler|streamlin|consolidat|replac)\b/i.test(sentence);

    if (hasNumber || hasPrice || hasPercent || hasIntegration || hasSLA || hasOperational) {
      seen.add(norm);
      claims.push(sentence);
    }
  }

  // If very few claims found, also include descriptive sentences that aren't boilerplate
  if (claims.length < 3) {
    const boilerplatePatterns = [
      /cookie/i, /privacy policy/i, /terms of service/i, /sign up/i,
      /log in/i, /subscribe/i, /newsletter/i, /copyright/i,
      /all rights reserved/i, /contact us/i,
    ];
    for (const sentence of rawSentences) {
      if (claims.length >= maxFacts) break;
      const norm = sentence.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(norm)) continue;
      if (boilerplatePatterns.some((p) => p.test(sentence))) continue;
      // Must have some substance (>40 chars, not just navigation text)
      if (sentence.length > 40) {
        seen.add(norm);
        claims.push(sentence);
      }
    }
  }

  return claims;
}

/** Discover signal-rich subpage URLs from HTML link hrefs. */
function discoverSignalPages(html: string, baseUrl: string): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const found = new Set<string>();
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;

    try {
      const resolved = new URL(href, baseUrl).href;
      // Only same-domain links
      const resolvedHost = new URL(resolved).hostname.replace(/^www\./, "");
      const baseHost = new URL(baseUrl).hostname.replace(/^www\./, "");
      if (resolvedHost !== baseHost) continue;

      // Check against signal subpage patterns
      if (SIGNAL_SUBPAGE_PATTERNS.some((p) => p.test(resolved))) {
        found.add(resolved);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return Array.from(found).slice(0, MAX_DISCOVERED_SIGNAL_PAGES);
}

/**
 * Fetch a single page directly and convert to a Source.
 * Returns null if fetch fails or page has no useful content.
 */
async function fetchPageAsSource(pageUrl: string, domain: string): Promise<Source | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DIRECT_PAGE_FETCH_TIMEOUT_MS);

    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ReachWise/1.0; +https://getsignalhooks.com)",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    // Limit body size to 500KB
    const text = await response.text();
    const html = text.slice(0, DIRECT_PAGE_BODY_LIMIT);

    const plainText = stripHtml(html);
    if (plainText.length < 50) return null;

    // Extract title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : `${domain} page`;

    // Extract claim-rich sentences as facts
    const facts = extractClaimSentences(plainText);
    if (facts.length === 0) {
      // If direct fetch yielded no extractable text AND this looks like a signal page,
      // fall back to Jina AI Reader which handles JS-heavy SPAs
      const isSignalUrl = SIGNAL_SUBPAGE_PATTERNS.some((p) => p.test(pageUrl))
        || TIER_A_URL_PATTERNS.some((p) => p.test(pageUrl));

      if (isSignalUrl) {
        try {
          const jinaController = new AbortController();
          const jinaTimeout = setTimeout(() => jinaController.abort(), DIRECT_PAGE_JINA_TIMEOUT_MS);
          const jinaRes = await fetch(`https://r.jina.ai/${pageUrl}`, {
            headers: { Accept: "text/plain" },
            signal: jinaController.signal,
          });
          clearTimeout(jinaTimeout);

          if (jinaRes.ok) {
            const markdown = await jinaRes.text();
            const jinaText = markdown.slice(0, DIRECT_PAGE_BODY_LIMIT).replace(/\[.*?\]\(.*?\)/g, " ").trim();
            if (jinaText.length >= 50) {
              const jinaTitleMatch = markdown.match(/^#\s+(.+)/m);
              const jinaTitle = jinaTitleMatch ? jinaTitleMatch[1].trim() : title;
              const jinaFacts = extractClaimSentences(jinaText);
              if (jinaFacts.length > 0) {
                console.log("[fetchPageAsSource] Jina fallback succeeded for", pageUrl);
                return { title: jinaTitle, publisher: domain, date: "", url: pageUrl, facts: jinaFacts };
              }
            }
          }
        } catch {
          // Jina fallback failed
        }
      }
      return null;
    }

    return {
      title,
      publisher: domain,
      date: "", // Marketing page — no publication date (not "fresh news")
      url: pageUrl,
      facts,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a user-provided subpage URL and return it as a Tier A ClassifiedSource.
 * Bypasses all signal/tier gating — the user has explicitly vouched for this URL.
 * Falls back to Jina AI Reader for any URL (not just known signal patterns).
 * Returns null if the page can't be fetched or has no extractable content.
 */
export async function fetchUserProvidedSource(
  url: string,
  domain: string,
  exaApiKey?: string,
  options?: {
    companyNameHint?: string;
    targetDomainHint?: string;
    minFacts?: number;
    bypassEntityCheck?: boolean;
  },
): Promise<ClassifiedSource | null> {
  // 1. Try direct fetch first
  let src: Source | null = await fetchPageAsSource(url, domain).catch(() => null);

  // 2. Jina fallback for any URL (fetchPageAsSource only tries Jina for known signal patterns)
  if (!src) {
    try {
      const jinaController = new AbortController();
      const jinaTimeout = setTimeout(() => jinaController.abort(), 12_000);
      const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: "text/plain" },
        signal: jinaController.signal,
      });
      clearTimeout(jinaTimeout);
      if (jinaRes.ok) {
        const markdown = await jinaRes.text();
        const jinaText = markdown.slice(0, 300_000).replace(/\[.*?\]\(.*?\)/g, " ").trim();
        if (jinaText.length >= 50) {
          const jinaTitleMatch = markdown.match(/^#\s+(.+)/m);
          const jinaFacts = extractClaimSentences(jinaText);
          if (jinaFacts.length >= (options?.minFacts ?? 2)) {
            src = {
              title: jinaTitleMatch?.[1]?.trim() ?? `${domain} page`,
              publisher: domain,
              date: "",
              url,
              facts: jinaFacts,
            };
          }
        }
      }
    } catch { /* Jina blocked or timed out */ }
  }

  // 3. Exa fallback — for bot-blocking sites (e.g. gong.io) where direct + Jina both fail.
  if (!src && exaApiKey) {
    try {
      const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
      const results = await exaSearch(
        `site:${domain}`,
        exaApiKey,
        { num_results: 5, include_domains: [domain] },
      );
      for (const r of results) {
        const s = exaResultToSource(r, normalizedUrl);
        if (s && s.facts.length >= 1) {
          src = { ...s, url: r.url || normalizedUrl };
          console.log("[fetchUserProvidedSource] Exa fallback succeeded", { url, resultUrl: r.url });
          break;
        }
      }
    } catch { /* Exa fallback failed */ }
  }

  if (!src) return null;

  // 3. Sanity check: page must have some content mentioning the company OR enough facts
  const companyName = options?.companyNameHint?.trim() || extractCompanyName(url);
  const entityMatchDomain = options?.targetDomainHint?.trim() || "__no-domain-match__";
  const entityMatch = computeEntityHitScore(src as ClassifiedSource, companyName, entityMatchDomain);
  const minFacts = options?.minFacts ?? 3;
  const bypassEntityCheck = options?.bypassEntityCheck ?? false;

  if (!bypassEntityCheck && entityMatch.entity_hit_score === 0 && src.facts.length < minFacts) {
    console.log("[fetchUserProvidedSource] sanity check failed — no entity match and < 3 facts", {
      url,
      companyName,
      entityMatchDomain,
    });
    return null;
  }

  console.log("[fetchUserProvidedSource] success", {
    url,
    factCount: src.facts.length,
    entityHitScore: entityMatch.entity_hit_score,
  });

  return {
    ...src,
    tier: "A" as EvidenceTier,
    anchorScore: 5,
    entity_hit_score: Math.max(entityMatch.entity_hit_score, 1),
    entity_matched_term: entityMatch.entity_matched_term ?? companyName,
    userProvided: true,
  };
}

export async function fetchUserProvidedSourceTurbo(
  url: string,
  domain: string,
  options?: {
    companyNameHint?: string;
    minFacts?: number;
  },
): Promise<ClassifiedSource | null> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  const minFacts = options?.minFacts ?? 1;
  const directController = new AbortController();
  const jinaController = new AbortController();

  const buildClassifiedSource = (src: Source): ClassifiedSource => {
    const companyName = options?.companyNameHint?.trim() || extractCompanyName(normalizedUrl);
    const entityMatch = computeEntityHitScore(src as ClassifiedSource, companyName, "__no-domain-match__");

    return {
      ...src,
      tier: "A" as EvidenceTier,
      anchorScore: 5,
      entity_hit_score: Math.max(entityMatch.entity_hit_score, 1),
      entity_matched_term: entityMatch.entity_matched_term ?? companyName,
      userProvided: true,
    };
  };

  const directAttempt = (async (): Promise<ClassifiedSource> => {
    try {
      const timeout = setTimeout(() => directController.abort(), 2500);
      const response = await fetch(normalizedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ReachWise/1.0; +https://getsignalhooks.com)",
          Accept: "text/html",
        },
        signal: directController.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      if (!response.ok) throw new Error("direct fetch failed");
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) throw new Error("direct content type not html");

      const html = (await response.text()).slice(0, 180_000);
      const plainText = stripHtml(html);
      if (plainText.length < 50) throw new Error("direct text too short");

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const facts = extractClaimSentences(plainText, 8);
      if (facts.length < minFacts) throw new Error("direct facts too thin");

      return buildClassifiedSource({
        title: titleMatch?.[1]?.trim() ?? `${domain} page`,
        publisher: domain,
        date: "",
        url: normalizedUrl,
        facts,
      });
    } catch {
      throw new Error("direct extraction failed");
    }
  })();

  const jinaAttempt = (async (): Promise<ClassifiedSource> => {
    try {
      const timeout = setTimeout(() => jinaController.abort(), 3500);
      const response = await fetch(`https://r.jina.ai/${normalizedUrl}`, {
        headers: { Accept: "text/plain" },
        signal: jinaController.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) throw new Error("jina fetch failed");
      const markdown = await response.text();
      const text = markdown.slice(0, 180_000).replace(/\[.*?\]\(.*?\)/g, " ").trim();
      if (text.length < 50) throw new Error("jina text too short");

      const facts = extractClaimSentences(text, 8);
      if (facts.length < minFacts) throw new Error("jina facts too thin");

      return buildClassifiedSource({
        title: markdown.match(/^#\s+(.+)/m)?.[1]?.trim() ?? `${domain} page`,
        publisher: domain,
        date: "",
        url: normalizedUrl,
        facts,
      });
    } catch {
      throw new Error("jina extraction failed");
    }
  })();

  try {
    const winner = await Promise.any([directAttempt, jinaAttempt]);
    directController.abort();
    jinaController.abort();
    return winner;
  } catch {
    directController.abort();
    jinaController.abort();
    return null;
  }
}

/**
 * Prong D: Directly fetch the company's homepage and signal-rich subpages.
 * This captures actual claims, numbers, and product details that Exa Search misses.
 */
async function fetchDirectCompanyPages(
  domain: string,
): Promise<ClassifiedSource[]> {
  const baseUrl = `https://${domain}`;
  const sources: ClassifiedSource[] = [];

  // 1. Fetch homepage
  let homepageHtml = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DIRECT_PAGE_FETCH_TIMEOUT_MS);
    const response = await fetch(baseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ReachWise/1.0; +https://getsignalhooks.com)",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (response.ok) {
      const text = await response.text();
      homepageHtml = text.slice(0, DIRECT_PAGE_BODY_LIMIT);

      const plainText = stripHtml(homepageHtml);
      if (plainText.length >= 50) {
        const titleMatch = homepageHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : `${domain} homepage`;
        const facts = extractClaimSentences(plainText);
        if (facts.length > 0) {
          const src: Source = {
            title,
            publisher: domain,
            date: new Date().toISOString().split("T")[0],
            url: baseUrl,
            facts,
          };
          // Homepage with specific claims → classify with isCompanySite=true
          sources.push(applyRecencyDowngrade({
            ...src,
            tier: classifySource(src, true, domain),
          }));
        }
      }
    }
  } catch {
    // Homepage fetch failed, continue
  }

  // 2. Discover signal-rich subpages from homepage links + well-known paths
  const signalPages = homepageHtml ? discoverSignalPages(homepageHtml, baseUrl) : [];

  // Also try well-known signal paths that may not be linked from homepage
  const wellKnownPaths = ["/swipefiles", "/customers", "/case-studies", "/changelog", "/blog", "/press", "/company/news/", "/newsroom/", "/press/", "/news/"];
  for (const path of wellKnownPaths) {
    const fullUrl = `${baseUrl}${path}`;
    if (!signalPages.includes(fullUrl)) {
      signalPages.push(fullUrl);
    }
  }

  // 3. Fetch discovered subpages in parallel with a small cap so slow company sites
  // don't dominate request time when Exa already found enough evidence.
  if (signalPages.length > 0) {
    const subpageSources = await Promise.all(
      signalPages.slice(0, MAX_DISCOVERED_SIGNAL_PAGES).map((pageUrl) => fetchPageAsSource(pageUrl, domain)),
    );

    for (const src of subpageSources) {
      if (src) {
        sources.push(applyRecencyDowngrade({
          ...src,
          tier: classifySource(src, true, domain),
        }));
      }
    }
  }

  return sources;
}

// ---------------------------------------------------------------------------
// First-party recovery: Exa-powered fallback when direct fetches fail (RC-2)
// ---------------------------------------------------------------------------

async function runFirstPartyRecovery(
  domain: string,
  companyName: string,
  apiKey: string,
  alreadyAttemptedUrls: Set<string>,
): Promise<{ sources: ClassifiedSource[]; diagnostics: RecoveryDiagnostic[] }> {
  const queries = [
    `${companyName} press OR newsroom OR release OR announcement`,
    `${companyName} changelog OR product update OR new feature OR integration`,
  ];

  const resultSets = await Promise.all(
    queries.map((query) =>
      exaSearch(query, apiKey, {
        include_domains: [domain],
        num_results: 5,
        days: 365,
      }).catch(() => [] as ExaResult[]),
    ),
  );
  const allResults = resultSets.flat();

  const seen = new Set<string>();
  const sources: ClassifiedSource[] = [];
  const diagnostics: RecoveryDiagnostic[] = [];

  for (const r of allResults) {
    if (!r.url || alreadyAttemptedUrls.has(r.url) || seen.has(r.url)) continue;
    seen.add(r.url);
    const rawSource = exaResultToSource(r, domain);
    if (!rawSource) continue;
    const tier = classifySource(rawSource, true, domain);
    const freshnessUnknown = tier === "A" && !rawSource.date;
    const classified = applyRecencyDowngrade({
      ...rawSource,
      tier,
      ...(freshnessUnknown ? { _freshnessUnknown: true } : {}),
    } as ClassifiedSource);
    sources.push(classified);
    diagnostics.push({
      url: r.url,
      tier: classified.tier,
      snippetCount: rawSource.facts.length,
      via: "exa-recovery",
    });
  }

  return { sources, diagnostics };
}

async function runRecentNewsExpansion(
  domain: string,
  companyName: string,
  apiKey: string,
  alreadyAttemptedUrls: Set<string>,
): Promise<{ sources: ClassifiedSource[]; diagnostics: NewsExpansionDiagnostic[] }> {
  const queries = buildRecentNewsExpansionQueries(companyName, domain);

  const seen = new Set<string>();
  const sources: ClassifiedSource[] = [];
  const diagnostics = await Promise.all(
    queries.map(async (query) => {
      const results = await exaSearch(query, apiKey, {
        num_results: 8,
        days: 120,
        exclude_domains: [domain],
      }).catch(() => [] as ExaResult[]);

      let queryResultCount = 0;
      let trustedCount = 0;

      for (const r of results) {
        if (!r.url || alreadyAttemptedUrls.has(r.url) || seen.has(r.url)) continue;

        const text = `${r.title || ""} ${r.text || ""}`.toLowerCase();
        if (!text.includes(companyName.toLowerCase()) && !text.includes(domain.toLowerCase())) {
          continue;
        }

        seen.add(r.url);
        const rawSource = exaResultToSource(r, domain);
        if (!rawSource) continue;

        const classified = applyRecencyDowngrade({
          ...rawSource,
          tier: classifySource(rawSource, false, domain),
        });

        queryResultCount += 1;
        if (isReputablePublisher(classified.url)) trustedCount += 1;
        sources.push(classified);
      }

      return {
        query,
        resultCount: queryResultCount,
        trustedCount,
      };
    }),
  );

  return { sources, diagnostics };
}

export function buildRecentNewsExpansionQueries(
  companyName: string,
  domain: string,
): string[] {
  return [
    `"${companyName}" OR "${domain}" funding OR raised OR series OR investment`,
    `"${companyName}" OR "${domain}" launch OR launched OR product OR feature OR AI`,
    `"${companyName}" OR "${domain}" hiring OR hires OR appointed OR partnership OR expansion`,
  ];
}

// ---------------------------------------------------------------------------
// Merge & Deduplicate
// ---------------------------------------------------------------------------

function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip tracking params
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "source"];
    trackingParams.forEach((p) => u.searchParams.delete(p));
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "") + u.search;
  } catch {
    return url;
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function stripSyndicationSuffixes(title: string): string {
  return title
    .replace(/\s+[\|\-–—]\s+(business wire|globenewswire|pr newswire|reuters|techcrunch|bloomberg|marketwatch|yahoo finance)\b.*$/i, "")
    .replace(/^(business wire|globenewswire|pr newswire|reuters|techcrunch|bloomberg|marketwatch|yahoo finance)\s*[:\-]\s*/i, "")
    .trim();
}

function normalizeEventPhrase(title: string): string {
  return normalizeTitle(stripSyndicationSuffixes(title))
    .replace(/\b(series [a-z]|series [0-9]+)\b/g, "series")
    .replace(/\b(announces|announced|launches|launched|introduces|introduced)\b/g, "launch")
    .replace(/\b(raises|raised|raising)\b/g, "raise")
    .replace(/\b(hires|hired|appoints|appointed)\b/g, "hire")
    .replace(/\b(partners|partnered|partnership)\b/g, "partnership")
    .replace(/\b(acquires|acquired|acquisition)\b/g, "acquisition")
    .replace(/\b(expands|expanded|expansion)\b/g, "expansion")
    .replace(/\b(ai)\b/g, "ai")
    .replace(/\b(\d+m|\d+ million|\d+ billion)\b/g, "amount")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSourceDuplicateClusterKey(source: Pick<Source, "title" | "date">): string {
  const normalized = normalizeEventPhrase(source.title);
  const words = normalized.split(" ").filter(Boolean);
  const meaningful = words.filter((word) => word.length > 2).slice(0, 8).join(" ");
  const monthBucket = source.date ? source.date.slice(0, 7) : "undated";
  return `${meaningful || normalized || "untitled"}::${monthBucket}`;
}

function deduplicateSources(sources: ClassifiedSource[]): ClassifiedSource[] {
  const seen = new Map<string, ClassifiedSource>();
  const seenTitles = new Set<string>();
  const seenDomainPaths = new Set<string>();
  const clustered = new Map<string, ClassifiedSource>();

  for (const source of sources) {
    const canonUrl = canonicalizeUrl(source.url);
    const normTitle = normalizeTitle(stripSyndicationSuffixes(source.title));
    const domainPath = canonUrl.split("?")[0]; // URL without query string
    const clusterKey = getSourceDuplicateClusterKey(source);
    source.duplicate_cluster_key = clusterKey;

    // Skip if we've seen this URL, title, or domain+path
    if (seen.has(canonUrl)) continue;
    if (seenDomainPaths.has(domainPath)) continue;

    const existingCluster = clustered.get(clusterKey);
    if (existingCluster) {
      if (scoreSource(source) > scoreSource(existingCluster)) {
        clustered.set(clusterKey, source);
      }
      continue;
    }

    if (normTitle.length > 10 && seenTitles.has(normTitle)) continue;

    seen.set(canonUrl, source);
    clustered.set(clusterKey, source);
    if (normTitle.length > 10) seenTitles.add(normTitle);
    seenDomainPaths.add(domainPath);
  }

  return Array.from(clustered.values());
}

/** Compute specificity score for a source's facts. Higher = more specific claims. */
function computeSpecificityScore(facts: string[]): number {
  let score = 0;
  const joined = facts.join(" ");

  // +2 for numbers (quantified claims)
  if (/\d/.test(joined)) score += 2;

  // +2 for named tools/integrations/products
  if (/\b(Salesforce|HubSpot|Slack|Zapier|Gong|Outreach|Marketo|Pardot|Segment|Snowflake|Stripe|Shopify|Zendesk|Intercom|Drift|LinkedIn|Gmail|Outlook|API|SDK|webhook|CRM|ERP)\b/i.test(joined)) {
    score += 2;
  }

  // +2 for pricing/monetary claims
  if (/\$[\d,.]+|\d+\s*\/\s*mo|\bfree\s+tier\b|\bpricing\b/i.test(joined)) score += 2;

  // +1 for operational/outcome claims
  if (/\b(automat|eliminat|reduc|increas|improv|sav|acceler|streamlin|consolidat|replac|deliver|achiev|generat)\b/i.test(joined)) {
    score += 1;
  }

  // +1 for SLA/compliance claims
  if (/\b(uptime|SLA|SOC|GDPR|HIPAA|guarantee|compliance|security)\b/i.test(joined)) score += 1;

  return score;
}

/** Score a source for ranking (higher = better). */
function scoreSource(source: ClassifiedSource): number {
  let score = 0;

  // Tier
  if (source.tier === "A") score += 30;
  else if (source.tier === "B") score += 10;

  // Anchor score — company-specific sources rank higher
  score += (source.anchorScore ?? 0) * 3;

  // Recency
  if (!source.stale) score += 20;

  // Signal content
  const signalCount = source.facts.filter((f) => classifyFact(f) === "signal").length;
  score += signalCount * 10;

  // Specificity score — prefer sources with quantified, named, operational claims
  score += computeSpecificityScore(source.facts) * 3;

  // Company-owned pages with specific claims get extra boost
  const sourceHost = getDomain(source.url).toLowerCase();
  const isOwnPage = source.url && (source.publisher === sourceHost || source.facts.length >= 3);
  if (isOwnPage && computeSpecificityScore(source.facts) >= 3) {
    score += 15; // Strong boost for company pages with specific content
  }

  // Penalty for undated first-party press/newsroom pages (freshness unknown)
  if ((source as any)._freshnessUnknown) score -= 5;

  return score;
}

// ---------------------------------------------------------------------------
// Main fetchSources: three-pronged, merged, deduplicated, gated
// ---------------------------------------------------------------------------

type RecoveryDiagnostic = {
  url: string;
  tier: EvidenceTier;
  snippetCount: number;
  via: "exa-recovery";
};

type NewsExpansionDiagnostic = {
  query: string;
  resultCount: number;
  trustedCount: number;
};

export type FetchSourcesResult = {
  sources: ClassifiedSource[];
  signalCount: number;
  lowSignal: boolean;
  hasAnchoredSources: boolean;
  _diagnostics: {
    targetDomain: string;
    prongSummary: { news: number; web: number; company: number; direct: number; crunchbase: number; linkedin: number };
    tierBreakdown: Array<{
      url: string;
      tier: string;
      anchorScore: number | undefined;
      entityHitScore: number | undefined;
      tierReason: string | null;
      isFirstParty: boolean;
      freshnessUnknown: boolean;
    }>;
    lowSignalReason: string | null;
    recoveryAttempted: boolean;
    recoveryResults: RecoveryDiagnostic[];
    newsExpansionAttempted: boolean;
    newsExpansionResults: NewsExpansionDiagnostic[];
  };
};

export async function fetchSources(
  url: string,
  apiKey: string,
  intentSignals?: IntentSignalInput[],
): Promise<ClassifiedSource[]> {
  const result = await fetchSourcesWithGating(url, apiKey, intentSignals);
  return result.sources;
}

export async function fetchSourcesWithGating(
  url: string,
  apiKey: string,
  intentSignals: IntentSignalInput[] = [],
  apifyToken?: string,
  linkedinSlug?: string,
): Promise<FetchSourcesResult> {
  const domain = getDomain(url);
  const companyName = extractCompanyName(url);

  // If the user provided a specific subpage URL (not just a domain), fetch it directly.
  // fetchDirectCompanyPages only fetches the homepage and discovers links from it —
  // but JS-heavy SPAs (like gong.io) render links in JS, so subpages are never discovered.
  // Fetching the user-provided URL directly ensures Jina fallback fires for SPA press pages etc.
  let inputPagePromise: Promise<ClassifiedSource[]> = Promise.resolve([] as ClassifiedSource[]);
  try {
    const parsedInput = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (parsedInput.pathname && parsedInput.pathname !== "/" && parsedInput.pathname.length > 1) {
      const signalPageKeywords = /\/(press|newsroom|blog|changelog|news|about|customers|case-studies|resources)\b/i;
      const looksLikeSignalPage = signalPageKeywords.test(parsedInput.pathname);
      inputPagePromise = fetchPageAsSource(parsedInput.href, domain)
        .then(async (src) => {
          if (src) {
            const tier = classifySource(src, true, domain);
            return [{ ...src, tier, userProvided: true }] as ClassifiedSource[];
          }
          // Direct fetch returned null (likely JS-rendered SPA).
          // For user-provided URLs, always try Jina AI Reader — it renders JS pages.
          // fetchPageAsSource only tries Jina for known signal-path patterns; here we
          // extend that effort to ANY subpage the user explicitly submitted.
          try {
            const jinaController = new AbortController();
            const jinaTimeout = setTimeout(() => jinaController.abort(), 12_000);
            const jinaRes = await fetch(`https://r.jina.ai/${parsedInput.href}`, {
              headers: { Accept: "text/plain" },
              signal: jinaController.signal,
            });
            clearTimeout(jinaTimeout);
            if (jinaRes.ok) {
              const markdown = await jinaRes.text();
              const jinaText = markdown.slice(0, 300_000).replace(/\[.*?\]\(.*?\)/g, " ").trim();
              if (jinaText.length >= 50) {
                const jinaTitleMatch = markdown.match(/^#\s+(.+)/m);
                const jinaTitle = jinaTitleMatch ? jinaTitleMatch[1].trim() : `${domain} page`;
                const jinaFacts = extractClaimSentences(jinaText);
                if (jinaFacts.length > 0) {
                  console.log("[inputPagePromise] Jina fallback succeeded for user-provided URL", parsedInput.href);
                  const jsSrc: Source = { title: jinaTitle, publisher: domain, date: "", url: parsedInput.href, facts: jinaFacts };
                  const tier = classifySource(jsSrc, true, domain);
                  return [{ ...jsSrc, tier, userProvided: true }] as ClassifiedSource[];
                }
              }
            }
          } catch { /* Jina fallback failed */ }
          return [] as ClassifiedSource[];
        })
        .catch(() => [] as ClassifiedSource[]);
    }
  } catch { /* invalid URL — skip */ }

  // Run all prongs in parallel (Apify prongs are optional, Pro only)
  const [newsResults, webResults, companyResults, directPageResults, crunchbaseResults, linkedInResults, inputPageResults] = await Promise.all([
    fetchNewsSignals(companyName, domain, apiKey).catch(() => [] as ClassifiedSource[]),
    fetchWebSignals(companyName, domain, apiKey).catch(() => [] as ClassifiedSource[]),
    fetchCompanyOwnSignals(domain, apiKey).catch(() => [] as ClassifiedSource[]),
    fetchDirectCompanyPages(domain).catch(() => [] as ClassifiedSource[]),
    apifyToken ? fetchCrunchbaseSignals(domain, companyName, apifyToken).catch(() => [] as ClassifiedSource[]) : Promise.resolve([] as ClassifiedSource[]),
    (apifyToken && linkedinSlug) ? fetchLinkedInPostSignals(linkedinSlug, domain, apifyToken).catch(() => [] as ClassifiedSource[]) : Promise.resolve([] as ClassifiedSource[]),
    inputPagePromise,
  ]);

  // Merge all sources (input page first — highest dedup priority as user-specified signal source)
  const allSources = [...inputPageResults, ...directPageResults, ...newsResults, ...webResults, ...companyResults, ...crunchbaseResults, ...linkedInResults];

  // Deduplicate
  const deduped = deduplicateSources(allSources);

  // Compute anchor scores + entity match, then reclassify
  const anchored = deduped.map((source) => {
    const anchorScore = computeAnchorScore(source, companyName, domain);
    const entityMatch = computeEntityHitScore(source, companyName, domain);

    // ENTITY MATCH GATE: if evidence is NOT about the target entity → force Tier C
    // Exception 1: confirmed first-party sources with minimum extractable evidence pass through.
    // Exception 2: user-provided URLs — user explicitly vouched for relevance, skip kill.
    if (entityMatch.entity_hit_score === 0) {
      const isConfirmedFirstParty = !!domain && isFirstPartySource(source.url, domain);

      if (source.userProvided) {
        // User explicitly provided this URL — trust them, fall through with original tier
      } else if (isConfirmedFirstParty) {
        const totalTextLength = source.facts.join(" ").length;
        const hasMinimumEvidence = source.facts.length >= 2 || totalTextLength >= 200;
        const companyToken = domain.split(".")[0].toLowerCase();
        const hasCompanyToken = companyToken.length >= 2 && source.facts.join(" ").toLowerCase().includes(companyToken);

        if (!hasMinimumEvidence || !hasCompanyToken) {
          return {
            ...source,
            tier: "C" as EvidenceTier,
            anchorScore,
            entity_hit_score: 0,
            entity_matched_term: null,
            entity_mismatch: false,
            tier_reason: "NO_QUOTEABLE_TEXT",
          };
        }
        // Falls through with original tier from classifySource
      } else {
        return {
          ...source,
          tier: "C" as EvidenceTier,
          anchorScore,
          entity_hit_score: 0,
          entity_matched_term: null,
          entity_mismatch: true,
          tier_reason: "ENTITY_MISMATCH",
        };
      }
    }

    // Promote company-owned pages with high anchor score + specificity from B to A
    // This allows homepage/swipefile pages with quantified claims to generate full hook sets
    const sourceHost = getDomain(source.url).toLowerCase();
    const isOnCompanyDomain = sourceHost === domain.toLowerCase() || sourceHost.endsWith("." + domain.toLowerCase());
    if (isOnCompanyDomain && anchorScore >= 5 && source.tier === "B" && computeSpecificityScore(source.facts) >= 3) {
      return { ...source, tier: "A" as EvidenceTier, anchorScore, entity_hit_score: entityMatch.entity_hit_score, entity_matched_term: entityMatch.entity_matched_term };
    }
    return { ...source, anchorScore, entity_hit_score: entityMatch.entity_hit_score, entity_matched_term: entityMatch.entity_matched_term };
  });

  // TIER A FIRST-PARTY/REPUTABLE GATE: Tier A requires first-party domain
  // or reputable publisher. Third-party non-reputable sources cap at Tier B.
  const tierEnforced = anchored.map((source) => {
    if (source.tier !== "A") return source;
    const firstParty = isFirstPartySource(source.url, domain);
    const reputable = isReputablePublisher(source.url);
    if (!firstParty && !reputable) {
      return { ...source, tier: "B" as EvidenceTier };
    }
    return source;
  });

  // Rank by score and take top 10
  const ranked = tierEnforced
    .sort((a, b) => scoreSource(b) - scoreSource(a))
    .slice(0, 10);

  // Count signal facts for gating (sources + high-confidence intent signals)
  const sourceSignalCount = countSignalFacts(ranked);
  const highConfidenceIntentCount = countHighConfidenceIntentSignals(intentSignals);
  const signalCount = sourceSignalCount + highConfidenceIntentCount;
  let hasAnchoredSources = ranked.some((s) => s.tier === "A");
  let tierACount = ranked.filter((s) => s.tier === "A").length;

  // RECOVERY PASS: when all prongs found zero Tier A sources, run targeted Exa queries
  // against the company domain using press/newsroom/changelog keywords.
  // Exa handles JS-heavy pages (gong.io/press, etc.) that direct fetching can't access.
  let recoveryDiagnostics: RecoveryDiagnostic[] = [];
  let newsExpansionDiagnostics: NewsExpansionDiagnostic[] = [];
  let finalRanked: ClassifiedSource[] = ranked;

  if (tierACount === 0 && domain && companyName) {
    const attempted = new Set(ranked.map((s) => s.url));
    const recovery = await runFirstPartyRecovery(domain, companyName, apiKey, attempted);

    if (recovery.sources.length > 0) {
      finalRanked = deduplicateSources([...recovery.sources, ...ranked])
        .sort((a, b) => scoreSource(b) - scoreSource(a))
        .slice(0, 10);
      tierACount = finalRanked.filter((s) => s.tier === "A").length;
      hasAnchoredSources = finalRanked.some((s) => s.tier === "A");
    }
    recoveryDiagnostics = recovery.diagnostics;
  }

  const hasTrustedNews = finalRanked.some((s) => isReputablePublisher(s.url));
  const shouldRunNewsExpansion =
    domain &&
    companyName &&
    (
      tierACount === 0 ||
      (!hasTrustedNews && finalRanked.length <= 3) ||
      (finalRanked.length > 0 && finalRanked.every((s) => s.stale))
    );

  if (shouldRunNewsExpansion) {
    const attempted = new Set(finalRanked.map((s) => s.url));
    const expansion = await runRecentNewsExpansion(domain, companyName, apiKey, attempted);

    if (expansion.sources.length > 0) {
      finalRanked = deduplicateSources([...expansion.sources, ...finalRanked])
        .sort((a, b) => scoreSource(b) - scoreSource(a))
        .slice(0, 10);
      tierACount = finalRanked.filter((s) => s.tier === "A").length;
      hasAnchoredSources = finalRanked.some((s) => s.tier === "A");
    }
    newsExpansionDiagnostics = expansion.diagnostics;
  }

  // INTENT SIGNAL FALLBACK: if Exa + recovery both returned no Tier A sources,
  // synthesize high-confidence intent signals as Tier A sources so Claude has
  // anchored evidence to write from. Intent signals have explicit sourceUrls
  // pointing to job postings, funding pages, etc. — they ARE company-specific.
  if (tierACount === 0 && intentSignals.length > 0) {
    const intentSources: ClassifiedSource[] = intentSignals
      .filter((s) => s.confidence >= 0.8 && s.summary)
      .map((s): ClassifiedSource => ({
        title: `${s.triggerType} signal — ${domain}`,
        publisher: s.sourceUrl ? getDomain(s.sourceUrl) : domain,
        date: "",
        url: s.sourceUrl || `https://${domain}`,
        facts: [s.summary],
        tier: "A" as EvidenceTier,
        anchorScore: 4,
        entity_hit_score: 2,
        entity_matched_term: domain,
      }));
    if (intentSources.length > 0) {
      finalRanked = deduplicateSources([...intentSources, ...finalRanked])
        .sort((a, b) => scoreSource(b) - scoreSource(a))
        .slice(0, 10);
      tierACount = finalRanked.filter((s) => s.tier === "A").length;
      hasAnchoredSources = finalRanked.some((s) => s.tier === "A");
      console.log("[fetchSourcesWithGating] intent signal fallback activated", {
        intentSourcesAdded: intentSources.length,
        tierACount,
      });
    }
  }

  // USER-PROVIDED SIGNAL: if the user explicitly gave a URL and it has content with
  // at least a partial entity match, bypass the lowSignal gate — user vouches for relevance.
  const userProvidedSource = finalRanked.find((s) => s.userProvided);
  const hasUserProvidedSignal =
    !!userProvidedSource &&
    (userProvidedSource.entity_hit_score ?? 0) >= 1 &&
    userProvidedSource.facts.length >= 2;

  const lowSignal = tierACount < 1 && !hasUserProvidedSignal;

  // If user provided a signal-rich URL, treat it as anchored so the route's
  // !hasAnchored gate doesn't truncate results to 1 hook and show the banner.
  if (hasUserProvidedSignal && !hasAnchoredSources) {
    hasAnchoredSources = true;
  }

  console.log(`[fetchSourcesWithGating] tierACount=${tierACount} hasUserProvidedSignal=${hasUserProvidedSignal} userProvided=${!!userProvidedSource} hasAnchoredSources=${hasAnchoredSources} url=${url}`);

  const _diagnostics: FetchSourcesResult["_diagnostics"] = {
    targetDomain: domain,
    prongSummary: {
      news: newsResults.length,
      web: webResults.length,
      company: companyResults.length,
      direct: directPageResults.length,
      crunchbase: crunchbaseResults.length,
      linkedin: linkedInResults.length,
    },
    tierBreakdown: finalRanked.map((s) => ({
      url: s.url,
      tier: s.tier,
      anchorScore: s.anchorScore,
      entityHitScore: s.entity_hit_score,
      tierReason: (s as any).tier_reason ?? null,
      isFirstParty: isFirstPartySource(s.url, domain),
      freshnessUnknown: (s as any)._freshnessUnknown ?? false,
    })),
    lowSignalReason: tierACount === 0 ? "zero_tier_a" : null,
    recoveryAttempted: recoveryDiagnostics.length > 0,
    recoveryResults: recoveryDiagnostics,
    newsExpansionAttempted: newsExpansionDiagnostics.length > 0,
    newsExpansionResults: newsExpansionDiagnostics,
  };

  console.log("[fetchSourcesWithGating] threshold check (with intent):", {
    sourceSignalCount,
    highConfidenceIntentCount,
    signalCountBeforeIntent: sourceSignalCount,
    signalCountAfterIntent: signalCount,
    thresholdMath: "lowSignal = tierACount < 1",
    tierACount,
    hasAnchoredSources,
    lowSignal,
    recoveryAttempted: recoveryDiagnostics.length > 0,
    intentSignals: intentSignals.map((s) => ({ triggerType: s.triggerType, confidence: s.confidence, tier: s.tier, sourceUrl: s.sourceUrl })),
    tierBreakdown: finalRanked.map((s) => ({ url: s.url, tier: s.tier, anchorScore: s.anchorScore })),
  });

  return {
    sources: finalRanked,
    signalCount,
    lowSignal,
    hasAnchoredSources,
    _diagnostics,
  };
}

// ---------------------------------------------------------------------------
// Search → company name resolution
// ---------------------------------------------------------------------------

type WebSearchResult = {
  title?: string;
  url?: string;
  description?: string;
  snippet?: string;
  meta_url?: { hostname?: string };
};

export function computeCompanyResolution(
  companyName: string,
  webResults: WebSearchResult[],
): CompanyResolutionResult {
  const normalizedName = companyName.trim();

  if (!normalizedName) {
    return {
      status: "no_match",
      companyName: "",
      candidates: [],
    };
  }

  const seenHostnames = new Set<string>();

  const candidates: CompanyCandidate[] = [];
  for (let index = 0; index < webResults.length; index++) {
    const r = webResults[index];
    const title = (r.title || "").trim();
    const description = (r.description || r.snippet || "").trim();
    const rawUrl = (r.url || "").trim();
    const hostname = r.meta_url?.hostname || (rawUrl ? (() => {
      try {
        return new URL(rawUrl).hostname;
      } catch {
        return "";
      }
    })() : "");

    if (!rawUrl || !hostname) continue;
    if (seenHostnames.has(hostname)) continue;
    seenHostnames.add(hostname);

    const nameFromTitle = title || hostname;

    candidates.push({
      id: `${index}-${hostname}`,
      name: nameFromTitle,
      url: rawUrl,
      description: description || undefined,
      source: hostname,
    });
  }

  if (candidates.length === 0) {
    return {
      status: "no_match",
      companyName: normalizedName,
      candidates: [],
    };
  }

  if (candidates.length === 1) {
    return {
      status: "ok",
      companyName: normalizedName,
      candidates,
    };
  }

  return {
    status: "needs_disambiguation",
    companyName: normalizedName,
    candidates,
  };
}

export async function resolveCompanyByName(
  companyName: string,
  apiKey: string,
): Promise<CompanyResolutionResult> {
  const normalizedName = companyName.trim();

  if (!normalizedName) {
    return {
      status: "no_match",
      companyName: "",
      candidates: [],
    };
  }

  const query = `${normalizedName} company official website`;

  const exaResults = await exaSearch(query, apiKey, {
    num_results: 8,
  });

  // Map Exa results to the shape computeCompanyResolution expects
  const webResults: { title?: string; url?: string; description?: string; snippet?: string; meta_url?: { hostname?: string } }[] =
    exaResults.map((r) => {
      let hostname = "";
      try {
        hostname = r.url ? new URL(r.url).hostname : "";
      } catch {}
      return {
        title: r.title,
        url: r.url,
        description: r.text,
        meta_url: { hostname },
      };
    });

  return computeCompanyResolution(normalizedName, webResults);
}

// ---------------------------------------------------------------------------
// Build the Claude prompt
// ---------------------------------------------------------------------------

function getPersonaSection(role: TargetRole): string {
  const data = PERSONA_DATA[role] || PERSONA_DATA["General"];
  const pressure = ROLE_PRESSURE_MAP[role] || ROLE_PRESSURE_MAP["General"];
  return [
    `${role}:`,
    "Role world (speak in this language, not generic business language):",
    `  - Priorities: ${pressure.priorities.join(", ")}`,
    `  - Operational pains: ${pressure.pains.join(", ")}`,
    `  - Metrics under pressure: ${pressure.metrics.join(", ")}`,
    `  - Natural language: ${pressure.language.join(", ")}`,
    "",
    "Pain points (use these to inform the BRIDGE — connect the signal to one of these):",
    ...data.pain_points.map(p => `  - ${p}`),
    "",
    "Bridge reasoning chains (follow the chain that fits the signal):",
    ...data.bridge_principles.map(p => `  - ${p}`),
    "",
    "Promise guidelines:",
    `  - Outcome themes: ${data.promise_guidelines.outcome_themes.join(", ")}`,
    `  - ${data.promise_guidelines.specificity_rule}`,
  ].join("\n");
}

const STYLE_BLOCKS: Record<Exclude<MessagingStyle, "evidence">, string> = {
  challenger: [
    "Messaging style: Challenger.",
    "BRIDGE must challenge an assumption the prospect is operating on — do not validate the trigger.",
    "QUESTION must be provocative and slightly uncomfortable.",
    "PROMISE must imply a consequence of inaction, not a product feature.",
    "First-person rule: Do NOT use we/our/us anywhere in the hook. All you/your framing.",
    "Preferred structural variants: direct-challenger, curiosity-gap.",
  ].join(" "),
  implication: [
    "Messaging style: Implication.",
    "BRIDGE must surface the downstream consequence of the trigger if nothing changes.",
    "QUESTION must make the cost of inaction concrete.",
    "PROMISE: You may reference 'we' in the final sentence if sender context is provided.",
    "Preferred structural variants: pain-forward, signal-mirror.",
  ].join(" "),
  risk: [
    "Messaging style: Risk.",
    "BRIDGE must frame what ignoring this signal costs the persona.",
    "QUESTION must ask what is stopping them from acting.",
    "First-person rule: Do NOT use we/our/us anywhere in the hook. All you/your framing.",
    "Preferred structural variants: direct-challenger, pain-forward.",
  ].join(" "),
};

const TONE_BLOCKS: Record<string, string> = {
  "Direct & Professional": [
    "TONE DIRECTIVES (Direct & Professional):",
    "- Terse, no-nonsense, data-driven. Peer-level confidence.",
    "- No pleasantries, no warm-ups, no 'hope this finds you well'. Get to the point in sentence one.",
    "- Short sentences. Numbers over adjectives. Let the signal speak.",
    "- DO: 'Your NPS dropped 12 points last quarter — is that a churn risk or a product-market fit issue?'",
    "- DO: 'You posted 14 SDR roles in 30 days. What happens if ramp time doubles before messaging is dialed in?'",
    "- DO NOT: 'Hey! I was really impressed by your growth...'",
    "- DO NOT: soften with qualifiers like 'just curious' or 'I was wondering if maybe'.",
    "- Contractions OK. Emoji never. One question max.",
  ].join("\n"),
  "Friendly & Casual": [
    "TONE DIRECTIVES (Friendly & Casual):",
    "- Warm, conversational, human. Like a smart colleague dropping a note — not a cold pitch.",
    "- Contractions always. Light humor OK if it lands naturally. Read like a real person wrote it.",
    "- Can open with a brief human acknowledgment (congrats, nice move) — but keep it to one clause, not flattery.",
    "- DO: 'Hey — saw your team just crossed 50 people, congrats! Quick question though: is your onboarding keeping up, or are new hires kind of figuring it out?'",
    "- DO: 'So you just shipped that enterprise tier — nice. Are outbound sequences already targeting the new ICP, or is the team still running last quarter\\'s playbook?'",
    "- DO NOT: sound robotic or overly formal ('I am writing to inquire...').",
    "- DO NOT: use corporate buzzwords (synergy, leverage, optimize). Talk like a person.",
  ].join("\n"),
  "Formal & Corporate": [
    "TONE DIRECTIVES (Formal & Corporate):",
    "- Polished, structured, boardroom-ready. Measured confidence, not aggressive.",
    "- No contractions. No slang. Full sentences. Professional register throughout.",
    "- The reader should feel they're being addressed by a credible industry peer, not a sales rep.",
    "- DO: 'Following your recent Series C announcement, a consideration worth raising: how quickly is your outbound infrastructure scaling to match headcount growth?'",
    "- DO: 'Your processing volume increased 40% last quarter. The question is whether fraud detection is scaling at the same rate, or whether that gap is becoming a liability.'",
    "- DO NOT: use casual openers ('Hey', 'So...', 'Quick question').",
    "- DO NOT: use exclamation marks or emoji. Measured tone throughout.",
  ].join("\n"),
  "Conversational": [
    "TONE DIRECTIVES (Conversational):",
    "- Natural, flowing, question-heavy. Reads like a DM, not an email template.",
    "- Think: how would you bring this up at a conference coffee line? That's the energy.",
    "- Contractions always. Sentence fragments OK. Can start sentences with 'So' or 'But'.",
    "- DO: 'So I noticed you\\'re hiring 8 SDRs — does your onboarding actually keep up with that pace, or do the first few months end up being expensive trial and error?'",
    "- DO: 'Saw the Salesforce partnership — that\\'s a big move. Honest question: is outbound already targeting the new buyer segment, or still running the old sequences?'",
    "- DO NOT: sound like a template. If it could be sent to 1000 people unchanged, rewrite it.",
    "- DO NOT: use formal structure (no 'Dear', no 'Regards', no full-paragraph intros).",
  ].join("\n"),
};

const DEFAULT_TONE_BLOCK = [
  "TONE DIRECTIVES:",
  "- Write like a smart colleague who noticed something interesting — not an SDR performing a pitch.",
  "- State the signal plainly. Draw the connection simply. Ask the question directly. That's it.",
  "- No dramatic em-dash bridges. No 'that kind of X means Y' constructions. Let the reader connect the dots.",
  "- Contractions are fine. Short sentences are better than long ones. Trust the reader.",
  "- Use their exact numbers and names. Specificity does the work — you don't need to explain why it matters.",
  "- A brief human acknowledgment (award, milestone) is OK if it feels natural. Not flattery — just human.",
  "- The goal is: recipient reads it and thinks 'hm, how did they know that's actually a problem for me', not 'wow that was a slick opener'.",
].join("\n");

const VALID_TENSION_PATTERNS: TensionPattern[] = [
  "direct-challenger",
  "curiosity-gap",
  "pain-forward",
  "signal-mirror",
  "hidden-cost",
  "scale-friction",
  "proof-to-problem",
];

function clampScore(value: number | undefined, fallback = 5): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(1, Math.min(10, Math.round(value)));
}

function normalizeBuyerTension(
  raw: ClaudeBuyerTensionPayload,
  sourceLookup: Map<number, ClassifiedSource>,
): BuyerTension | null {
  const newsItem = typeof raw.news_item === "number" ? raw.news_item : 1;
  const source = sourceLookup.get(newsItem);
  if (!source) return null;

  const angle = ((raw.angle || "trigger").toLowerCase() as Angle);
  if (!VALID_ANGLES.includes(angle)) return null;

  const buyerTension = (raw.buyer_tension || "").trim();
  if (buyerTension.length < 16) return null;

  const confidence = ((raw.confidence || "med").toLowerCase() as Confidence);
  const validConfidence = VALID_CONFIDENCES.includes(confidence) ? confidence : "med";

  const rawPattern = ((raw.pattern_family || "").trim() as TensionPattern);
  const patternFamily = VALID_TENSION_PATTERNS.includes(rawPattern) ? rawPattern : "curiosity-gap";

  const rawTriggerType = ((raw.trigger_type || "").toLowerCase().replace(/-/g, "_") as TriggerType);
  const triggerType = ([
    "award", "stat", "case_study", "hiring", "funding", "ipo", "expansion",
  ] as TriggerType[]).includes(rawTriggerType) ? rawTriggerType : undefined;

  const specificityTokens = Array.isArray(raw.specificity_tokens)
    ? raw.specificity_tokens.map((token) => String(token).trim()).filter(Boolean).slice(0, 6)
    : [];

  return {
    id: (raw.id || `tension-${newsItem}-${patternFamily}`).trim(),
    news_item: newsItem,
    source_title: (raw.source_title || source.title || "").trim(),
    source_date: (raw.source_date || source.date || "").trim(),
    source_url: (raw.source_url || source.url || "").trim(),
    evidence_tier: ((raw.evidence_tier || source.tier || "B").toUpperCase() as EvidenceTier) === "A" ? "A" : "B",
    evidence_snippet: (raw.evidence_snippet || source.facts[0] || "").trim(),
    trigger_type: triggerType,
    angle,
    buyer_tension: buyerTension,
    why_now: (raw.why_now || "").trim() || undefined,
    affected_metric: (raw.affected_metric || "").trim() || undefined,
    pattern_family: patternFamily,
    specificity_tokens: specificityTokens,
    confidence: validConfidence,
    richness_score: clampScore(raw.richness_score),
    specificity_score: clampScore(raw.specificity_score),
    interestingness_score: clampScore(raw.interestingness_score),
  };
}

function enforceTensionPatternCoverage(
  tensions: BuyerTension[],
  maxCount = 6,
): BuyerTension[] {
  if (tensions.length <= 1) return tensions.slice(0, maxCount);

  const sorted = [...tensions].sort((a, b) => {
    const aScore = a.richness_score + a.specificity_score + a.interestingness_score;
    const bScore = b.richness_score + b.specificity_score + b.interestingness_score;
    return bScore - aScore;
  });

  const chosen: BuyerTension[] = [];
  const seenPatterns = new Set<string>();
  const seenSources = new Set<string>();

  for (const tension of sorted) {
    if (chosen.length >= maxCount) break;
    if (!seenPatterns.has(tension.pattern_family)) {
      chosen.push(tension);
      seenPatterns.add(tension.pattern_family);
      seenSources.add(`${tension.news_item}:${tension.source_url}`);
    }
  }

  for (const tension of sorted) {
    if (chosen.length >= maxCount) break;
    const key = `${tension.news_item}:${tension.source_url}`;
    if (seenSources.has(key) && chosen.some((item) => item.pattern_family === tension.pattern_family)) continue;
    chosen.push(tension);
    seenSources.add(key);
  }

  return chosen;
}

export function buildInterpreterSystemPrompt(
  senderContext?: SenderContext | null,
  targetRole?: TargetRole | null,
): string {
  const activeRole = targetRole ?? "General";
  return [
    "You are the Signal Interpreter stage for outbound hook generation.",
    "Your job is to convert raw company sources into structured buyer tensions before any hook writing happens.",
    "Do not draft hooks. Do not write outreach copy. Only interpret evidence into tension objects.",
    "",
    `TARGET ROLE: ${activeRole}`,
    `PERSONA:\n${getPersonaSection(activeRole)}`,
    "",
    "For each usable source, identify the most credible internal tension that the target role would feel first.",
    "Prefer operational pressure over article summary.",
    "Every tension must stay grounded in the cited source facts and exact evidence snippet.",
    "Pattern coverage requirement: diversify pattern_family across the set when the evidence supports it.",
    "Score each object separately on richness, specificity, and interestingness from 1-10.",
    "Richness = how much real buyer pressure is present.",
    "Specificity = how anchored it is to concrete facts, metrics, names, or workflows.",
    "Interestingness = how non-obvious and conversation-worthy the tension is while staying credible.",
    "Allowed pattern_family values: direct-challenger, curiosity-gap, pain-forward, signal-mirror, hidden-cost, scale-friction, proof-to-problem.",
    "Allowed angles: trigger, risk, tradeoff.",
    "Return a JSON array only.",
    "",
    "JSON shape:",
    "[{",
    '  "id": "tension-1",',
    '  "news_item": 1,',
    '  "source_title": "string",',
    '  "source_date": "YYYY-MM-DD or empty",',
    '  "source_url": "https://...",',
    '  "evidence_tier": "A | B",',
    '  "evidence_snippet": "short verbatim quoteable evidence",',
    '  "trigger_type": "award | stat | case_study | hiring | funding | ipo | expansion",',
    '  "angle": "trigger | risk | tradeoff",',
    `  "buyer_tension": "internal pressure stated in the buyer's world",`,
    '  "why_now": "why this matters now",',
    '  "affected_metric": "metric or workflow under pressure",',
    '  "pattern_family": "one allowed value",',
    '  "specificity_tokens": ["exact number", "named workflow"],',
    '  "confidence": "high | med",',
    '  "richness_score": 1,',
    '  "specificity_score": 1,',
    '  "interestingness_score": 1',
    "}]",
    ...(senderContext?.buyerRoles?.length ? [
      "",
      `Sender context buyer roles: ${senderContext.buyerRoles.join(", ")}`,
    ] : []),
  ].join("\n");
}

export function buildInterpreterUserPrompt(
  url: string,
  sources: ClassifiedSource[],
  context?: string,
  intentSignals?: IntentSignalInput[],
): string {
  const basePrompt = buildUserPrompt(url, sources, context, intentSignals);
  return [
    basePrompt,
    "",
    "Interpret the sources into BuyerTension objects only.",
    "Do not write hooks yet.",
  ].join("\n");
}

export function buildComposerSystemPrompt(
  senderContext?: SenderContext | null,
  targetRole?: TargetRole | null,
  customPersona?: { pain: string; promise: string },
  messagingStyle: MessagingStyle = "evidence",
): string {
  return [
    buildSystemPrompt(senderContext, targetRole, customPersona, messagingStyle),
    "",
    "You are now in the Hook Composer stage.",
    "The BuyerTension objects below are the only approved interpretation layer. Compose hooks from them, not from raw source summaries.",
    "Each hook must cite one buyer_tension_id from the provided tension objects.",
    "Coverage requirement: vary structural_variant across the set when multiple high-quality tensions are available.",
    "Rank intent internally on credible + interesting, not just compliance.",
    "Use tension richness, specificity, and interestingness to decide which tensions deserve hooks.",
    'Add these JSON fields to every output object: "buyer_tension_id", "tension_richness_score", "specificity_score", "interestingness_score".',
    "Return a JSON array only.",
  ].join("\n");
}

export function buildComposerUserPrompt(
  url: string,
  tensions: BuyerTension[],
  context?: string,
  retrievalLibrary: RetrievedHookPattern[] = [],
): string {
  const tensionBlock = tensions.map((tension, index) => [
    `### Buyer Tension ${index + 1}`,
    `id: ${tension.id}`,
    `news_item: ${tension.news_item}`,
    `source_title: ${tension.source_title}`,
    tension.source_date ? `source_date: ${tension.source_date}` : "source_date: unknown",
    `source_url: ${tension.source_url}`,
    `evidence_tier: ${tension.evidence_tier}`,
    `angle: ${tension.angle}`,
    tension.trigger_type ? `trigger_type: ${tension.trigger_type}` : "",
    `pattern_family: ${tension.pattern_family}`,
    `buyer_tension: ${tension.buyer_tension}`,
    tension.why_now ? `why_now: ${tension.why_now}` : "",
    tension.affected_metric ? `affected_metric: ${tension.affected_metric}` : "",
    `specificity_tokens: ${tension.specificity_tokens.join(", ") || "none"}`,
    `scores: richness=${tension.richness_score}, specificity=${tension.specificity_score}, interestingness=${tension.interestingness_score}`,
    `evidence_snippet: ${tension.evidence_snippet}`,
  ].filter(Boolean).join("\n")).join("\n\n");

  return [
    `Prospect URL: ${url}`,
    "",
    "### Buyer Tensions",
    tensionBlock,
    ...(retrievalLibrary.length > 0
      ? [
          "",
          "### Reusable Winning Patterns",
          "Use these as bounded pattern references, not templates to copy.",
          "Reuse the archetype only when it fits the current BuyerTension. Do not repeat wording verbatim.",
          ...retrievalLibrary.map((pattern, index) => [
            `#### Pattern ${index + 1}`,
            `angle: ${pattern.angle}`,
            pattern.triggerType ? `trigger_type: ${pattern.triggerType}` : "",
            pattern.structuralVariant ? `structural_variant: ${pattern.structuralVariant}` : "",
            pattern.buyerTensionId ? `buyer_tension_id: ${pattern.buyerTensionId}` : "",
            pattern.targetRole ? `target_role: ${pattern.targetRole}` : "",
            `evidence_tier: ${pattern.evidenceTier}`,
            `outcome_score: ${pattern.outcomeScore}`,
            pattern.sourceTitle ? `source_title: ${pattern.sourceTitle}` : "",
            pattern.evidenceSnippet ? `evidence_snippet: ${pattern.evidenceSnippet}` : "",
            `pattern_example: ${pattern.hookText}`,
          ].filter(Boolean).join("\n")),
        ]
      : []),
    ...(context ? ["", "### Salesperson context", context] : []),
    "",
    "Write multiple hooks from these BuyerTension objects.",
    "Do not restate the source list. Do not invent new tensions.",
    "Spread coverage across different pattern families when credible.",
    "If you use a reusable winning pattern, adapt its structure to the current tension instead of copying phrasing.",
    "Output JSON array only.",
  ].join("\n");
}

export function buildSystemPrompt(senderContext?: SenderContext | null, targetRole?: TargetRole | null, customPersona?: { pain: string; promise: string }, messagingStyle: MessagingStyle = "evidence"): string {
  const activeRole = customPersona ? null : (targetRole ?? null);
  const personaSection = activeRole
    ? [`TARGET ROLE: ${activeRole}`, `PERSONA: ${activeRole}\n${getPersonaSection(activeRole)}`].join("\n\n")
    : `PERSONA: Custom\n- Bridge: Connect their external achievement to an internal sales team pain.\n- Promise: State a specific outcome you deliver for this role.`;

  const variantsSection = Object.entries(STRUCTURAL_VARIANTS)
    .map(([name, v]) => `  ${name}: ${v.description}\n    Structure: ${v.structure}\n    Best for: ${v.when}`)
    .join("\n");

  return [
    "You are generating a sales hook for an outbound SDR email.",
    "Your job is not to summarize an article. Your job is to turn a real company signal into buyer tension that sounds like a sharp SDR or operator noticed it.",
    "",
    personaSection,
    "",
    "CRITICAL RULE — READ BEFORE GENERATING:",
    "This email is written TO a person whose job title is the PERSONA above. Their challenges are defined in the PERSONA section above. Do NOT write about the prospect's product, their customers, or their industry operations. The trigger is CONTEXT ONLY. Write about their INTERNAL sales team challenges only.",
    "Never sound like an AI summarizing a source. Do not open with 'Saw', 'Noticed', 'Came across', 'Based on your recent article', or similar article-summary phrasing.",
    ...(activeRole === "VP Sales" ? [
      "For VP Sales specifically, avoid abstract executive filler like 'board scrutiny', 'that level of pressure', or 'pipeline gets dissected weekly' unless you immediately tie it to a concrete operating consequence such as forecast variance, commit risk, deal slippage, inspection cadence, or pipeline quality.",
      "Strong VP Sales hooks sound like lived forecast pressure, not investor-summary language.",
    ] : []),
    "",
    "---",
    "",
    "INTERNAL WORKFLOW (do this before writing):",
    "- Step 1: identify what changed.",
    "- Step 2: identify who inside the company feels pressure first.",
    "- Step 3: identify what gets harder now for the target role.",
    "- Step 4: identify the metric, workflow, or decision likely under pressure.",
    "- Step 5: write the hook from that tension, not from the article itself.",
    "",
    "---",
    "",
    "HOOK ELEMENTS (do NOT follow a rigid order — vary the structure):",
    "",
    "- TRIGGER: Reference something specific and real about the prospect's company (award, stat, case study, funding, expansion, hiring). Do NOT start with \"Saw\" or \"Noticed\" — vary your opener. Use their specific numbers, names, and facts.",
    "",
    "- BRIDGE: Connect the trigger to a pain the persona experiences. Follow the bridge reasoning chains in the PERSONA section — pick the chain that fits the signal. The bridge must feel like a natural consequence, not a leap. The bridge must share a domain with the trigger (operational → operational, growth → growth). Name the tension in the role's own world: forecast confidence, attribution leakage, coaching drag, handoff lag, growth complexity, etc.",
    "",
    "- QUESTION: One question that surfaces a real gap. Prefer forced-choice (A or B?) or mechanism questions over open-ended ones. Specific enough that a generic answer wouldn't work.",
    "",
    "- PROMISE: Close with a 1-sentence promise. See PROMISE GUIDELINES below for the exact formula.",
    "",
    "---",
    "",
    "STRUCTURAL VARIANTS — pick the best fit for each signal (return the variant name in your JSON):",
    variantsSection,
    "",
    "---",
    "",
    "BRIDGE QUALITY RULES:",
    "- Bridge must share a domain with the trigger (operational → operational, growth → growth)",
    "- If trigger is a product metric (e.g. ELD count, unit deployments), flag bridge_quality: weak and regenerate using a company-level signal instead",
    "- Never bridge a fleet/logistics metric directly to SDR team management without an explicit intermediate step",
    "- Hooks with bridge_quality: weak must be capped at score 79 and must not appear in position 1 or 2 of results",
    "- Prefer operational tension over article paraphrase. The reader should feel understood, not summarized.",
    "",
    "---",
    "",
    "PROMISE GUIDELINES:",
    "- Formula: [what we help/provide for this role, tied to the signal] + [specific outcome] + [soft peer-level CTA].",
    "- Preferred framing: start the promise with 'We help...', 'We can help...', or 'We provide...' when sender context exists.",
    "- Good example: 'We help SDR managers coach from live rep data instead of last week's call reviews — happy to show you what that looks like for Federato.'",
    "- If sender context has proof points: use one specific proof point. Don't invent stats.",
    "- If sender context has no proof: state the outcome claim from the 'Outcome' field in sender context, then add a soft CTA.",
    "- The promise should read like a standalone value proposition, not commentary about the market or stage of growth.",
    "- The promise must be tied to the specific signal in the hook — not a generic capability.",
    "- Position: use your judgment — either a separate sentence after the question, or woven naturally into/after it.",
    "- Never sound like a brochure. Peer-level confidence, not a sales pitch.",
    "- If NO sender context: use a generic pain-focused soft close only. Example: 'Happy to show you what that looks like at that scale.' Do NOT invent a product claim.",
    "- The promise sentence must appear inside the `hook` text. The `promise` JSON field is a separate extracted copy of that sentence — do not use it as a replacement.",
    ...(senderContext?.primaryOutcome ? [
      "",
      `- MANDATORY OUTCOME: The promise MUST drive toward this specific action: "${senderContext.primaryOutcome}".`,
      `- The soft CTA must lead the reader toward: "${senderContext.primaryOutcome}" — not a generic "let me know" or "happy to chat".`,
      "- Do NOT use a generic CTA when a specific outcome is configured. Every hook must align with this outcome.",
    ] : []),
    "",
    "---",
    "",
    (senderContext?.voiceTone && TONE_BLOCKS[senderContext.voiceTone]) || DEFAULT_TONE_BLOCK,
    "",
    "---",
    "",
    FEW_SHOT_EXAMPLES,
    "",
    "---",
    "",
    "DYNAMIC OUTPUT RULES:",
    "- Produce a mix of structures across the set. Do not make every hook sound like the same template.",
    "- At least some hooks should lead with the hidden cost, scaling friction, or contradiction created by the signal.",
    "- Compress aggressively. Strong hooks sound like a sharp observation, not a polished content paragraph.",
    "- Avoid generic openers, empty praise, and article-summary framing.",
    "",
    "---",
    "",
    "TRIGGER PRIORITY + SCORING GUIDANCE:",
    "- ipo: score 95+ (best personas: Founder/CEO, VP Sales, RevOps)",
    "- funding: score 90-94 (best personas: all)",
    "- expansion: score 80-89 (best personas: RevOps, SDR Manager, Marketing)",
    "- hiring (100+): score 80-85 (best personas: SDR Manager, VP Sales)",
    "",
    "CHARACTER LIMIT: 400 characters maximum. Write concisely.",
    "",
    "---",
    "",
    "OUTPUT FORMAT — always return JSON, never plain text:",
    "{",
    "  \"hook\": \"[full 2-3 sentence hook]\",",
    "  \"trigger\": \"[the specific thing referenced]\",",
    "  \"bridge_quality\": \"strong | moderate | weak\",",
    "  \"buyer_tension\": \"[the internal pressure this creates for the target role]\",",
    "  \"why_now\": \"[why this matters right now, in one short clause]\",",
    "  \"affected_metric\": \"[optional metric/workflow under pressure]\",",
    "  \"promise\": \"[evidence-backed outcome + soft CTA, 1 sentence, tied to the signal]\",",
    "  \"trigger_type\": \"award | stat | case_study | hiring | funding | ipo | expansion\",",
    "  \"structural_variant\": \"direct-challenger | curiosity-gap | pain-forward | signal-mirror | hidden-cost | scale-friction | proof-to-problem\"",
    "}",
    "",
    ...(messagingStyle !== "evidence" ? [
      "",
      STYLE_BLOCKS[messagingStyle],
    ] : []),
    ...(customPersona ? [
      "Custom persona inputs:",
      "- Pain: " + customPersona.pain,
      "- Promise: " + customPersona.promise,
    ] : []),
    ...(senderContext ? [
      "",
      "SENDER CONTEXT — MANDATORY (these are hard constraints, not suggestions):",
      "- Your outcome/CTA: " + senderContext.primaryOutcome + " ← every promise MUST drive toward this",
      "- Buyer roles: " + senderContext.buyerRoles.join(', '),
      ...(senderContext.voiceTone ? ["- Voice tone: " + senderContext.voiceTone + " ← follow the TONE DIRECTIVES above exactly"] : []),
      ...(senderContext.whatYouSell ? ["- What you sell: " + senderContext.whatYouSell + " ← reference naturally but never sound like a brochure"] : []),
      ...(senderContext.proof?.length ? ["- Proof points (use ONE specific proof point in the promise): " + senderContext.proof.join(" | ")] : []),
    ] : []),
  ].join("\n");
}

export function buildUserPrompt(
  url: string,
  sources: ClassifiedSource[],
  context?: string,
  intentSignals?: IntentSignalInput[],
): string {
  // Filter out Tier C sources before sending to Claude
  const usableSources = sources.filter((s) => s.tier !== "C");

  const sourcesBlock = usableSources
    .map(
      (s, i) => {
        const anchorLabel = (s.anchorScore ?? 0) >= 3 ? "COMPANY-ANCHORED" : "MARKET-CONTEXT";
        const vagueLabel = sourceHasConcreteEvidence(s.facts) ? "" : " [LOW-SIGNAL — SKIP]";
        return [
          `### Source ${i + 1}: ${s.title} [Tier ${s.tier}] [${anchorLabel}]${s.stale ? " [STALE]" : ""}${vagueLabel}`,
          `Publisher: ${s.publisher}`,
          s.date ? `Date: ${s.date}` : "Date: unknown",
          `URL: ${s.url}`,
          "Facts:",
          ...s.facts.map((f) => `- ${f}`),
        ]
          .filter(Boolean)
          .join("\n");
      },
    )
    .join("\n\n");

  const contextBlock = context
    ? `\n\n### Salesperson context\n${context}`
    : "";

  const signalsBlock =
    intentSignals && intentSignals.length > 0
      ? [
          "",
          "### Intent Signals",
          "Use these as additional hook triggers alongside the sources above. Each maps to the indicated trigger_type.",
          ...intentSignals.map(
            (s) =>
              `- [Tier ${s.tier}] [trigger_type: ${s.triggerType}] ${s.summary} (confidence: ${Math.round(s.confidence * 100)}%, source: ${s.sourceUrl})`,
          ),
        ].join("\n")
      : "";

  const allTierC = usableSources.length === 0;

  if (allTierC) {
    return [
      `Prospect URL: ${url}`,
      "",
      "### Sources",
      "No usable sources found. All sources were classified as Tier C (insufficient evidence).",
      "Return an empty JSON array: []",
      signalsBlock,
      contextBlock,
    ].join("\n");
  }

  return [
    `Prospect URL: ${url}`,
    "",
    "### Sources",
    sourcesBlock,
    signalsBlock,
    contextBlock,
    "",
    "Generate hooks now following the tier rules.",
    "Interpret each source into buyer tension first, then write the hook.",
    "Return a JSON array and nothing else.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Call Claude Messages API
// ---------------------------------------------------------------------------

async function callClaudeJson<T>(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model = "claude-sonnet-4-20250514",
  maxTokens = 4096,
): Promise<T[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content: { type: string; text: string }[];
  };

  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  // Strip markdown fences if Claude added them despite instructions
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Truncation recovery: try to find the last complete JSON object in the array
    // by finding the last "}]" or "}" and closing the array
    const lastCompleteObj = cleaned.lastIndexOf("}");
    if (lastCompleteObj > 0) {
      const truncated = cleaned.slice(0, lastCompleteObj + 1);
      // Ensure it ends as a valid array
      const asArray = truncated.endsWith("]") ? truncated : truncated + "]";
      try {
        parsed = JSON.parse(asArray);
      } catch {
        // Last resort: extract individual complete objects
        const objects: unknown[] = [];
        const objRegex = /\{[^{}]*\}/g;
        let match;
        while ((match = objRegex.exec(cleaned)) !== null) {
          try {
            objects.push(JSON.parse(match[0]));
          } catch {
            // skip malformed object
          }
        }
        parsed = objects.length > 0 ? objects : [];
      }
    } else {
      parsed = [];
    }
  }

  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === "object") {
      return [parsed as T];
    }
    throw new Error("Claude did not return valid JSON");
  }

  return parsed as T[];
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model = "claude-sonnet-4-20250514",
  maxTokens?: number,
): Promise<ClaudeHookPayload[]> {
  return callClaudeJson<ClaudeHookPayload>(systemPrompt, userPrompt, apiKey, model, maxTokens);
}

// ---------------------------------------------------------------------------
// Call Claude with retry (exponential backoff for transient errors)
// ---------------------------------------------------------------------------

export async function callClaudeJsonWithRetry<T>(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model = "claude-sonnet-4-20250514",
  maxTokens = 4096,
): Promise<T[]> {
  const RETRYABLE = [429, 500, 502, 503];
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await callClaudeJson<T>(systemPrompt, userPrompt, apiKey, model, maxTokens);
    } catch (err) {
      lastError = err;
      // Extract HTTP status from error message (format: "Anthropic API error <status>: ...")
      const statusMatch = (err as Error)?.message?.match(/Anthropic API error (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

      if (attempt < MAX_ATTEMPTS - 1 && status && RETRYABLE.includes(status)) {
        const delay = Math.pow(3, attempt) * 1000; // 1s, 3s, 9s
        console.warn(`[callClaudeWithRetry] Attempt ${attempt + 1} failed with status ${status}, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  // Should not reach here, but satisfy TypeScript
  throw lastError;
}

export async function callClaudeWithRetry(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model = "claude-sonnet-4-20250514",
  maxTokens?: number,
): Promise<ClaudeHookPayload[]> {
  return callClaudeJsonWithRetry<ClaudeHookPayload>(systemPrompt, userPrompt, apiKey, model, maxTokens);
}

function compactFactForClaude(fact: string): string {
  const compact = fact.replace(/\s+/g, " ").trim();
  if (compact.length <= MAX_CLAUDE_FACT_CHARS) return compact;
  return `${compact.slice(0, MAX_CLAUDE_FACT_CHARS - 1).trimEnd()}…`;
}

function compactSourcesForClaude(sources: ClassifiedSource[]): ClassifiedSource[] {
  return sources.slice(0, MAX_CLAUDE_SOURCES).map((source) => ({
    ...source,
    title: source.title.trim().slice(0, 140),
    facts: source.facts.slice(0, MAX_CLAUDE_FACTS_PER_SOURCE).map(compactFactForClaude),
  }));
}

function compactIntentSignalsForClaude(intentSignals?: IntentSignalInput[]): IntentSignalInput[] | undefined {
  if (!intentSignals || intentSignals.length === 0) return undefined;
  return intentSignals.slice(0, MAX_CLAUDE_INTENT_SIGNALS).map((signal) => ({
    ...signal,
    summary: compactFactForClaude(signal.summary),
    sourceUrl: signal.sourceUrl.slice(0, 160),
  }));
}

function compactContextForClaude(context?: string): string | undefined {
  const compact = context?.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.slice(0, MAX_CLAUDE_CONTEXT_CHARS);
}

export async function generateHookPayloadsFromSources(opts: {
  url: string;
  sources: ClassifiedSource[];
  apiKey: string;
  context?: string;
  senderContext?: SenderContext | null;
  targetRole?: TargetRole | null;
  customPersona?: { pain: string; promise: string };
  messagingStyle?: MessagingStyle;
  intentSignals?: IntentSignalInput[];
  model?: string;
  retrievalLibrary?: RetrievedHookPattern[];
}): Promise<{ tensions: BuyerTension[]; rawHooks: ClaudeHookPayload[] }> {
  const usableSources = opts.sources.filter((source) => source.tier !== "C");
  if (usableSources.length === 0) {
    return { tensions: [], rawHooks: [] };
  }

  const promptSources = compactSourcesForClaude(usableSources);
  const promptIntentSignals = compactIntentSignalsForClaude(opts.intentSignals);
  const promptContext = compactContextForClaude(opts.context);

  const sourceLookup = new Map<number, ClassifiedSource>();
  promptSources.forEach((source, index) => sourceLookup.set(index + 1, source));

  const interpreterSystemPrompt = buildInterpreterSystemPrompt(opts.senderContext, opts.targetRole);
  const interpreterUserPrompt = buildInterpreterUserPrompt(opts.url, promptSources, promptContext, promptIntentSignals);
  const rawTensions = await callClaudeJsonWithRetry<ClaudeBuyerTensionPayload>(
    interpreterSystemPrompt,
    interpreterUserPrompt,
    opts.apiKey,
    opts.model,
    INTERPRETER_MAX_TOKENS,
  );

  const normalizedTensions = rawTensions
    .map((tension) => normalizeBuyerTension(tension, sourceLookup))
    .filter((tension): tension is BuyerTension => tension !== null);

  const selectedTensions = enforceTensionPatternCoverage(normalizedTensions);
  if (selectedTensions.length === 0) {
    return { tensions: [], rawHooks: [] };
  }

  const composerSystemPrompt = buildComposerSystemPrompt(
    opts.senderContext,
    opts.targetRole,
    opts.customPersona,
    opts.messagingStyle ?? "evidence",
  );
  const composerUserPrompt = buildComposerUserPrompt(
    opts.url,
    selectedTensions,
    promptContext,
    (opts.retrievalLibrary ?? []).slice(0, 2),
  );
  const rawHooks = await callClaudeJsonWithRetry<ClaudeHookPayload>(
    composerSystemPrompt,
    composerUserPrompt,
    opts.apiKey,
    opts.model,
    COMPOSER_MAX_TOKENS,
  );

  return { tensions: selectedTensions, rawHooks };
}

export async function generateHookPayloadsFromTrustedSource(opts: {
  url: string;
  sources: ClassifiedSource[];
  apiKey: string;
  context?: string;
  senderContext?: SenderContext | null;
  targetRole?: TargetRole | null;
  customPersona?: { pain: string; promise: string };
  messagingStyle?: MessagingStyle;
  intentSignals?: IntentSignalInput[];
  model?: string;
}): Promise<ClaudeHookPayload[]> {
  const usableSources = opts.sources.filter((source) => source.tier !== "C");
  if (usableSources.length === 0) {
    return [];
  }

  const promptSources = compactSourcesForClaude(usableSources);
  const promptIntentSignals = compactIntentSignalsForClaude(opts.intentSignals);
  const promptContext = compactContextForClaude(opts.context);

  const systemPrompt = buildSystemPrompt(
    opts.senderContext,
    opts.targetRole,
    opts.customPersona,
    opts.messagingStyle ?? "evidence",
  );
  const baseUserPrompt = buildUserPrompt(opts.url, promptSources, promptContext, promptIntentSignals);
  const diversityInstructions = [
    "",
    "### Trusted Source Fast-Path Instructions",
    "Return exactly 4 hooks, even if one fact is especially strong.",
    "Each hook must feel materially different from the others.",
    "Vary the opening move across the set: one trigger-led, one operational risk-led, one tradeoff-led, and one coaching or enablement-led angle when evidence supports it.",
    "Do not reuse the same buyer tension phrasing, promise framing, or question structure across hooks.",
    "If two hooks sound similar, rewrite the weaker one until the set clearly offers different options.",
    "Keep every hook anchored to the submitted source and its facts.",
  ].join("\n");
  const userPrompt = `${baseUserPrompt}${diversityInstructions}`;

  return callClaudeWithRetry(
    systemPrompt,
    userPrompt,
    opts.apiKey,
    opts.model,
    TRUSTED_SOURCE_MAX_TOKENS,
  );
}

export function getProviderFacingErrorMessage(error: unknown): {
  message: string;
  code?: string;
  status?: number;
} {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const statusMatch = rawMessage.match(/Anthropic API error (\d+)/);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;

  if (status === 429 || /too many requests/i.test(rawMessage)) {
    const retryMatch = rawMessage.match(/try again in (\d+) seconds/i);
    const retryAfterSeconds = retryMatch ? Number(retryMatch[1]) : undefined;
    const retryAfterHours = retryAfterSeconds ? Math.max(1, Math.round(retryAfterSeconds / 3600)) : undefined;
    return {
      status: 429,
      code: "PROVIDER_RATE_LIMITED",
      message: retryAfterHours
        ? `Hook generation is temporarily paused because the AI provider hit its rate limit. Please try again in about ${retryAfterHours} hour${retryAfterHours === 1 ? "" : "s"}.`
        : "Hook generation is temporarily paused because the AI provider hit its rate limit. Please try again a bit later.",
    };
  }

  return {
    status,
    code: status ? "PROVIDER_ERROR" : undefined,
    message: "We hit a temporary AI generation issue. Please try again.",
  };
}

// ---------------------------------------------------------------------------
// Call Claude for freeform text (emails, etc.)
// ---------------------------------------------------------------------------

export async function callClaudeText(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  maxTokens = 1500,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content: { type: string; text: string }[];
  };

  return data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
}

function computeGenericnessPenalty(text: string): number {
  let penalty = 0;
  for (const pattern of GENERIC_AI_PATTERNS) {
    if (pattern.test(text)) penalty += 6;
  }
  for (const pattern of GENERIC_BRIDGE_PATTERNS) {
    if (pattern.test(text)) penalty += 8;
  }
  if (/\b(article|post|announcement|press release)\b/i.test(text)) penalty += 4;
  return Math.min(penalty, 24);
}

function computePromisePenalty(hook: Hook): number {
  const promise = hook.promise || "";
  if (!promise) return 0;

  let penalty = 0;
  for (const pattern of GENERIC_PROMISE_PATTERNS) {
    if (pattern.test(promise)) penalty += 8;
  }

  if (/\btypically\b/i.test(promise) && !/\d/.test(hook.evidence_snippet || "")) penalty += 6;
  if (/\b(pre-ipo|that scale|similar scale|this stage)\b/i.test(promise) && !/\b(board|forecast|commit|pipeline|deal)\b/i.test(hook.hook)) penalty += 4;
  if (!/^\s*(we help|we can help|we provide|i can help|i can provide|happy to show|happy to share)\b/i.test(promise)) penalty += 5;
  if (/\b(usually|often|tends to|typically)\b/i.test(promise) && !/^\s*(we help|we can help|we provide|i can help|i can provide)\b/i.test(promise)) penalty += 4;

  return Math.min(penalty, 20);
}

function scoreNovelty(text: string): number {
  let score = 0;
  if (/\b(before|instead of|versus|or just|or are you|or is it)\b/i.test(text)) score += 3;
  if (/\bpressure|drag|leakage|friction|blind spot|overhead|drift|constraint\b/i.test(text)) score += 4;
  if (/\bforecast|routing|handoff|ramp|attribution|coverage|velocity|payback\b/i.test(text)) score += 4;
  if (!GENERIC_AI_PATTERNS.some((pattern) => pattern.test(text))) score += 2;
  return Math.min(score, 10);
}

function scoreBuyerTension(text: string, hook: Partial<Hook>): number {
  let score = 0;
  if (hook.buyer_tension && hook.buyer_tension.length >= 18) score += 4;
  if (hook.affected_metric && hook.affected_metric.length >= 5) score += 2;
  if (hook.why_now && hook.why_now.length >= 8) score += 2;
  if (/\bpressure|risk|gap|drag|friction|leakage|constraint|bottleneck\b/i.test(text)) score += 4;
  return Math.min(score, 10);
}

// ---------------------------------------------------------------------------
// Quality gate — post-generation validation
// ---------------------------------------------------------------------------

export function containsBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_WORDS) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

/** Check that a hook contains at least one specificity token from evidence. */
export function hasSpecificityToken(hook: string): boolean {
  if (/\d+/.test(hook)) return true;
  if (/\bQ[1-4]\b/i.test(hook)) return true;
  if (/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(hook)) return true;
  if (/"[^"]{3,}"/.test(hook)) return true;

  const workflowTerms = [
    "lead routing", "identity resolution", "case deflection",
    "revenue recognition", "pipeline", "onboarding",
    "churn", "retention", "upsell", "cross-sell",
    "reconciliation", "compliance", "migration",
    "integration", "SSO", "API", "SDK", "webhook",
    "self-serve", "checkout", "billing",
  ];
  const lower = hook.toLowerCase();
  for (const term of workflowTerms) {
    if (lower.includes(term)) return true;
  }

  if (/(?:^.+?\s)[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/.test(hook)) return true;

  return false;
}

/**
 * Extract the verbatim quote from hook text (text inside double quotes).
 * Returns the quoted phrase or null if none found.
 */
function extractQuoteFromHook(hook: string): string | null {
  // Match text inside double quotes (straight or curly)
  const match = hook.match(/["\u201C]([^"\u201D]{5,})["\u201D]/);
  return match ? match[1] : null;
}

/**
 * Check if a quoted phrase actually appears (fuzzy) in the evidence snippet.
 * We lowercase both and check substring containment.
 */
function quoteExistsInEvidence(quote: string, evidenceSnippet: string): boolean {
  if (!quote || !evidenceSnippet) return false;
  const normQuote = quote.toLowerCase().replace(/\s+/g, " ").trim();
  const normEvidence = evidenceSnippet.toLowerCase().replace(/\s+/g, " ").trim();
  // Check if at least 80% of the quote words appear in sequence in the evidence
  if (normEvidence.includes(normQuote)) return true;
  // Fallback: check if most words from the quote appear in the evidence
  const quoteWords = normQuote.split(" ");
  const matchingWords = quoteWords.filter((w) => normEvidence.includes(w));
  return matchingWords.length >= Math.ceil(quoteWords.length * 0.8);
}

/**
 * Check if hook contains unsourced claims that aren't backed by evidence.
 * Returns the offending pattern if found without evidence backing, null otherwise.
 */
function containsUnsourcedClaim(hook: string, evidenceSnippet: string): boolean {
  const hookLower = hook.toLowerCase();
  const evidenceLower = (evidenceSnippet || "").toLowerCase();
  for (const pattern of UNSOURCED_CLAIM_PATTERNS) {
    if (pattern.test(hookLower) && !pattern.test(evidenceLower)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if hook uses change/transition verbs without evidence containing a
 * matching time marker or explicit change statement.
 */
function containsUnsupportedChangeVerb(hook: string, evidenceSnippet: string): boolean {
  const hookLower = hook.toLowerCase();
  const evidenceLower = (evidenceSnippet || "").toLowerCase();
  const hasChangeVerb = CHANGE_VERB_PATTERNS.some((p) => p.test(hookLower));
  if (!hasChangeVerb) return false;
  // Evidence must contain at least one time/change cue to justify the verb
  return !CHANGE_TIME_CUES.some((p) => p.test(evidenceLower));
}

/**
 * Attempt to rewrite change verbs to present-tense / observation form.
 * Returns the rewritten hook text, or null if rewrite still implies change.
 */
const CHANGE_VERB_REWRITES: Array<[RegExp, string]> = [
  [/\bYou switched to\b/gi, "You use"],
  [/\bYou revamped\b/gi, "You offer"],
  [/\bYou redesigned\b/gi, "You have"],
  [/\bYou recently changed to\b/gi, "You offer"],
  [/\bYou recently changed\b/gi, "You have"],
  [/\bNow charging\b/gi, "You charge"],
  [/\bNow offering\b/gi, "You offer"],
  [/\bNow using\b/gi, "You use"],
  [/\bNow doing\b/gi, "You do"],
  [/\bNow running\b/gi, "You run"],
  [/\bNow building\b/gi, "You build"],
  [/\bNow selling\b/gi, "You sell"],
  [/\bHiring across\b/gi, "Growing across"],
  [/\bYou moved to\b/gi, "You use"],
  [/\bJust launched\b/gi, "You offer"],
  [/\bJust started\b/gi, "You"],
  [/\bJust added\b/gi, "You offer"],
  [/\bRecently launched\b/gi, "You offer"],
  [/\bRecently started\b/gi, "You"],
  [/\bRecently added\b/gi, "You offer"],
  [/\bRecently introduced\b/gi, "You offer"],
  [/\bRecently adopted\b/gi, "You use"],
  [/\bRecently moved\b/gi, "You use"],
  [/\bRecently shifted\b/gi, "You focus on"],
  [/\bRecently pivoted\b/gi, "You focus on"],
  [/\bStarted using\b/gi, "You use"],
  [/\bStarted offering\b/gi, "You offer"],
  [/\bStarted doing\b/gi, "You do"],
  [/\bStarted building\b/gi, "You build"],
  [/\bShifted to\b/gi, "You focus on"],
  [/\bShifted from\b/gi, "You moved from"],
  [/\bPivoted to\b/gi, "You focus on"],
  [/\bPivoted from\b/gi, "You moved from"],
  [/\bAdopted\b/gi, "You use"],
  [/\bTransitioned to\b/gi, "You use"],
  [/\bTransitioned from\b/gi, "You moved from"],
];

export function rewriteChangeVerbs(hook: string): string | null {
  let text = hook;
  let changed = false;
  for (const [pattern, replacement] of CHANGE_VERB_REWRITES) {
    const before = text;
    text = text.replace(pattern, replacement);
    if (text !== before) changed = true;
  }
  if (!changed) return null;
  // Verify rewrite removed all change verbs
  if (CHANGE_VERB_PATTERNS.some((p) => p.test(text))) return null;
  return text;
}

/**
 * Reject hooks with vague, philosophical, or open-ended questions.
 * Returns true if the question is low-quality (should be rejected).
 */
function hasVagueQuestion(hook: string): boolean {
  return VAGUE_QUESTION_PATTERNS.some((p) => p.test(hook));
}

/**
 * Positive question structure validator: hook must end with a forced-choice,
 * mechanism, ownership, or timing question containing "or" or "vs".
 * Returns true if the question structure is valid.
 */
export function hasValidQuestionStructure(hook: string): boolean {
  // Extract the sentence containing the question mark
  const questionMatch = hook.match(/[^.!]*\?/);
  const questionPart = questionMatch ? questionMatch[0] : hook;
  // Forced choice / mechanism / ownership: contains "or"
  if (/\bor\b/i.test(questionPart)) return true;
  // Comparison: contains "vs"
  if (/\bvs\.?\b/i.test(questionPart)) return true;
  return false;
}

/**
 * Reject hooks that use first-person framing (we/our/us/I).
 * Hooks should always center the prospect with second-person framing.
 */
function hasFirstPersonFraming(hook: string, messagingStyle: MessagingStyle = "evidence"): boolean {
  // Remove quoted sections first to avoid false positives on evidence quotes
  const withoutQuotes = hook.replace(/[""\u201C][^""\u201D]*[""\u201D]/g, "");

  // Challenger and Risk: ban ALL first-person
  if (messagingStyle === "challenger" || messagingStyle === "risk") {
    return /\bwe\b|\bwe'(re|ve|ll)\b|\bour\b|\bours\b|\bus\b|(?:^|\.\s+)I\s/i.test(withoutQuotes);
  }

  // Evidence and Implication: allow "we" in final sentence only
  const sentences = withoutQuotes.split(/(?<=[.!?])\s+/);
  const nonFinalSentences = sentences.slice(0, -1).join(" ");
  return /\bwe\b|\bwe'(re|ve|ll)\b|\bour\b|\bours\b|\bus\b|(?:^|\.\s+)I\s/i.test(nonFinalSentences);
}

/**
 * Patterns that imply company-specific pain but are only valid when evidence
 * is actually about the target company (not a generic market stat).
 */
const MARKET_STAT_MISFRAMING_PATTERNS = [
  /\b(saw|noticed|see)\s+(your|you're)\s+(team|reps?|SDRs?|BDRs?|AEs?)\b/i,
  /\byour\s+team\s+(is|are|has|have|deal|spend|struggle|report)\b/i,
  /\byou're\s+(dealing|struggling|spending|losing|facing|seeing)\b/i,
  /\byour\s+(bottleneck|challenge|problem|issue|pain)\b/i,
  /\byour\s+(reps?|SDRs?|BDRs?|AEs?)\s+(are|spend|lose|waste|report)\b/i,
];

/**
 * Detect if evidence is a generic market stat (not company-specific).
 * Market stats use phrases like "teams report", "sales professionals", "on average" etc.
 */
const MARKET_STAT_EVIDENCE_PATTERNS = [
  /\b(teams|professionals|reps|SDRs|BDRs|AEs|sellers|salespeople|organizations)\s+(report|spend|say|cite|find|average|typically)\b/i,
  /\bon average\b/i,
  /\b(industry|market|benchmark|survey|study|research)\s+(data|shows?|finds?|reports?|indicates?)\b/i,
  /\baccording to\s+(a\s+)?(study|survey|report|research)\b/i,
  /\b\d+%\s+of\s+(teams|reps|companies|organizations|sales)\b/i,
];

/**
 * Returns true if a hook misframes a market stat as company-specific pain.
 * E.g., evidence says "Sales pros report spending 3-5 min" but hook says
 * "Saw your team dealing with...". This violates no-assumptions.
 */
export function hasMarketStatMisframing(
  hookText: string,
  evidenceSnippet: string,
  source?: ClassifiedSource,
): boolean {
  // Check if the hook uses company-specific framing
  const usesCompanyFraming = MARKET_STAT_MISFRAMING_PATTERNS.some((p) => p.test(hookText));
  if (!usesCompanyFraming) return false;

  // If the source is first-party (company's own site), company-specific framing is OK
  if (source && source.anchorScore !== undefined && source.anchorScore >= 6) return false;

  // Check if evidence is a market stat (generic, not company-specific)
  const isMarketStat = MARKET_STAT_EVIDENCE_PATTERNS.some((p) => p.test(evidenceSnippet));
  if (isMarketStat) return true; // Market stat + company framing = misframing

  return false;
}

/**
 * Check whether a source has concrete, quoteable evidence.
 * Returns true if facts contain at least one of: a number, a named tool/integration,
 * a named customer/partner, or a concrete feature/offer term.
 * Sources that fail this check are Low Signal and should not produce hooks.
 */
function sourceHasConcreteEvidence(facts: string[]): boolean {
  const joined = facts.join(" ");
  // Number (quantified claim)
  if (/\d/.test(joined)) return true;
  // Named tool/integration/product
  if (/\b(Salesforce|HubSpot|Slack|Zapier|Gong|Outreach|Marketo|Pardot|Segment|Snowflake|Stripe|Shopify|Zendesk|Intercom|Drift|LinkedIn|Gmail|Outlook|API|SDK|webhook|CRM|ERP)\b/i.test(joined)) return true;
  // Named customer/partner (capitalized proper nouns following "with" or "for" or standalone)
  if (/\b(partnered with|working with|trusted by|used by|chosen by|powering|for companies like)\b/i.test(joined)) return true;
  // Concrete feature/offer term (pricing, deliverability, specific product terms)
  if (/\$[\d,.]+|\d+\s*\/\s*(mo|month|reply|lead|email)|\bfree\s+tier\b|\bpricing\b/i.test(joined)) return true;
  if (/\b(deliverability|personalization|warmup|throttling|list hygiene|unique emails?|cold email)\b/i.test(joined)) return true;
  return false;
}

/**
 * Assess bridge quality by checking domain overlap between the bridge portion
 * and the evidence. Looks for shared terms (company name, product terms, role keywords).
 */
function assessBridgeQuality(hookText: string, evidenceSnippet: string): "strong" | "moderate" | "weak" {
  // Extract bridge: text between the closing quote mark and the question mark
  const quoteEnd = hookText.search(/["\u201D]\s*—?\s*/);
  const questionStart = hookText.lastIndexOf("?");
  if (quoteEnd === -1 || questionStart === -1 || quoteEnd >= questionStart) return "weak";

  const bridge = hookText.slice(quoteEnd + 1, questionStart).toLowerCase();
  const evidenceLower = evidenceSnippet.toLowerCase();

  // Extract meaningful terms (3+ char words, excluding stop words)
  const stopWords = new Set(["the", "and", "for", "are", "but", "not", "you", "your", "all", "can", "had", "her", "was", "one", "our", "out", "has", "his", "how", "its", "may", "new", "now", "old", "see", "way", "who", "did", "get", "let", "say", "she", "too", "use", "with", "from", "this", "that", "what", "when", "will", "than", "been", "have", "into", "each", "make", "like", "over", "such", "take", "them", "then", "they", "some", "more", "most", "only", "very", "just", "about", "being", "could", "other", "their", "there", "these", "which", "would", "after", "first", "where"]);

  const bridgeTerms = bridge.match(/\b[a-z]{3,}\b/g)?.filter(w => !stopWords.has(w)) || [];
  const evidenceTerms = new Set(evidenceLower.match(/\b[a-z]{3,}\b/g)?.filter(w => !stopWords.has(w)) || []);

  let overlap = 0;
  for (const term of bridgeTerms) {
    if (evidenceTerms.has(term)) overlap++;
  }

  if (overlap >= 2) return "strong";
  if (overlap >= 1) return "moderate";
  return "weak";
}

export function validateHook(
  raw: ClaudeHookPayload,
  sourceLookup?: Map<number, ClassifiedSource>,
  messagingStyle?: MessagingStyle,
): Hook | null {
  const angle = (raw.angle || "trigger").toLowerCase() as Angle;
  if (!VALID_ANGLES.includes(angle)) return null;

  const confidence = (raw.confidence || "med").toLowerCase() as Confidence;
  if (!VALID_CONFIDENCES.includes(confidence)) return null;

  let hook = (raw.hook || "").trim();
  if (hook.length === 0 || hook.length > MAX_HOOK_CHARS) return null;
  // Hook must contain a question (but may end with a promise statement)
  if (!hook.includes("?")) return null;
  if (containsBannedPhrase(hook) !== null) return null;
  if (!hasSpecificityToken(hook)) return null;

  const tier = (raw.evidence_tier || "").toUpperCase() as EvidenceTier;
  const validTier = tier === "A" || tier === "B" ? tier : (
    sourceLookup?.get(raw.news_item)?.tier ?? "B"
  );

  // Question quality: reject vague/philosophical/open-ended questions
  if (hasVagueQuestion(hook)) return null;

  // Invented causality ban: reject hooks with ungrounded causal claims
  if (INVENTED_CAUSALITY_PATTERNS.some((p) => p.test(hook))) return null;

  // Question framing bans: reject consultant-speak question patterns.
  // Keep strict for Tier B, but be more permissive for Tier A where first-party
  // evidence can still justify otherwise solid hooks.
  const questionMatch = hook.match(/[^.!]*\?/);
  const questionPart = questionMatch ? questionMatch[0] : hook;
  if (QUESTION_FRAMING_BANS.some((p) => p.test(questionPart)) && validTier === "B") return null;

  // Abstract noun overload: keep strict for secondary evidence, relax slightly for Tier A.
  const abstractCount = ABSTRACT_NOUNS.filter((noun) =>
    new RegExp(`\\b${noun}\\b`, "i").test(questionPart)
  ).length;
  if ((validTier === "B" && abstractCount >= 3) || (validTier === "A" && abstractCount >= 4)) return null;

  // Positive question structure: Tier B requires forced-choice/mechanism framing,
  // Tier A can pass with a concrete direct question.
  if (!hasValidQuestionStructure(hook)) {
    const wordsInQuestion = questionPart.trim().split(/\s+/).filter(Boolean).length;
    const hasConcreteQuestion = /\b(how|what|which|where|when|who)\b/i.test(questionPart) && wordsInQuestion >= 6;
    if (validTier === "B" || !hasConcreteQuestion) return null;
  }

  // You-first framing: reject hooks that use first-person (we/our/us/I)
  if (hasFirstPersonFraming(hook, messagingStyle)) return null;

  // Market-stat framing: reject "your team" / "you're dealing with" unless evidence
  // is company-specific (contains the company name or is from a first-party source).
  // Market-stat evidence (e.g. "Sales pros report spending 3-5 min...") must use
  // neutral framing ("Teams report..." not "Saw your team dealing with...").
  if (hasMarketStatMisframing(hook, raw.evidence_snippet || "", sourceLookup?.get(raw.news_item))) {
    return null;
  }

  // Tier B: ONLY trigger angle allowed, no risk/tradeoff
  if (validTier === "B" && angle !== "trigger") return null;

  // Tradeoff grounding gate: reject ungrounded strategy forks
  if (angle === "tradeoff" && !isTradeoffGrounded(hook, (raw.evidence_snippet || "").trim())) {
    return null; // Ungrounded tradeoff → drop (caller can regenerate as trigger/risk)
  }

  // Tier B: reject launch/announce language — secondary sources can't confirm launches
  if (validTier === "B") {
    const tierBBannedPatterns = [
      /\blaunched?\b/i,
      /\bannounced?\b/i,
      /\bunveiled?\b/i,
      /\brolled?\s*out\b/i,
      /\bintroduced?\b/i,
      /\breleased?\b/i,
      /\bsaw\s+(the\s+)?(news|launch|announcement)\b/i,
    ];
    if (tierBBannedPatterns.some((p) => p.test(hook))) return null;
  }

  // Date discipline: reject vague date phrases unless they appear in the source evidence
  const evidenceSnippetForDate = (raw.evidence_snippet || "").trim();
  for (const pattern of VAGUE_DATE_PATTERNS) {
    const match = hook.match(pattern);
    if (match && !evidenceSnippetForDate.toLowerCase().includes(match[0].toLowerCase())) {
      return null; // Vague date not in source → reject
    }
  }

  const evidenceSnippet = (raw.evidence_snippet || "").trim();

  // Quote grounding: keep quote checks strict when quotes are present.
  // Relax hard requirement for Tier A so strong first-party hooks without direct
  // quotation marks can still survive when evidence alignment is strong enough.
  const quote = extractQuoteFromHook(hook);
  if (quote) {
    if (!quoteExistsInEvidence(quote, evidenceSnippet)) return null;
  } else if (validTier === "B") {
    return null;
  } else {
    const bridgeStrength = assessBridgeQuality(hook, evidenceSnippet);
    if (bridgeStrength === "weak") {
      const hookTerms = new Set((hook.toLowerCase().match(/[a-z]{5,}/g) || []).filter((t) => !["which", "their", "there", "where", "would", "could", "should", "during"].includes(t)));
      const evidenceTerms = new Set(evidenceSnippet.toLowerCase().match(/[a-z]{5,}/g) || []);
      const overlap = [...hookTerms].filter((t) => evidenceTerms.has(t)).length;
      if (overlap < 1) return null;
    }
  }

  // No fake stats: numbers outside the verbatim quote must appear in evidence
  // (numbers inside the quote are already validated by quoteExistsInEvidence)
  // Exempt 4-digit years (2020–2029) and month abbreviations with years — these are date references, not stats.
  const hookWithoutQuote = hook.replace(/["\u201C][^"\u201D]*["\u201D]/g, "");
  const outsideNumbers = hookWithoutQuote.match(/\d[\d,.]*%?/g) || [];
  for (const num of outsideNumbers) {
    // Skip year references (e.g. "2026", "2025") — these are dates, not fabricated stats
    if (/^20[2-3]\d$/.test(num)) continue;
    if (!evidenceSnippet.includes(num)) return null;
  }

  // Reject hooks with unsourced claims (redesign, hiring, stats not in evidence)
  if (containsUnsourcedClaim(hook, evidenceSnippet)) return null;

  // Change verbs without evidence: attempt rewrite to present tense, then drop if still fails
  if (containsUnsupportedChangeVerb(hook, evidenceSnippet)) {
    const rewritten = rewriteChangeVerbs(hook);
    if (!rewritten) return null; // Can't rewrite → drop
    hook = rewritten;
    // Belt-and-suspenders: verify rewrite is clean
    if (containsUnsupportedChangeVerb(hook, evidenceSnippet)) return null;
    // Re-validate length after rewrite
    if (hook.length > MAX_HOOK_CHARS) return null;
  }

  // Reject hooks whose source lacks concrete evidence (number, named tool, feature term)
  if (sourceLookup) {
    const source = sourceLookup.get(raw.news_item);
    if (source) {
      if (!sourceHasConcreteEvidence(source.facts)) return null;
      // Tier B sources without a concrete anchor → Low Signal, skip
      if (validTier === "B" && computeSpecificityScore(source.facts) < 2) return null;
    }
  }

  // Validate and normalize psych_mode (optional — gracefully handle missing/invalid)
  const rawMode = (raw.psych_mode || "").toLowerCase().replace(/-/g, "_") as PsychMode;
  const psychMode = VALID_PSYCH_MODES.includes(rawMode) ? rawMode : undefined;

  // Normalize trigger_type (optional — graceful degradation)
  const VALID_TRIGGER_TYPES: TriggerType[] = ["award", "stat", "case_study", "hiring", "funding", "ipo", "expansion"];
  const rawTriggerType = ((raw as any).trigger_type || "").toLowerCase().replace(/-/g, "_") as TriggerType;
  const triggerType = VALID_TRIGGER_TYPES.includes(rawTriggerType) ? rawTriggerType : undefined;

  // Normalize promise — required. If the JSON field is missing, attempt to extract
  // the last sentence of the hook text. If the last sentence ends with "?" the
  // 4-part structure is incomplete (promise was never written) → reject the hook.
  const rawPromise = ((raw as any).promise || "").trim();
  let promise: string | undefined = rawPromise.length > 0 ? rawPromise : undefined;
  if (!promise) {
    // Split on sentence boundaries, take last non-empty chunk
    const sentences = hook.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    const lastSentence = sentences[sentences.length - 1] ?? "";
    if (lastSentence.endsWith("?")) {
      // Hook ends on a question — promise is missing, reject
      return null;
    }
    promise = lastSentence.length > 0 ? lastSentence : undefined;
  }
  if (!promise) return null;

  // Normalize structural_variant (optional)
  const structuralVariant: string | undefined = ((raw as any).structural_variant || "").trim() || undefined;
  const buyerTension = ((raw as any).buyer_tension || "").trim() || undefined;
  const whyNow = ((raw as any).why_now || "").trim() || undefined;
  const affectedMetric = ((raw as any).affected_metric || "").trim() || undefined;

  // Assess bridge quality (prefer model-provided value when valid)
  const rawBridgeQuality = ((raw as any).bridge_quality || "").toLowerCase();
  const bridgeQuality = rawBridgeQuality === "strong" || rawBridgeQuality === "moderate" || rawBridgeQuality === "weak"
    ? rawBridgeQuality as "strong" | "moderate" | "weak"
    : assessBridgeQuality(hook, evidenceSnippet);

  // Downgrade weak-bridge high-confidence hooks to "med"
  let finalConfidence = confidence;
  if (bridgeQuality === "weak" && confidence === "high") {
    finalConfidence = "med";
  }

  // Mode E (contrarian) gate: require company-anchored + recent source
  if (psychMode === "contrarian" && sourceLookup) {
    const source = sourceLookup.get(raw.news_item);
    if (source) {
      const isAnchored = (source.anchorScore ?? 0) >= 3;
      const isRecent = source.date && !source.stale;
      if (!isAnchored || !isRecent) return null;
    }
  }

  const genericnessPenalty = computeGenericnessPenalty(hook);
  const noveltyScore = scoreNovelty(hook);
  const buyerTensionScore = scoreBuyerTension(hook, {
    buyer_tension: buyerTension,
    why_now: whyNow,
    affected_metric: affectedMetric,
  });
  const specificityScore = clampScore(
    typeof (raw as any).specificity_score === "number"
      ? (raw as any).specificity_score
      : (/\d/.test(`${hook} ${evidenceSnippet}`) ? 7 : 5),
    5,
  );
  const interestingnessScore = clampScore(
    typeof (raw as any).interestingness_score === "number"
      ? (raw as any).interestingness_score
      : noveltyScore,
    noveltyScore || 5,
  );
  const tensionRichnessScore = clampScore(
    typeof (raw as any).tension_richness_score === "number"
      ? (raw as any).tension_richness_score
      : buyerTensionScore,
    buyerTensionScore || 5,
  );

  return {
    news_item: typeof raw.news_item === "number" ? raw.news_item : 1,
    angle,
    hook,
    evidence_snippet: evidenceSnippet,
    source_title: (raw.source_title || "").trim(),
    source_date: (raw.source_date || "").trim(),
    source_url: (raw.source_url || "").trim(),
    evidence_tier: validTier,
    confidence: finalConfidence,
    psych_mode: psychMode,
    why_this_works: (raw.why_this_works || "").trim() || undefined,
    trigger_type: triggerType,
    promise: promise || undefined,
    bridge_quality: bridgeQuality,
    structural_variant: structuralVariant,
    buyer_tension: buyerTension,
    why_now: whyNow,
    affected_metric: affectedMetric,
    genericness_penalty: genericnessPenalty,
    novelty_score: noveltyScore,
    buyer_tension_score: buyerTensionScore,
    specificity_score: specificityScore,
    interestingness_score: interestingnessScore,
    tension_richness_score: tensionRichnessScore,
    buyer_tension_id: ((raw as any).buyer_tension_id || "").trim() || undefined,
  };
}

// ---------------------------------------------------------------------------
// PUBLISH GATE — single enforcement layer before hooks are shown/returned
// ---------------------------------------------------------------------------

export type PublishGateOptions = {
  /** If true, allow max 1 unanchored source labeled "Market context". Default: false */
  includeMarketContext?: boolean;
};

/**
 * Publish Gate: validate → rewrite once → drop/backfill.
 * This is the ONLY function that should be used to produce user-facing hooks.
 * It enforces:
 *   1. Anchored source check (exclude unanchored when market context off)
 *   2. Verbatim quote requirement (5–12 word span in evidence)
 *   3. Change verb rewrite-or-drop
 *   4. Forced-choice question structure
 *   5. Tier B cap (max 1 total) + concrete anchor requirement
 *   6. All other validateHook rules (banned phrases, first-person, fake stats, etc.)
 */
export function publishGate(
  rawHooks: ClaudeHookPayload[],
  sourceLookup: Map<number, ClassifiedSource>,
  options?: PublishGateOptions,
  messagingStyle?: MessagingStyle,
): Hook[] {
  const includeMarketContext = options?.includeMarketContext ?? false;

  // Step 1: Filter source lookup to exclude unanchored when market context off.
  // Tier A sources (first-party / reputable publisher) always pass regardless of anchorScore —
  // they're anchored by classification. The anchorScore filter is only for Tier B/C market commentary.
  const filteredLookup = new Map<number, ClassifiedSource>();
  for (const [idx, source] of sourceLookup) {
    const anchored = source.tier === "A" || !!source.userProvided || (source.anchorScore ?? 0) >= 3;
    if (!anchored && !includeMarketContext) continue;
    filteredLookup.set(idx, source);
  }

  console.log(`[publishGate] filteredLookupCount=${filteredLookup.size} gatedCount=${rawHooks.length}`);

  // Fallback key: first source in filteredLookup (used when Claude omits news_item)
  const firstFilteredKey = filteredLookup.keys().next().value ?? 1;

  const diagnostics: Array<{ idx: number; news_item: number; status: string; tier?: string; anchorScore?: number }> = [];

  // Step 2: Validate each hook through full pipeline (includes rewrite-or-drop)
  const validHooks: Hook[] = [];
  for (const [idx, raw] of rawHooks.entries()) {
    // Reject hooks from sources that were filtered out.
    // If Claude omitted news_item, fall back to the first available filtered source.
    const newsItem = raw.news_item && filteredLookup.has(raw.news_item) ? raw.news_item : firstFilteredKey;
    const rawWithItem = { ...raw, news_item: newsItem };
    if (!filteredLookup.has(newsItem)) {
      diagnostics.push({ idx, news_item: newsItem, status: "drop:source_filtered_out" });
      continue;
    }
    const validated = validateHook(rawWithItem, filteredLookup, messagingStyle);
    if (validated) {
      diagnostics.push({ idx, news_item: newsItem, status: "pass:validateHook", tier: validated.evidence_tier, anchorScore: filteredLookup.get(newsItem)?.anchorScore });
      validHooks.push(validated);
    } else {
      diagnostics.push({ idx, news_item: newsItem, status: "drop:validateHook_failed", tier: (raw.evidence_tier || "").toUpperCase(), anchorScore: filteredLookup.get(newsItem)?.anchorScore });
    }
  }

  // Step 3: Enforce Tier B cap — max 1 total (or 0 if market context off and unanchored)
  let tierBCount = 0;
  const cappedHooks: Hook[] = [];
  for (const hook of validHooks) {
    if (hook.evidence_tier === "B") {
      if (tierBCount >= 1) {
        diagnostics.push({ idx: -1, news_item: hook.news_item, status: "drop:tier_b_cap", tier: hook.evidence_tier });
        continue;
      }
      tierBCount++;
    }
    cappedHooks.push(hook);
  }

  console.log("[publishGate] decision trace", {
    includeMarketContext,
    rawHookCount: rawHooks.length,
    sourceLookupCount: sourceLookup.size,
    filteredLookupCount: filteredLookup.size,
    validHookCount: validHooks.length,
    finalHookCount: cappedHooks.length,
    tierBCount,
    diagnostics,
  });

  return cappedHooks;
}

/**
 * Validate a single pre-built Hook object through publish gate rules.
 * Used for static/demo hooks that are already in Hook shape (not ClaudeHookPayload).
 * Returns the hook if it passes, null if it fails.
 */
export function publishGateValidateHook(hook: Hook, messagingStyle?: MessagingStyle): Hook | null {
  const payload: ClaudeHookPayload = {
    news_item: hook.news_item,
    angle: hook.angle,
    hook: hook.hook,
    evidence_snippet: hook.evidence_snippet,
    source_title: hook.source_title,
    source_date: hook.source_date,
    source_url: hook.source_url,
    evidence_tier: hook.evidence_tier,
    confidence: hook.confidence,
    psych_mode: hook.psych_mode,
    why_this_works: hook.why_this_works,
    promise: hook.promise,
    trigger_type: hook.trigger_type,
    bridge_quality: hook.bridge_quality,
    structural_variant: hook.structural_variant,
    buyer_tension: hook.buyer_tension,
    why_now: hook.why_now,
    affected_metric: hook.affected_metric,
  };
  return validateHook(payload, undefined, messagingStyle);
}

/**
 * Run the publish gate on an already-formed Hook[] (e.g., from cache).
 * This is the LAST step before returning hooks to the user.
 * Every return path that includes hooks MUST call this.
 *
 * Rule A: Change verbs without proof → rewrite to present tense → drop if still fails
 * Rule B: Unanchored source → drop (unless includeMarketContext=true, cap 1)
 * Rule C: Forced-choice question → drop if missing
 * Rule D: Tier B cap at 1
 */
export function publishGateFinal(
  hooks: Hook[],
  companyDomain?: string,
  options?: PublishGateOptions,
  messagingStyle?: MessagingStyle,
): Hook[] {
  const includeMarketContext = options?.includeMarketContext ?? false;
  const domainLower = (companyDomain || "").toLowerCase();

  const gated: Hook[] = [];
  let tierBCount = 0;
  const diagnostics: Array<{ idx: number; news_item: number; status: string; source_url: string; tier: string; anchor?: boolean }> = [];

  for (const [idx, hook] of hooks.entries()) {
    // Rule B: Unanchored source exclusion
    if (domainLower && hook.source_url) {
      const sourceHost = getDomain(hook.source_url).toLowerCase();
      const isOnDomain = sourceHost === domainLower || sourceHost.endsWith("." + domainLower);
      const titleOrSnippet = ((hook.source_title || "") + " " + (hook.evidence_snippet || "")).toLowerCase();
      const mentionsDomain = titleOrSnippet.includes(domainLower);
      const companyName = extractCompanyName(`https://${domainLower}`).toLowerCase();
      const isGenericName = GENERIC_NAME_WORDS.has(companyName) || companyName.length <= 3;
      const mentionsName = !isGenericName && titleOrSnippet.includes(companyName);

      const sourceMatchesDomain = sourceHost === domainLower || sourceHost.endsWith("." + domainLower);
      const anchored = isOnDomain || mentionsDomain || mentionsName || sourceMatchesDomain;
      if (!anchored) {
        if (!includeMarketContext) {
          diagnostics.push({ idx, news_item: hook.news_item, status: "drop:unanchored_source", source_url: hook.source_url || "", tier: hook.evidence_tier, anchor: anchored });
          continue;
        }
        // Market context mode: allow max 1, force Tier B
        if (tierBCount >= 1) {
          diagnostics.push({ idx, news_item: hook.news_item, status: "drop:market_context_cap", source_url: hook.source_url || "", tier: hook.evidence_tier, anchor: anchored });
          continue;
        }
      }
    }

    // Run through full validateHook (Rule A: change verb rewrite, Rule C: question quality, etc.)
    const payload: ClaudeHookPayload = {
      news_item: hook.news_item,
      angle: hook.angle,
      hook: hook.hook,
      evidence_snippet: hook.evidence_snippet,
      source_title: hook.source_title,
      source_date: hook.source_date,
      source_url: hook.source_url,
      evidence_tier: hook.evidence_tier,
      confidence: hook.confidence,
      psych_mode: hook.psych_mode,
      why_this_works: hook.why_this_works,
      promise: hook.promise,
      trigger_type: hook.trigger_type,
      bridge_quality: hook.bridge_quality,
      structural_variant: hook.structural_variant,
      buyer_tension: hook.buyer_tension,
      why_now: hook.why_now,
      affected_metric: hook.affected_metric,
    };
    const validated = validateHook(payload, undefined, messagingStyle);
    if (!validated) {
      diagnostics.push({ idx, news_item: hook.news_item, status: "drop:validateHook_failed", source_url: hook.source_url || "", tier: hook.evidence_tier });
      continue;
    }

    // Rule D: Tier B cap
    if (validated.evidence_tier === "B") {
      if (tierBCount >= 1) {
        diagnostics.push({ idx, news_item: hook.news_item, status: "drop:tier_b_cap", source_url: validated.source_url || "", tier: validated.evidence_tier });
        continue;
      }
      tierBCount++;
    }

    diagnostics.push({ idx, news_item: validated.news_item, status: "pass", source_url: validated.source_url || "", tier: validated.evidence_tier });
    gated.push(validated);
  }

  console.log("[publishGateFinal] decision trace", {
    companyDomain,
    includeMarketContext,
    inputHookCount: hooks.length,
    finalHookCount: gated.length,
    tierBCount,
    diagnostics,
  });

  return gated;
}

// ---------------------------------------------------------------------------
// Fallback mock hooks
// ---------------------------------------------------------------------------

export function applyUrlToMockHooks(url: string): string[] {
  return MOCK_HOOKS.map((h) => h.replace(/{{url}}/g, url));
}

// ---------------------------------------------------------------------------
// 1. ROLE TOKEN GATE — enforce persona-level framing
// ---------------------------------------------------------------------------

/**
 * Required token sets per role. A hook must contain ≥1 token (case-insensitive)
 * from the selected role's set for the gate to pass. Multi-word tokens match
 * as substrings so "rep productivity" matches "rep productivity drops".
 */
export const ROLE_REQUIRED_TOKENS: Record<Exclude<TargetRole, "General">, string[]> = {
  "Founder/CEO": ["focus", "efficiency", "roi", "cac", "payback", "growth", "constraints", "prioritization", "burn", "unit economics"],
  "VP Sales": ["pipeline", "quota", "forecast", "conversion", "meeting quality", "coverage", "ramp", "win rate", "deal velocity"],
  "RevOps": ["process", "tooling", "governance", "attribution", "data quality", "automation", "reliability", "ops", "workflow"],
  "SDR Manager": ["rep productivity", "reply rate", "coaching", "qa", "coverage", "speed-to-lead", "ramp", "activity"],
  "Marketing": ["lead quality", "icp", "routing", "conversion", "intent", "mql", "demand", "funnel"],
};

/**
 * Check if a hook's FINAL QUESTION sentence contains at least one role token.
 * Uses the question part (after the last em dash, or the last sentence with "?").
 * This prevents token stuffing earlier in the hook.
 * Returns the matched token or null.
 */
export function findRoleTokenHit(hookText: string, role: TargetRole): string | null {
  if (role === "General") return null; // No gate for General
  const tokens = ROLE_REQUIRED_TOKENS[role];
  if (!tokens) return null;

  // Extract the final question: text after the last em dash, or last "?" sentence
  const parts = hookText.split(/\s*—\s*/);
  const questionPart = (parts.length > 1 ? parts[parts.length - 1] : hookText).toLowerCase();

  for (const token of tokens) {
    if (questionPart.includes(token)) return token;
  }
  return null;
}

/**
 * Role Token Gate: filter hooks to those containing a role-relevant token.
 * Hooks that don't match are dropped (rewrite would need Claude, too expensive here).
 * Returns hooks with `role_token_hit` set on each.
 */
export function roleTokenGate(
  hooks: Hook[],
  targetRole: TargetRole | null,
): Hook[] {
  if (!targetRole || targetRole === "General") {
    console.log("[roleTokenGate] skipped", { targetRole: targetRole ?? "General", inputHookCount: hooks.length });
    return hooks;
  }

  const diagnostics: Array<{ news_item: number; matched: boolean; token: string | null }> = [];
  const out = hooks.reduce<Hook[]>((acc, hook) => {
    const hit = findRoleTokenHit(hook.hook, targetRole);
    diagnostics.push({ news_item: hook.news_item, matched: !!hit, token: hit });
    if (hit) {
      acc.push({ ...hook, role_token_hit: hit });
    }
    return acc;
  }, []);

  console.log("[roleTokenGate] decision trace", {
    targetRole,
    inputHookCount: hooks.length,
    outputHookCount: out.length,
    droppedCount: hooks.length - out.length,
    diagnostics,
  });

  return out;
}

// ---------------------------------------------------------------------------
// 2. TRADEOFF GROUNDING GATE — reject ungrounded strategy forks
// ---------------------------------------------------------------------------

/**
 * Safe operational fork patterns: if the evidence snippet matches a trigger
 * pattern, the associated option pairs are considered grounded.
 */
const SAFE_TRADEOFF_FORKS: Array<{ trigger: RegExp; options: string[][] }> = [
  {
    trigger: /\bintegrat/i,
    options: [["native", "api"], ["self-serve", "managed"], ["self-serve", "supported"]],
  },
  {
    trigger: /\b24\/7\b|\bsupport\b.*\b(global|worldwide|follow.the.sun)\b/i,
    options: [["follow-the-sun", "regional"], ["generalist", "specialist"]],
  },
  {
    trigger: /\bpartner|\borg(anization)?s?\b.*\d{2,}/i,
    options: [["standardized", "bespoke"], ["mid-market", "enterprise"], ["breadth", "depth"]],
  },
  {
    trigger: /\brevenue|\bgrowth|\bloss/i,
    options: [["efficiency", "market share"], ["roi", "growth"], ["margin", "volume"]],
  },
  {
    trigger: /\bhir(e|ing)\b|\bteam\b.*\b(grow|expand|scale)/i,
    options: [["internal", "outsource"], ["specialist", "generalist"]],
  },
];

/**
 * Check if a tradeoff hook is grounded in evidence.
 * Returns true if:
 *   A) At least one option's key word from the hook's question appears in the evidence, OR
 *   B) The evidence matches a safe fork trigger whose option concept appears in the hook, OR
 *   C) The hook's quoted evidence (inside double quotes) directly relates to the tradeoff
 *      (i.e., a significant word from the quoted portion also appears in the options).
 */
export function isTradeoffGrounded(hookText: string, evidenceSnippet: string): boolean {
  const hookLower = hookText.toLowerCase();
  const evidenceLower = evidenceSnippet.toLowerCase();

  // Extract the question part (after the last em dash)
  const questionPart = hookLower.split(/\s*—\s*/).pop() || hookLower;

  // Extract all "X or Y" / "X, or Y" patterns from the question (multi-word options)
  const orMatches = [...questionPart.matchAll(/\b([\w-]+(?:\s+[\w-]+){0,3}),?\s+(?:or)\s+([\w-]+(?:\s+[\w-]+){0,3})/g)];
  for (const m of orMatches) {
    const optionA = m[1].trim();
    const optionB = m[2].trim();
    // Rule A: at least one option (or its significant words) appears in evidence
    if (evidenceLower.includes(optionA) || evidenceLower.includes(optionB)) return true;
    // Check individual significant words (3+ chars) from each option
    const wordsA = optionA.split(/\s+/).filter((w) => w.length >= 3);
    const wordsB = optionB.split(/\s+/).filter((w) => w.length >= 3);
    if (wordsA.some((w) => evidenceLower.includes(w)) || wordsB.some((w) => evidenceLower.includes(w))) return true;
  }

  // Rule C: if the hook contains a verbatim quote from evidence, the tradeoff
  // is grounded — asking about mechanism/approach behind a quoted claim is valid.
  const quoteMatch = hookLower.match(/["\u201c]([^"\u201d]+)["\u201d]/);
  if (quoteMatch && evidenceLower.includes(quoteMatch[1].trim().slice(0, 20))) {
    // The hook quotes evidence AND asks a tradeoff → grounded by definition
    return true;
  }

  // Rule B: check safe fork triggers
  for (const fork of SAFE_TRADEOFF_FORKS) {
    if (!fork.trigger.test(evidenceLower)) continue;
    for (const pair of fork.options) {
      if (pair.some((word) => questionPart.includes(word.toLowerCase()))) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Hook quality scoring (1-100) + ranking
// ---------------------------------------------------------------------------

export function getQualityLabel(score: number): "Excellent" | "Strong" | "Decent" | "Weak" {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Decent";
  return "Weak";
}

export function scoreHookQuality(hook: Hook, companyDomain?: string): number {
  let evidence = 0;
  if (hook.source_url) evidence += 12;
  if (hook.source_date) evidence += 8;
  if (hook.evidence_snippet && hook.evidence_snippet.length >= 30) evidence += 8;
  if (/['"“”]/.test(hook.evidence_snippet || "")) evidence += 7;
  if (hook.evidence_tier === "A") evidence += 8;
  if (hook.evidence_tier === "B") evidence += 4;

  let relevance = hook.angle === "trigger" ? 30 : hook.angle === "risk" ? 24 : 18;
  if (hook.role_token_hit) relevance += 2;

  let recency = 6;
  if (hook.source_date) {
    const daysAgo = (Date.now() - new Date(hook.source_date).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 14) recency = 20;
    else if (daysAgo <= 45) recency = 16;
    else if (daysAgo <= 90) recency = 12;
    else if (daysAgo <= 180) recency = 8;
    else recency = 4;
  }

  // Trigger-type weighting (requested ranges)
  if (hook.trigger_type === "ipo") relevance = Math.max(relevance, 35);
  if (hook.trigger_type === "funding") relevance = Math.max(relevance, 30);
  if (hook.trigger_type === "expansion") relevance = Math.max(relevance, 24);
  if (hook.trigger_type === "hiring") relevance = Math.max(relevance, 22);

  let specificity = 4;
  if (/\d/.test(hook.hook)) specificity += 4;
  if (/['"“”]/.test(hook.hook)) specificity += 3;
  if ((hook.hook.match(/\b[A-Z][a-z]{2,}\b/g) || []).length >= 2) specificity += 3;
  if (companyDomain && (`${hook.hook} ${hook.evidence_snippet}`).toLowerCase().includes(companyDomain.toLowerCase())) specificity += 1;

  const novelty = hook.novelty_score ?? scoreNovelty(hook.hook);
  const buyerTension = hook.tension_richness_score ?? hook.buyer_tension_score ?? scoreBuyerTension(hook.hook, hook);
  const interestingness = hook.interestingness_score ?? novelty;
  const specificityScore = hook.specificity_score ?? (/\d/.test(`${hook.hook} ${hook.evidence_snippet}`) ? 7 : 5);
  const genericPenalty = hook.genericness_penalty ?? computeGenericnessPenalty(hook.hook);
  const promisePenalty = computePromisePenalty(hook);

  const raw = evidence + relevance + recency + Math.min(specificity, 15) + novelty + buyerTension + interestingness + specificityScore - genericPenalty - promisePenalty;
  const score = Math.max(1, Math.min(100, Math.round(raw)));
  // Hard cap: weak-bridge hooks never score above 79
  if (hook.bridge_quality === "weak" && score > 79) return 79;
  return score;
}

// ---------------------------------------------------------------------------
// 3. RANK + CAP — score and limit hooks to top N
// ---------------------------------------------------------------------------

/**
 * Score a hook for ranking. Higher = better.
 *   tier_weight:       A=3, B=1
 *   recency_weight:    0–2 based on source date (newer = higher)
 *   specificity_weight: 0–2 based on numbers/names/quotes in hook
 *   role_match_bonus:  +1 if role_token_hit is set
 */
export function scoreHook(hook: Hook): number {
  let score = 0;

  // Tier weight
  score += hook.evidence_tier === "A" ? 3 : 1;

  // Recency weight (0–2)
  if (hook.source_date) {
    const daysAgo = (Date.now() - new Date(hook.source_date).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 30) score += 2;
    else if (daysAgo <= 90) score += 1.5;
    else if (daysAgo <= 180) score += 1;
    else if (daysAgo <= 365) score += 0.5;
    // older than 1 year: +0
  }

  // Specificity weight (0–2): numbers, proper nouns, quoted text
  let specificity = 0;
  if (/\d/.test(hook.hook)) specificity += 0.5;
  if (/["\u201C]/.test(hook.hook)) specificity += 1; // Has verbatim quote
  // Named entities (capitalized words not at sentence start, 2+ chars)
  const namedEntities = hook.hook.match(/(?<!\. )[A-Z][a-z]{2,}/g) || [];
  if (namedEntities.length >= 2) specificity += 0.5;
  score += Math.min(specificity, 2);

  // Role match bonus
  if (hook.role_token_hit) score += 1;

  // Confidence bonus
  if (hook.confidence === "high") score += 0.5;

  const credibility =
    (hook.evidence_tier === "A" ? 4 : 2) +
    (hook.specificity_score ?? (/\d/.test(`${hook.hook} ${hook.evidence_snippet}`) ? 7 : 5)) / 3 +
    (hook.confidence === "high" ? 1.5 : 0.5);
  const interestingness = (hook.interestingness_score ?? hook.novelty_score ?? scoreNovelty(hook.hook)) / 2;
  const tensionRichness = (hook.tension_richness_score ?? hook.buyer_tension_score ?? scoreBuyerTension(hook.hook, hook)) / 2;

  score += credibility;
  score += interestingness;
  score += tensionRichness;
  score -= (hook.genericness_penalty ?? computeGenericnessPenalty(hook.hook)) / 5;
  score -= computePromisePenalty(hook) / 5;

  hook.credibility_score = Number(credibility.toFixed(2));
  hook.ranking_score = Number(score.toFixed(2));
  return score;
}

function tokenizeHookText(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) || [])
    .filter((token) => !["that", "this", "with", "your", "from", "have", "what", "when", "where", "which"].includes(token));
}

function computeJaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let overlap = 0;
  for (const token of aSet) {
    if (bSet.has(token)) overlap++;
  }
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : overlap / union;
}

function getDuplicateClusterKey(hook: Hook): string {
  if (hook.buyer_tension_id) return `tension:${hook.buyer_tension_id}`;
  const sourceKey = hook.source_url || hook.source_title || "unknown";
  const variantKey = hook.structural_variant || hook.angle;
  const normalized = tokenizeHookText(hook.hook).slice(0, 8).join("-");
  return `source:${sourceKey}|variant:${variantKey}|tokens:${normalized}`;
}

function getDiversityBucket(hook: Hook): string {
  return [
    hook.structural_variant || "unknown-variant",
    hook.angle,
    hook.trigger_type || "unknown-trigger",
  ].join("|");
}

function areHooksNearDuplicate(a: Hook, b: Hook): boolean {
  if (a.buyer_tension_id && b.buyer_tension_id && a.buyer_tension_id === b.buyer_tension_id) return true;
  if (a.source_url && b.source_url && a.source_url === b.source_url && a.structural_variant === b.structural_variant) {
    const metricA = (a.affected_metric || "").toLowerCase();
    const metricB = (b.affected_metric || "").toLowerCase();
    if (metricA === metricB) return true;
  }
  const similarity = computeJaccardSimilarity(tokenizeHookText(a.hook), tokenizeHookText(b.hook));
  const sameFrame =
    (a.source_url || "") === (b.source_url || "") &&
    (a.angle || "") === (b.angle || "") &&
    (a.trigger_type || "") === (b.trigger_type || "");
  return sameFrame && similarity >= 0.88;
}

function deduplicateHooks(hooks: Hook[]): Hook[] {
  const kept: Hook[] = [];
  for (const hook of hooks) {
    const clusterKey = getDuplicateClusterKey(hook);
    hook.duplicate_cluster_key = clusterKey;
    if (kept.some((existing) => areHooksNearDuplicate(existing, hook))) continue;
    kept.push(hook);
  }
  return kept;
}

function computeRoleFitScore(hook: Hook, targetRole?: TargetRole | null): number {
  if (!targetRole || targetRole === "General") return hook.role_token_hit ? 7 : 5;
  if (hook.role_token_hit) return 9;
  const tokens = ROLE_REQUIRED_TOKENS[targetRole] || [];
  const lower = hook.hook.toLowerCase();
  const matches = tokens.filter((token) => lower.includes(token)).length;
  return Math.max(1, Math.min(10, 4 + matches * 2));
}

function computeNonOverlapScore(hook: Hook, selected: Hook[]): number {
  if (selected.length === 0) return 10;
  let score = 10;
  for (const existing of selected) {
    if (hook.buyer_tension_id && existing.buyer_tension_id && hook.buyer_tension_id === existing.buyer_tension_id) {
      score -= 5;
    }
    if (hook.diversity_bucket && existing.diversity_bucket && hook.diversity_bucket === existing.diversity_bucket) {
      score -= 2;
    }
    const similarity = computeJaccardSimilarity(tokenizeHookText(hook.hook), tokenizeHookText(existing.hook));
    if (similarity >= 0.72) score -= 5;
    else if (similarity >= 0.55) score -= 3;
  }
  return Math.max(1, Math.min(10, score));
}

function computeSelectorPriorAdjustment(hook: Hook, priors?: HookSelectorPriors): number {
  if (!priors) return 0;

  let adjustment = 0;
  if (hook.buyer_tension_id) adjustment += priors.buyerTensionBoosts[hook.buyer_tension_id] ?? 0;
  if (hook.structural_variant) adjustment += priors.structuralVariantBoosts[hook.structural_variant] ?? 0;
  adjustment += priors.angleBoosts[hook.angle] ?? 0;
  if (hook.trigger_type) adjustment += priors.triggerTypeBoosts[hook.trigger_type] ?? 0;

  if (hook.buyer_tension_id && priors.recentCompanyMemory.buyerTensionIds.includes(hook.buyer_tension_id)) {
    adjustment -= 2.25;
  }
  if (hook.structural_variant && priors.recentCompanyMemory.structuralVariants.includes(hook.structural_variant)) {
    adjustment -= 0.75;
  }
  if (priors.recentCompanyMemory.hookTexts.some((text) => computeJaccardSimilarity(tokenizeHookText(text), tokenizeHookText(hook.hook)) >= 0.8)) {
    adjustment -= 1.5;
  }

  return Number(Math.max(-3, Math.min(3, adjustment)).toFixed(2));
}

function computeExplorationBonus(hook: Hook, priors?: HookSelectorPriors): number {
  if (!priors || priors.explorationWeight <= 0) return 0;

  const totalTrials = Math.max(1, priors.totalTrials);
  const counts = [
    hook.buyer_tension_id ? (priors.buyerTensionTrials[hook.buyer_tension_id] ?? 0) : 0,
    hook.structural_variant ? (priors.structuralVariantTrials[hook.structural_variant] ?? 0) : 0,
    priors.angleTrials[hook.angle] ?? 0,
    hook.trigger_type ? (priors.triggerTypeTrials[hook.trigger_type] ?? 0) : 0,
  ].filter((count) => count >= 0);

  const observed = counts.length > 0 ? Math.max(0, ...counts) : 0;
  const uncertainty = Math.sqrt((2 * Math.log(totalTrials + 1)) / (observed + 1));

  let noveltyLift = 0;
  if (hook.structural_variant && (priors.structuralVariantTrials[hook.structural_variant] ?? 0) <= 1) noveltyLift += 0.35;
  if (hook.trigger_type && (priors.triggerTypeTrials[hook.trigger_type] ?? 0) <= 1) noveltyLift += 0.25;
  if (hook.buyer_tension_id && (priors.buyerTensionTrials[hook.buyer_tension_id] ?? 0) === 0) noveltyLift += 0.5;

  const bonus = priors.explorationWeight * uncertainty + noveltyLift;
  return Number(Math.max(0, Math.min(2.5, bonus)).toFixed(2));
}

function getHookLengthBucket(hook: Hook): "short" | "medium" | "long" {
  const length = hook.hook.length;
  if (length <= 160) return "short";
  if (length <= 260) return "medium";
  return "long";
}

function detectHookStyleSignals(hook: Hook): {
  direct: boolean;
  conversational: boolean;
  formal: boolean;
  operator: boolean;
} {
  const text = hook.hook;
  return {
    direct: text.length <= 220 && !/\bmaybe|perhaps|wondering|might\b/i.test(text),
    conversational: /\b(hey|so|honest question|you're|that's|doesn't|isn't|aren't)\b/i.test(text),
    formal: !/\b(you're|that's|doesn't|isn't|aren't|hey|so)\b/i.test(text) && /\b(following|consideration|therefore|whether)\b/i.test(text),
    operator: /\b(forecast|pipeline|inspection|handoff|attribution|ramp|commit risk|conversion|coverage)\b/i.test(text),
  };
}

function computePersonalizationBonus(hook: Hook, priors?: HookSelectorPriors): number {
  if (!priors) return 0;
  const workspaceStyle = priors.workspaceStyle;
  const userStyle = priors.userStyle;
  const style = {
    preferredLength: userStyle?.preferredLength ?? workspaceStyle?.preferredLength ?? null,
    directnessPreference: Math.max(userStyle?.directnessPreference ?? 0, workspaceStyle?.directnessPreference ?? 0),
    conversationalPreference: Math.max(userStyle?.conversationalPreference ?? 0, workspaceStyle?.conversationalPreference ?? 0),
    formalPreference: Math.max(userStyle?.formalPreference ?? 0, workspaceStyle?.formalPreference ?? 0),
    operatorPreference: Math.max(userStyle?.operatorPreference ?? 0, workspaceStyle?.operatorPreference ?? 0),
    explicitVoiceTone: workspaceStyle?.explicitVoiceTone ?? null,
    preferredTone: userStyle?.preferredTone ?? null,
  };
  if (!workspaceStyle && !userStyle) return 0;
  let bonus = 0;

  const lengthBucket = getHookLengthBucket(hook);
  if (style.preferredLength && style.preferredLength === lengthBucket) {
    bonus += 0.8;
  }

  const signals = detectHookStyleSignals(hook);
  if (signals.direct) bonus += style.directnessPreference * 0.6;
  if (signals.conversational) bonus += style.conversationalPreference * 0.6;
  if (signals.formal) bonus += style.formalPreference * 0.6;
  if (signals.operator) bonus += style.operatorPreference * 0.7;

  if (style.explicitVoiceTone === "Direct & Professional" && signals.direct) bonus += 0.4;
  if (style.explicitVoiceTone === "Friendly & Casual" && signals.conversational) bonus += 0.4;
  if (style.explicitVoiceTone === "Formal & Corporate" && signals.formal) bonus += 0.4;
  if (style.explicitVoiceTone === "Conversational" && signals.conversational) bonus += 0.4;

  if (style.preferredTone === "direct" && signals.direct) bonus += 0.45;
  if (style.preferredTone === "warm" && signals.conversational) bonus += 0.35;
  if (style.preferredTone === "concise" && lengthBucket === "short") bonus += 0.4;

  return Number(Math.max(-1.5, Math.min(2, bonus)).toFixed(2));
}

function isUndatedSource(sourceDate?: string): boolean {
  return !sourceDate || !sourceDate.trim();
}

function isTimingSensitiveSource(sourceDate?: string): boolean {
  if (!sourceDate || !sourceDate.trim()) return false;
  const parsed = Date.parse(sourceDate);
  if (Number.isNaN(parsed)) return false;
  const daysOld = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  return daysOld > 120;
}

function computeCounterfactualPenalty(
  hook: Hook,
  targetRole?: TargetRole | null,
  priors?: HookSelectorPriors,
): number {
  const counterfactuals = priors?.counterfactuals;
  if (!counterfactuals) return 0;

  let penalty = 0;
  if (hook.buyer_tension_id) {
    penalty += counterfactuals.buyerTensionPenalties[hook.buyer_tension_id] ?? 0;
  }
  if (hook.structural_variant) {
    penalty += counterfactuals.structuralVariantPenalties[hook.structural_variant] ?? 0;
  }
  penalty += counterfactuals.evidenceTierPenalties[hook.evidence_tier] ?? 0;

  if (targetRole) {
    const rolePenalty = counterfactuals.targetRolePenalties[targetRole] ?? 0;
    const roleFit = computeRoleFitScore(hook, targetRole);
    penalty += roleFit < 7 ? rolePenalty : rolePenalty * 0.35;
  }

  if (isUndatedSource(hook.source_date)) {
    penalty += counterfactuals.undatedSourcePenalty;
  } else if (isTimingSensitiveSource(hook.source_date)) {
    penalty += counterfactuals.staleSourcePenalty;
  }

  return Number(Math.max(0, Math.min(3, penalty)).toFixed(2));
}

function computeRetrievalBonus(hook: Hook, priors?: HookSelectorPriors): number {
  const library = priors?.retrievalLibrary;
  const companyDomain = priors?.currentCompanyDomain ?? null;
  const sourceType = hook.source_url
    ? (companyDomain && isFirstPartySource(hook.source_url, companyDomain)
        ? "first_party"
        : isReputablePublisher(hook.source_url)
          ? "trusted_news"
          : hook.evidence_tier === "A" || hook.evidence_tier === "B"
            ? "semantic_web"
            : "fallback_web")
    : null;
  const sourceTypeBoost = sourceType ? (priors?.sourceTypeBoosts?.[sourceType] ?? 0) : 0;
  const triggerSourceTypeBoost =
    sourceType && hook.trigger_type
      ? (priors?.triggerSourceTypeBoosts?.[hook.trigger_type]?.[sourceType] ?? 0)
      : 0;
  if ((!library || library.length === 0) && sourceTypeBoost === 0 && triggerSourceTypeBoost === 0) return 0;

  let best = 0;
  for (const pattern of library ?? []) {
    let score = 0;
    if (pattern.angle === hook.angle) score += 0.35;
    if (pattern.triggerType && hook.trigger_type && pattern.triggerType === hook.trigger_type) score += 0.5;
    if (pattern.structuralVariant && hook.structural_variant && pattern.structuralVariant === hook.structural_variant) score += 0.8;
    if (pattern.buyerTensionId && hook.buyer_tension_id && pattern.buyerTensionId === hook.buyer_tension_id) score += 0.95;
    if (pattern.evidenceTier === hook.evidence_tier) score += 0.2;
    if (pattern.sourceType && sourceType && pattern.sourceType === sourceType) score += 0.35;

    if (score <= 0) continue;
    const normalizedOutcome = Math.min(1.5, pattern.outcomeScore / 5);
    best = Math.max(best, score * normalizedOutcome);
  }

  return Number(Math.max(0, Math.min(2.25, best + sourceTypeBoost + triggerSourceTypeBoost)).toFixed(2));
}

function getSourceFreshnessBucket(sourceDate?: string): "fresh" | "recent" | "stale" | "undated" {
  if (!sourceDate || !sourceDate.trim()) return "undated";
  const parsed = Date.parse(sourceDate);
  if (Number.isNaN(parsed)) return "undated";
  const daysOld = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  if (daysOld <= 14) return "fresh";
  if (daysOld <= 60) return "recent";
  return "stale";
}

function getCurrentSendWindow(now = new Date()): "weekday_morning" | "weekday_afternoon" | "weekday_evening" | "weekend" {
  const day = now.getDay();
  if (day === 0 || day === 6) return "weekend";
  const hour = now.getHours();
  if (hour < 12) return "weekday_morning";
  if (hour < 17) return "weekday_afternoon";
  return "weekday_evening";
}

function computeTimingBonus(hook: Hook, priors?: HookSelectorPriors): number {
  const timing = priors?.timingPreference;
  if (!timing) return 0;

  let bonus = 0;
  const freshness = getSourceFreshnessBucket(hook.source_date);
  if (freshness === "fresh") bonus += timing.freshPreference * 0.55;
  if (freshness === "recent") bonus += timing.recentPreference * 0.45;
  if (freshness === "stale") bonus += timing.staleTolerance * 0.35;
  if (freshness === "undated") bonus += timing.undatedTolerance * 0.25;

  if (timing.preferredFreshness === freshness) bonus += 0.45;

  const currentWindow = getCurrentSendWindow();
  if (timing.preferredSendWindow && timing.preferredSendWindow === currentWindow) {
    if (freshness === "fresh" || freshness === "recent") bonus += 0.25;
    else bonus += 0.1;
  }

  return Number(Math.max(-0.5, Math.min(1.5, bonus)).toFixed(2));
}

export function computeHookSelectionCriteria(
  hook: Hook,
  selected: Hook[] = [],
  targetRole?: TargetRole | null,
  priors?: HookSelectorPriors,
): HookSelectionCriteria {
  const credibility = Math.max(1, Math.min(10, Math.round((hook.credibility_score ?? (hook.evidence_tier === "A" ? 8 : 5)))));
  const interestingness = Math.max(1, Math.min(10, Math.round(hook.interestingness_score ?? hook.novelty_score ?? scoreNovelty(hook.hook))));
  const roleFit = computeRoleFitScore(hook, targetRole);
  const novelty = Math.max(1, Math.min(10, Math.round(hook.novelty_score ?? scoreNovelty(hook.hook))));
  const nonOverlap = computeNonOverlapScore(hook, selected);
  const priorAdjustment = computeSelectorPriorAdjustment(hook, priors);
  const explorationBonus = computeExplorationBonus(hook, priors);
  const personalizationBonus = computePersonalizationBonus(hook, priors);
  const retrievalBonus = computeRetrievalBonus(hook, priors);
  const timingBonus = computeTimingBonus(hook, priors);
  const counterfactualPenalty = computeCounterfactualPenalty(hook, targetRole, priors);
  const total = Number((credibility * 0.32 + interestingness * 0.24 + roleFit * 0.16 + novelty * 0.12 + nonOverlap * 0.16 + priorAdjustment + explorationBonus + personalizationBonus + retrievalBonus + timingBonus - counterfactualPenalty).toFixed(2));
  return {
    credibility,
    interestingness,
    roleFit,
    novelty,
    nonOverlap,
    priorAdjustment,
    explorationBonus,
    personalizationBonus,
    retrievalBonus,
    timingBonus,
    counterfactualPenalty,
    total,
  };
}

/**
 * Rank hooks by score descending, then cap to maxHooks.
 * Returns { top, overflow } where top is the default view and overflow is the rest.
 */
export function rankAndCap(
  hooks: Hook[],
  maxHooks: number = 3,
  options?: { targetRole?: TargetRole | null; selectorPriors?: HookSelectorPriors },
): { top: Hook[]; overflow: Hook[] } {
  const deduped = deduplicateHooks(hooks.map((hook) => ({
    ...hook,
    diversity_bucket: getDiversityBucket(hook),
  })));

  const scored = deduped
    .map((hook) => ({ hook, score: scoreHook(hook) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.hook);

  const strongAll = scored.filter((hook) => hook.bridge_quality !== "weak");
  const weakAll = scored.filter((hook) => hook.bridge_quality === "weak");

  const orderedStrong: Hook[] = [];
  for (const hook of strongAll) {
    const criteria = computeHookSelectionCriteria(hook, orderedStrong, options?.targetRole, options?.selectorPriors);
    hook.selector_score = criteria.total;
    hook.role_fit_score = criteria.roleFit;
    hook.non_overlap_score = criteria.nonOverlap;
    orderedStrong.push(hook);
  }

  orderedStrong.sort((a, b) => (b.selector_score ?? 0) - (a.selector_score ?? 0));

  const selectedTop: Hook[] = [];
  const remainingStrong = [...orderedStrong];

  while (selectedTop.length < Math.min(maxHooks, remainingStrong.length)) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (const [index, hook] of remainingStrong.entries()) {
      const criteria = computeHookSelectionCriteria(hook, selectedTop, options?.targetRole, options?.selectorPriors);
      hook.selector_score = criteria.total;
      hook.role_fit_score = criteria.roleFit;
      hook.non_overlap_score = criteria.nonOverlap;
      if (criteria.total > bestScore) {
        bestScore = criteria.total;
        bestIndex = index;
      }
    }
    if (bestIndex === -1) break;
    selectedTop.push(remainingStrong.splice(bestIndex, 1)[0]);
  }

  const orderedWeak = weakAll.map((hook) => {
    const criteria = computeHookSelectionCriteria(hook, selectedTop, options?.targetRole, options?.selectorPriors);
    hook.selector_score = criteria.total;
    hook.role_fit_score = criteria.roleFit;
    hook.non_overlap_score = criteria.nonOverlap;
    return hook;
  }).sort((a, b) => (b.selector_score ?? 0) - (a.selector_score ?? 0));

  // If we cannot fill the first two positions with strong hooks, keep weak hooks out of top results.
  if (strongAll.length < Math.min(2, maxHooks)) {
    const out = {
      top: selectedTop.slice(0, maxHooks),
      overflow: orderedWeak,
    };
    console.log("[rankAndCap] decision trace", {
      inputHookCount: hooks.length,
      dedupedCount: deduped.length,
      maxHooks,
      strongCount: strongAll.length,
      weakCount: weakAll.length,
      topCount: out.top.length,
      overflowCount: out.overflow.length,
      weakSuppressedFromTop: true,
    });
    return out;
  }

  const ordered = [...selectedTop, ...remainingStrong, ...orderedWeak];
  const out = {
    top: ordered.slice(0, maxHooks),
    overflow: ordered.slice(maxHooks),
  };
    console.log("[rankAndCap] decision trace", {
      inputHookCount: hooks.length,
      dedupedCount: deduped.length,
      maxHooks,
      strongCount: strongAll.length,
      weakCount: weakAll.length,
    topCount: out.top.length,
    overflowCount: out.overflow.length,
    weakSuppressedFromTop: false,
  });
  return out;
}

// ---------------------------------------------------------------------------
// Role metadata attachment
// ---------------------------------------------------------------------------

function attachRoleMeta(
  hooks: Hook[],
  targetRole: TargetRole | null,
  usesSenderContext: boolean,
): Hook[] {
  if (!targetRole) return hooks.map((h) => ({ ...h, uses_sender_context: usesSenderContext }));
  const roleInfo = ROLE_RESPONSIBILITIES[targetRole];
  return hooks.map((h) => ({
    ...h,
    role_used: targetRole,
    role_tag: roleInfo?.tag ?? "general",
    uses_sender_context: usesSenderContext,
  }));
}

// ---------------------------------------------------------------------------
// High-level: generate hooks for a single URL (used by batch route)
// ---------------------------------------------------------------------------

export async function generateHooksForUrl(opts: {
  url: string;
  pitchContext?: string;
  count?: number;
  includeMarketContext?: boolean;
  senderContext?: SenderContext | null;
  targetRole?: TargetRole | null;
  messagingStyle?: MessagingStyle;
}): Promise<{ hooks: Hook[]; suggestion?: string; lowSignal?: boolean }> {
  const exaApiKey = process.env.EXA_API_KEY;
  const claudeApiKey = getClaudeApiKey();

  if (!exaApiKey || !claudeApiKey) {
    throw new Error("Missing EXA_API_KEY or CLAUDE_API_KEY");
  }

  const { sources: rawSources, signalCount, lowSignal, hasAnchoredSources } = await fetchSourcesWithGating(opts.url, exaApiKey);
  const domain = getDomain(opts.url);
  const includeMarketContext = opts.includeMarketContext ?? false;

  // Default mode: exclude unanchored sources entirely (anchorScore < 3)
  // Market context mode: allow max 1 unanchored source, labeled + capped
  const sources = includeMarketContext
    ? rawSources
    : rawSources.filter((s) => (s.anchorScore ?? 0) >= 3);

  const NO_ANCHOR_SUGGESTION = "Need one more source to generate strong hooks.";
  const LOW_SIGNAL_SUGGESTION = "Need one more source to generate strong hooks.";

  // Check if all sources are Tier C
  const usableSources = sources.filter((s) => s.tier !== "C");
  if (usableSources.length === 0) {
    return {
      hooks: [],
      suggestion: NO_ANCHOR_SUGGESTION,
      lowSignal: true,
    };
  }

  const _senderContext = opts.senderContext ?? null;
  const _targetRole = opts.targetRole ?? null;
  const _messagingStyle = opts.messagingStyle ?? "evidence";

  // If no company-anchored sources, show low signal with specific guidance
  if (!hasAnchoredSources) {
    const sourceLookup = new Map<number, ClassifiedSource>();
    usableSources.forEach((s, i) => sourceLookup.set(i + 1, s));

    const { rawHooks } = await generateHookPayloadsFromSources({
      url: opts.url,
      sources,
      apiKey: claudeApiKey,
      context: opts.pitchContext,
      senderContext: _senderContext,
      targetRole: _targetRole,
      messagingStyle: _messagingStyle,
    });

    // Publish Gate — enforce all rules
    const gated = publishGate(rawHooks, sourceLookup, { includeMarketContext });
    // Attach role metadata
    const withMeta = attachRoleMeta(gated, _targetRole, !!_senderContext);
    return {
      hooks: withMeta.slice(0, 1),
      suggestion: NO_ANCHOR_SUGGESTION,
      lowSignal: true,
    };
  }

  const sourceLookup = new Map<number, ClassifiedSource>();
  usableSources.forEach((s, i) => sourceLookup.set(i + 1, s));

  const { rawHooks } = await generateHookPayloadsFromSources({
    url: opts.url,
    sources,
    apiKey: claudeApiKey,
    context: opts.pitchContext,
    senderContext: _senderContext,
    targetRole: _targetRole,
    messagingStyle: _messagingStyle,
  });

  // Publish Gate — enforce all rules (validate → rewrite → drop, Tier B cap, anchor filter)
  const gated = publishGate(rawHooks, sourceLookup, { includeMarketContext });

  // Signal vs Fundamental gate
  if (lowSignal) {
    const tierACount = sources.filter((s) => s.tier === "A").length;
    console.log("[generateHooksForUrl] showing suggestion: low signal", {
      tierACount,
      signalCount,
      lowSignal,
      intentSignalsLength: 0,
      hasAnchoredSources,
      gatedCount: gated.length,
      conditions: {
        noAnchored: !hasAnchoredSources,
        isLowSignal: lowSignal,
      },
    });
    const withMeta = attachRoleMeta(gated, _targetRole, !!_senderContext);
    return {
      hooks: withMeta.slice(0, 1),
      suggestion: LOW_SIGNAL_SUGGESTION,
      lowSignal: true,
    };
  }

  // If nothing survived publish gate, return low signal
  if (gated.length === 0) {
    return {
      hooks: [],
      suggestion: NO_ANCHOR_SUGGESTION,
      lowSignal: true,
    };
  }

  // Apply role token gate
  const roleGated = roleTokenGate(gated, _targetRole);
  
  // Debug logging with all counts
  const tierACount = sources.filter((s) => s.tier === "A").length;
  console.log("[generateHooksForUrl] role gating decision:", {
    tierACount,
    signalCount,
    lowSignal,
    gatedCount: gated.length,
    roleGatedCount: roleGated.length,
    targetRole: _targetRole,
    roleGatingRemoved: gated.length - roleGated.length,
  });

  // Safety fallback: if role gating removes everything but hooks exist, use original hooks
  const finalHooks = roleGated.length === 0 && gated.length > 0 ? gated : roleGated;
  
  console.log("[generateHooksForUrl] final hook selection:", {
    usingFallback: roleGated.length === 0 && gated.length > 0,
    finalHookCount: finalHooks.length,
  });

  // Rank and cap
  const limit = opts.count ?? 3;
  const { top } = rankAndCap(finalHooks, limit, { targetRole: _targetRole });

  const withMeta = attachRoleMeta(top, _targetRole, !!_senderContext);
  return { hooks: withMeta, lowSignal: false };
}

// ---------------------------------------------------------------------------
// Multi-channel variant generation
// ---------------------------------------------------------------------------

const CHANNEL_LIMITS: Record<ChannelVariant["channel"], { maxChars?: number; maxWords?: number; label: string }> = {
  linkedin_connection: { maxChars: 300, label: "LinkedIn Connection Request" },
  linkedin_message: { maxChars: 1900, label: "LinkedIn DM" },
  cold_call: { maxWords: 150, label: "Cold Call Opener" },
  video_script: { maxWords: 200, label: "Video Message Script" },
};

export function buildVariantsSystemPrompt(targetRole?: string): string {
  const roleCtx = targetRole && targetRole !== "General"
    ? `The recipient is a ${targetRole}.`
    : "";

  return `You are an expert B2B sales copywriter. Given email hooks with evidence, generate channel-specific variants.

Rules:
- Each variant must preserve the SAME evidence/signal from the original hook
- LinkedIn Connection Request: ≤300 characters. Casual, curious tone. No pitch.
- LinkedIn DM: ≤1900 characters. Conversational, reference the evidence, ask a question.
- Cold Call Opener: ≤150 words. Verbal/spoken style. Start with name, reference evidence, ask permission to continue.
- Video Script: ≤200 words. Personable, reference evidence, end with clear CTA for a meeting.
${roleCtx}

Return valid JSON array matching this schema exactly:
[
  {
    "hook_index": 0,
    "variants": [
      { "channel": "linkedin_connection", "text": "..." },
      { "channel": "linkedin_message", "text": "..." },
      { "channel": "cold_call", "text": "..." },
      { "channel": "video_script", "text": "..." }
    ]
  }
]

Do NOT include any text outside the JSON array.`;
}

export function buildVariantsUserPrompt(hooks: Hook[]): string {
  const hookDescriptions = hooks.map((h, i) => {
    return `Hook ${i}:
Text: ${h.hook}
Angle: ${h.angle}
Evidence: ${h.evidence_snippet || "N/A"}
Source: ${h.source_title || h.source_url || "N/A"}`;
  }).join("\n\n");

  return `Generate channel variants for each of these ${hooks.length} hooks:\n\n${hookDescriptions}`;
}

export async function generateChannelVariants(
  hooks: Hook[],
  claudeApiKey: string,
  targetRole?: string,
): Promise<HookWithVariants[]> {
  if (hooks.length === 0) return [];

  const systemPrompt = buildVariantsSystemPrompt(targetRole);
  const userPrompt = buildVariantsUserPrompt(hooks);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("generateChannelVariants: no JSON array found in response");
      return hooks.map((h) => ({ ...h, variants: [] }));
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      hook_index: number;
      variants: ChannelVariant[];
    }>;

    return hooks.map((hook, idx) => {
      const entry = parsed.find((p) => p.hook_index === idx);
      const variants = (entry?.variants || []).filter((v) =>
        ["linkedin_connection", "linkedin_message", "cold_call", "video_script"].includes(v.channel),
      );
      return { ...hook, variants };
    });
  } catch (error) {
    console.error("generateChannelVariants: failed", error);
    return hooks.map((h) => ({ ...h, variants: [] }));
  }
}
