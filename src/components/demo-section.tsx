"use client";

import { FormEvent, useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { StructuredHook, HookResponse } from "@/lib/types";
import { CompanySearchInput } from "@/components/company-search-input";

type GeneratedEmail = {
  subject: string;
  body: string;
};

type EmailUIState = {
  loading: boolean;
  error: string | null;
  email: GeneratedEmail | null;
};

type BatchHook = {
  news_item: number;
  angle: "trigger" | "risk" | "tradeoff";
  hook: string;
  evidence_snippet: string;
  source_title: string;
  source_date: string;
  source_url: string;
  evidence_tier: "A" | "B" | "C";
  confidence: "high" | "med" | "low";
};

type BatchItemResult = {
  url: string;
  hooks: BatchHook[];
  error: string | null;
};

function copyToClipboard(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

function AnglePill({ angle }: { angle: string }) {
  const styles: Record<string, string> = {
    trigger: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    risk: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    tradeoff: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[0.6875rem] font-semibold ${styles[angle] || "bg-zinc-500/10 text-zinc-400 border-zinc-600/20"}`}>
      {angle}
    </span>
  );
}

function ConfidencePill({ confidence }: { confidence: string }) {
  const styles: Record<string, string> = {
    high: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    med: "bg-zinc-500/10 text-zinc-400 border-zinc-600/20",
    low: "bg-zinc-500/10 text-zinc-500 border-zinc-700/20",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[0.6875rem] font-semibold ${styles[confidence] || "bg-zinc-500/10 text-zinc-400 border-zinc-600/20"}`}>
      {confidence}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    A: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    B: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    C: "bg-zinc-500/10 text-zinc-500 border-zinc-700/20",
  };
  return (
    <>
      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[0.6875rem] font-bold ${styles[tier] || styles["C"]}`}>
        Tier {tier}
      </span>
      {tier === "B" && (
        <span
          className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-400 cursor-help"
          title="This hook is based on weaker/secondary evidence. We phrase it as a verification question rather than making claims."
        >
          Verification hook
        </span>
      )}
    </>
  );
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Pre-generated sample hooks for the demo (no API call needed)
// Shows the full 4-part structure: trigger → bridge → question → promise
// Targeting VP Sales at Gong, pitch context: "We help outbound teams book more demos using buying signals"
const SAMPLE_HOOKS: { hooks: string[]; structured: StructuredHook[]; company: string; sourceUrl: string; targetRole: string; pitchContext: string } = {
  company: "Shopify",
  sourceUrl: "https://www.modernretail.co/technology/shopify-says-purchases-are-coming-inside-chatgpt-through-agentic-storefronts-as-openai-retreats-on-instant-checkout/",
  targetRole: "VP Sales",
  pitchContext: "We help VP Sales leaders surface pipeline risk before it shows up in the forecast.",
  hooks: [
    "Saw Shopify's announcement about ChatGPT purchases integration. At that growth stage, pipeline visibility usually becomes the constraint before headcount does. How predictable is your sales team's ability to convert AI-driven commerce leads? We help VP Sales leaders surface pipeline risk before it shows up in the forecast.",
    "Noticed Shopify's move into ChatGPT commerce infrastructure. At that growth stage, pipeline visibility usually becomes the constraint before headcount does. What's your current confidence level on next quarter's numbers? We help VP Sales teams call the quarter with confidence.",
  ],
  structured: [
    {
      hook: "Saw Shopify's announcement about ChatGPT purchases integration. At that growth stage, pipeline visibility usually becomes the constraint before headcount does. How predictable is your sales team's ability to convert AI-driven commerce leads? We help VP Sales leaders surface pipeline risk before it shows up in the forecast.",
      angle: "trigger",
      confidence: "med",
      evidence_tier: "A",
      evidence_snippet: "Shopify tells merchants purchases will soon be available 'inside ChatGPT' through agentic storefronts as OpenAI retreats on instant checkout.",
      source_title: "Shopify tells merchants purchases will soon be available 'inside ChatGPT'",
      source_date: "2025",
      source_url: "https://www.modernretail.co/technology/shopify-says-purchases-are-coming-inside-chatgpt-through-agentic-storefronts-as-openai-retreats-on-instant-checkout/",
      news_item: 1,
      psych_mode: "relevance",
      why_this_works: "Major platform shift creates urgency around pipeline predictability for VP Sales",
      promise: "We help VP Sales leaders surface pipeline risk before it shows up in the forecast.",
    },
    {
      hook: "Noticed Shopify's move into ChatGPT commerce infrastructure. At that growth stage, pipeline visibility usually becomes the constraint before headcount does. What's your current confidence level on next quarter's numbers? We help VP Sales teams call the quarter with confidence.",
      angle: "trigger",
      confidence: "med",
      evidence_tier: "A",
      evidence_snippet: "Shopify tells merchants purchases will soon be available 'inside ChatGPT' through agentic storefronts as OpenAI retreats on instant checkout.",
      source_title: "Shopify tells merchants purchases will soon be available 'inside ChatGPT'",
      source_date: "2025",
      source_url: "https://www.modernretail.co/technology/shopify-says-purchases-are-coming-inside-chatgpt-through-agentic-storefronts-as-openai-retreats-on-instant-checkout/",
      news_item: 2,
      psych_mode: "curiosity_gap",
      why_this_works: "Ties major industry signal to the VP Sales pain point of forecast accuracy",
      promise: "We help VP Sales teams call the quarter with confidence.",
    },
  ],
};

const SHARED_EVIDENCE = {
  evidence_snippet: "Shopify tells merchants purchases will soon be available 'inside ChatGPT' through agentic storefronts as OpenAI retreats on instant checkout.",
  source_title: "Shopify tells merchants purchases will soon be available 'inside ChatGPT'",
  source_date: "2025",
  source_url: "https://www.modernretail.co/technology/shopify-says-purchases-are-coming-inside-chatgpt-through-agentic-storefronts-as-openai-retreats-on-instant-checkout/",
  evidence_tier: "A" as const,
  confidence: "med" as const,
};

const SAMPLE_HOOKS_BY_ROLE: Record<string, { hooks: string[]; structured: StructuredHook[] }> = {
  "Any role": {
    hooks: [
      "Saw Shopify's move into ChatGPT commerce — purchases now happening inside AI assistants. Platform shifts like this tend to surface new outreach opportunities before most teams notice. How are you identifying which accounts are most likely to act on this shift? We help outbound teams write personalised opening lines backed by real company signals.",
      "Noticed Shopify partnering with OpenAI to enable in-chat purchases. Platform shifts like this tend to surface new outreach opportunities before most teams notice. Which of your target accounts are likely building AI commerce capabilities right now? We help outbound teams write personalised opening lines backed by real company signals.",
    ],
    structured: [
      { hook: "Saw Shopify's move into ChatGPT commerce — purchases now happening inside AI assistants. Platform shifts like this tend to surface new outreach opportunities before most teams notice. How are you identifying which accounts are most likely to act on this shift? We help outbound teams write personalised opening lines backed by real company signals.", angle: "trigger", psych_mode: "relevance", promise: "We help outbound teams write personalised opening lines backed by real company signals.", why_this_works: "Platform shift creates urgency for outbound teams", news_item: 1, ...SHARED_EVIDENCE },
      { hook: "Noticed Shopify partnering with OpenAI to enable in-chat purchases. Platform shifts like this tend to surface new outreach opportunities before most teams notice. Which of your target accounts are likely building AI commerce capabilities right now? We help outbound teams write personalised opening lines backed by real company signals.", angle: "trigger", psych_mode: "curiosity_gap", promise: "We help outbound teams write personalised opening lines backed by real company signals.", why_this_works: "Curiosity gap on which accounts to prioritise", news_item: 2, ...SHARED_EVIDENCE },
    ],
  },
  "VP Sales": {
    hooks: SAMPLE_HOOKS.hooks,
    structured: SAMPLE_HOOKS.structured,
  },
  "RevOps": {
    hooks: [
      "Saw Shopify's announcement about purchases inside ChatGPT. The same operational discipline driving that platform shift should apply to your pipeline data internally. Is your CRM keeping pace with new commerce attribution signals? We help RevOps eliminate the spreadsheet layer between CRM and reality.",
      "Noticed Shopify moving commerce into AI-native channels. The same operational discipline driving that platform shift should apply to your pipeline data internally. How clean is your attribution data when deals come from new digital channels? We help RevOps build one source of truth for pipeline activity.",
    ],
    structured: [
      { hook: "Saw Shopify's announcement about purchases inside ChatGPT. The same operational discipline driving that platform shift should apply to your pipeline data internally. Is your CRM keeping pace with new commerce attribution signals? We help RevOps eliminate the spreadsheet layer between CRM and reality.", angle: "trigger", psych_mode: "relevance", promise: "We help RevOps eliminate the spreadsheet layer between CRM and reality.", why_this_works: "Ties platform signal to CRM hygiene pain point", news_item: 1, ...SHARED_EVIDENCE },
      { hook: "Noticed Shopify moving commerce into AI-native channels. The same operational discipline driving that platform shift should apply to your pipeline data internally. How clean is your attribution data when deals come from new digital channels? We help RevOps build one source of truth for pipeline activity.", angle: "trigger", psych_mode: "curiosity_gap", promise: "We help RevOps build one source of truth for pipeline activity.", why_this_works: "Attribution accuracy is core RevOps pain", news_item: 2, ...SHARED_EVIDENCE },
    ],
  },
  "SDR Manager": {
    hooks: [
      "Saw Shopify's ChatGPT commerce integration — purchases going AI-native. New channels like this create prospecting territory before rep coaching catches up. Are your reps getting real-time guidance on which accounts to prioritise here? We help SDR managers coach in real-time instead of reviewing last week.",
      "Noticed Shopify enabling in-chat purchases through OpenAI. New channels like this create prospecting territory before rep coaching catches up. How quickly can your team adapt outreach strategy to new signals like this? We help SDR managers cut ramp time by closing the gap between activity and performance.",
    ],
    structured: [
      { hook: "Saw Shopify's ChatGPT commerce integration — purchases going AI-native. New channels like this create prospecting territory before rep coaching catches up. Are your reps getting real-time guidance on which accounts to prioritise here? We help SDR managers coach in real-time instead of reviewing last week.", angle: "trigger", psych_mode: "relevance", promise: "We help SDR managers coach in real-time instead of reviewing last week.", why_this_works: "New channel = coaching gap SDR managers feel immediately", news_item: 1, ...SHARED_EVIDENCE },
      { hook: "Noticed Shopify enabling in-chat purchases through OpenAI. New channels like this create prospecting territory before rep coaching catches up. How quickly can your team adapt outreach strategy to new signals like this? We help SDR managers cut ramp time by closing the gap between activity and performance.", angle: "trigger", psych_mode: "curiosity_gap", promise: "We help SDR managers cut ramp time by closing the gap between activity and performance.", why_this_works: "Adaptation speed is a key SDR manager KPI", news_item: 2, ...SHARED_EVIDENCE },
    ],
  },
  "Marketing": {
    hooks: [
      "Saw Shopify's push into ChatGPT-enabled commerce. Platform moves like this shift which intent signals matter before campaign messaging catches up. Are you capturing intent from teams evaluating new commerce channels? We help marketing teams prove campaign ROI all the way through to booked meetings.",
      "Noticed Shopify partnering with OpenAI on in-chat purchases. Platform moves like this shift which intent signals matter before campaign messaging catches up. Is your messaging keeping up with where buyers are now researching? We help marketing teams see exactly what happens to leads after SDR handoff.",
    ],
    structured: [
      { hook: "Saw Shopify's push into ChatGPT-enabled commerce. Platform moves like this shift which intent signals matter before campaign messaging catches up. Are you capturing intent from teams evaluating new commerce channels? We help marketing teams prove campaign ROI all the way through to booked meetings.", angle: "trigger", psych_mode: "relevance", promise: "We help marketing teams prove campaign ROI all the way through to booked meetings.", why_this_works: "Intent signal timing is a core marketing ops concern", news_item: 1, ...SHARED_EVIDENCE },
      { hook: "Noticed Shopify partnering with OpenAI on in-chat purchases. Platform moves like this shift which intent signals matter before campaign messaging catches up. Is your messaging keeping up with where buyers are now researching? We help marketing teams see exactly what happens to leads after SDR handoff.", angle: "trigger", psych_mode: "curiosity_gap", promise: "We help marketing teams see exactly what happens to leads after SDR handoff.", why_this_works: "Messaging lag is a known pain point for demand gen teams", news_item: 2, ...SHARED_EVIDENCE },
    ],
  },
  "Founder/CEO": {
    hooks: [
      "Saw Shopify's announcement about AI-native commerce through ChatGPT. At that recognition level, the question is usually whether your GTM motion is positioned for where the market is heading. Is your outbound motion adapting to AI-driven buying behaviour before your competitors do? We help founders build GTM predictability at the Series A/B stage.",
      "Noticed Shopify enabling in-chat purchases through OpenAI's platform. At that recognition level, the question is usually whether your GTM motion is positioned for where the market is heading. How are you making sure your current GTM motion captures this shift? We help founders get more from their current GTM motion before the next growth stage.",
    ],
    structured: [
      { hook: "Saw Shopify's announcement about AI-native commerce through ChatGPT. At that recognition level, the question is usually whether your GTM motion is positioned for where the market is heading. Is your outbound motion adapting to AI-driven buying behaviour before your competitors do? We help founders build GTM predictability at the Series A/B stage.", angle: "trigger", psych_mode: "relevance", promise: "We help founders build GTM predictability at the Series A/B stage.", why_this_works: "Competitive positioning is top of mind for founders at scale", news_item: 1, ...SHARED_EVIDENCE },
      { hook: "Noticed Shopify enabling in-chat purchases through OpenAI's platform. At that recognition level, the question is usually whether your GTM motion is positioned for where the market is heading. How are you making sure your current GTM motion captures this shift? We help founders get more from their current GTM motion before the next growth stage.", angle: "trigger", psych_mode: "curiosity_gap", promise: "We help founders get more from their current GTM motion before the next growth stage.", why_this_works: "GTM efficiency is a founder's primary lever pre-Series B", news_item: 2, ...SHARED_EVIDENCE },
    ],
  },
};

// Style-specific hooks keyed by [style][role]. Falls back to SAMPLE_HOOKS_BY_ROLE for roles not listed.
const SAMPLE_HOOKS_BY_STYLE: Partial<Record<string, Partial<Record<string, { hooks: string[]; structured: StructuredHook[] }>>>> = {
  challenger: {
    "VP Sales": {
      hooks: [
        "Saw Shopify's move into ChatGPT commerce. Most VP Sales teams scaling post-Series B assume pipeline is a headcount problem before it's a visibility problem — is that the assumption you're working from? We help VP Sales leaders surface pipeline risk before it shows up in the forecast.",
      ],
      structured: [
        { hook: "Saw Shopify's move into ChatGPT commerce. Most VP Sales teams scaling post-Series B assume pipeline is a headcount problem before it's a visibility problem — is that the assumption you're working from? We help VP Sales leaders surface pipeline risk before it shows up in the forecast.", angle: "tradeoff", psych_mode: "contrarian", promise: "We help VP Sales leaders surface pipeline risk before it shows up in the forecast.", why_this_works: "Challenges the assumption that headcount solves pipeline — reframes the constraint as visibility", news_item: 1, ...SHARED_EVIDENCE },
      ],
    },
  },
  implication: {
    "VP Sales": {
      hooks: [
        "Saw Shopify's move into ChatGPT commerce. When coaching relies on weekly reviews instead of live signals, how much pipeline risk do you only find out about at forecast? We help VP Sales leaders surface pipeline risk before it shows up in the forecast.",
      ],
      structured: [
        { hook: "Saw Shopify's move into ChatGPT commerce. When coaching relies on weekly reviews instead of live signals, how much pipeline risk do you only find out about at forecast? We help VP Sales leaders surface pipeline risk before it shows up in the forecast.", angle: "risk", psych_mode: "symptom", promise: "We help VP Sales leaders surface pipeline risk before it shows up in the forecast.", why_this_works: "Amplifies the downstream consequence — pipeline risk surfaces too late at forecast", news_item: 1, ...SHARED_EVIDENCE },
      ],
    },
  },
  risk: {
    "VP Sales": {
      hooks: [
        "Saw Shopify's move into ChatGPT commerce. Without rep-level signal visibility, every forecast conversation starts from last week's data — what's that costing you in sandbagging right now? We help VP Sales leaders surface pipeline risk before it shows up in the forecast.",
      ],
      structured: [
        { hook: "Saw Shopify's move into ChatGPT commerce. Without rep-level signal visibility, every forecast conversation starts from last week's data — what's that costing you in sandbagging right now? We help VP Sales leaders surface pipeline risk before it shows up in the forecast.", angle: "risk", psych_mode: "tradeoff_frame", promise: "We help VP Sales leaders surface pipeline risk before it shows up in the forecast.", why_this_works: "Frames the cost of inaction — stale data drives sandbagging, which costs pipeline confidence", news_item: 1, ...SHARED_EVIDENCE },
      ],
    },
  },
};

const ROLE_PITCH_DEFAULTS: Record<string, string> = {
  "Any role":    "We help B2B sales teams write personalised opening lines backed by real company signals.",
  "VP Sales":    "We help VP Sales leaders surface pipeline risk before it shows up in the forecast.",
  "RevOps":      "We help RevOps eliminate the spreadsheet layer between CRM and pipeline reality.",
  "SDR Manager": "We help SDR managers coach in real-time instead of reviewing last week.",
  "Marketing":   "We help marketing teams prove campaign ROI all the way through to booked meetings.",
  "Founder/CEO": "We help founders get more from their current GTM motion before the next growth stage.",
};

const ROLE_QUICK_ANGLES: Record<string, { label: string; value: string }[]> = {
  "Any role": [
    { label: "Book more demos",     value: "We help outbound teams turn more first replies into booked demos without doubling headcount." },
    { label: "Revive closed-lost",  value: "We help you re-engage closed-lost accounts with something more specific than the usual 'just checking in' email." },
    { label: "Upsell customers",    value: "We help account teams find upsell opportunities in existing customers based on product usage patterns." },
    { label: "Partner pipeline",    value: "We help teams turn existing partnerships into a real, repeatable source of new pipeline." },
  ],
  "VP Sales": [
    { label: "Surface pipeline risk", value: "We help VP Sales leaders surface pipeline risk before it shows up in the forecast." },
    { label: "Call the quarter",      value: "We help VP Sales teams call the quarter with confidence." },
    { label: "Forecast accuracy",     value: "We help VP Sales teams build forecast accuracy that doesn't rely on rep check-ins." },
    { label: "Deal velocity",         value: "We help VP Sales teams accelerate deal velocity without adding headcount." },
  ],
  "RevOps": [
    { label: "One source of truth",  value: "We help RevOps teams build one source of truth for pipeline activity." },
    { label: "CRM vs reality",       value: "We help RevOps eliminate the spreadsheet layer between CRM and reality." },
    { label: "Attribution gap",      value: "We help RevOps close the attribution gap between MQL and booked revenue." },
    { label: "Stack governance",     value: "We help RevOps reduce tool sprawl without sacrificing pipeline visibility." },
  ],
  "SDR Manager": [
    { label: "Real-time coaching",   value: "We help SDR managers coach in real-time instead of reviewing last week." },
    { label: "Ramp time",            value: "We help SDR managers cut ramp time by closing the gap between activity and performance." },
    { label: "Reply rates",          value: "We help SDR managers get more replies from first-touch outreach." },
    { label: "Territory coverage",   value: "We help SDR managers spot coverage gaps before they show up in the forecast." },
  ],
  "Marketing": [
    { label: "Lead quality",         value: "We help marketing teams improve ICP fit on inbound leads before they hit the CRM." },
    { label: "Prove ROI",            value: "We help marketing teams prove campaign ROI all the way through to booked meetings." },
    { label: "SDR handoff",          value: "We help marketing teams see exactly what happens to leads after SDR handoff." },
    { label: "Intent signals",       value: "We help marketing teams capture intent signals before competitors act on them." },
  ],
  "Founder/CEO": [
    { label: "GTM efficiency",       value: "We help founders get more from their current GTM motion before the next growth stage." },
    { label: "CAC payback",          value: "We help founders reduce CAC payback period without growing headcount." },
    { label: "Series A/B GTM",       value: "We help founders build GTM predictability at the Series A/B stage." },
    { label: "Revenue per SDR",      value: "We help founders increase revenue per SDR before the next hire." },
  ],
};


function DemoEmailGate({ onDismiss }: { onDismiss: () => void }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the gate card into view when it appears
    dialogRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/demo-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (data?.redirect) {
        router.push(data.redirect);
      }
    } catch {
      // ignore — still dismiss
    } finally {
      setSubmitting(false);
    }
  }

  const prefersReducedMotion = typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      ref={dialogRef}
      role="region"
      aria-label="Get more hooks"
      className={`mt-5 rounded-xl border border-violet-500/30 bg-[#111118] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.5)] ${prefersReducedMotion ? "" : "animate-gate-in"}`}
      style={prefersReducedMotion ? undefined : { animation: "gateSlideIn 0.25s ease-out both" }}
    >
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-violet-400 mb-1">Your hook is ready.</p>
      <h3 className="text-[1.125rem] font-bold text-white mb-1.5">Get 10 more — free.</h3>
      <p className="text-[0.8125rem] text-zinc-400 mb-4">Enter your email to keep going.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="gate-email" className="sr-only">Email address</label>
        <input
          id="gate-email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          className="h-11 w-full rounded-lg border border-white/10 bg-[#0d0d16] px-4 text-[0.9375rem] text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
        />
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="h-11 w-full rounded-lg bg-violet-600 text-[0.9375rem] font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Redirecting..." : "Get started →"}
        </button>
      </form>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 w-full text-[0.8125rem] text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        Skip for now
      </button>
      <style>{`
        @keyframes gateSlideIn {
          from { opacity: 0; transform: translateY(1rem); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export function DemoSection() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [companyUrl, setCompanyUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [resolvedCompanyLabel, setResolvedCompanyLabel] = useState<string | null>(null);
  const [pitchContext, setPitchContext] = useState(SAMPLE_HOOKS.pitchContext);
  const [lastRoleDefault, setLastRoleDefault] = useState(SAMPLE_HOOKS.pitchContext);
  const [pitchExpanded, setPitchExpanded] = useState(false);
  const [targetRole, setTargetRole] = useState(SAMPLE_HOOKS.targetRole);
  const [messagingStyle, setMessagingStyle] = useState<string>("evidence");
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [showingSample, setShowingSample] = useState(true);

  const [hooks, setHooks] = useState<string[]>(SAMPLE_HOOKS.hooks);
  const [structuredHooks, setStructuredHooks] = useState<
    StructuredHook[] | null
  >(SAMPLE_HOOKS.structured);
  const [emailByIndex, setEmailByIndex] = useState<Record<number, EmailUIState>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyCandidates, setCompanyCandidates] = useState<
    HookResponse["candidates"]
  >();
  const [companyStatus, setCompanyStatus] = useState<HookResponse["status"]>();

  const [showUrlInput, setShowUrlInput] = useState(false);

  const [batchInput, setBatchInput] = useState("");
  const [batchResults, setBatchResults] = useState<BatchItemResult[] | null>(
    null,
  );
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingRole, setTypingRole] = useState<string | null>(null);

  useEffect(() => {
    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current); };
  }, []);

  function typeText(text: string, role: string) {
    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setPitchContext(text);
      setIsTyping(false);
      setTypingRole(null);
      return;
    }
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    setPitchContext("");
    setIsTyping(true);
    setTypingRole(role);
    let i = 0;
    typewriterRef.current = setInterval(() => {
      if (i < text.length) { setPitchContext(text.slice(0, i + 1)); i++; }
      else { clearInterval(typewriterRef.current!); setIsTyping(false); setTypingRole(null); }
    }, 18);
  }

  async function fetchHooks(params: {
    url?: string;
    companyName?: string;
    context?: string;
  }) {
    setIsLoading(true);
    setError(null);
    setHooks([]);
    setStructuredHooks(null);
    setShowingSample(false);
    setEmailByIndex({});
    setCompanyCandidates(undefined);
    setCompanyStatus(undefined);
    setResolvedCompanyLabel(null);

    try {
      const response = await fetch("/api/generate-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: params.url,
          companyName: params.companyName,
          context: params.context?.trim() || undefined,
          targetRole: targetRole !== "Any role" ? targetRole : undefined,
          messagingStyle: messagingStyle !== "evidence" ? messagingStyle : undefined,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | HookResponse
        | null;

      if (!response.ok || !data) {
        const message = data?.error || (data as any)?.message || "Failed to generate hooks.";
        throw new Error(message);
      }

      // Handle company name resolution states
      if (data.status === "no_match") {
        setCompanyStatus(data.status);
        setCompanyCandidates(data.candidates);
        setError(
          data.error ||
            (params.companyName
              ? `Could not find a clear match for "${params.companyName}". Try pasting the URL instead.`
              : "Could not resolve this company. Try pasting the URL instead."),
        );
        return;
      }

      if (data.status === "needs_disambiguation") {
        setCompanyStatus(data.status);
        setCompanyCandidates(data.candidates);
        setError(null);
        return;
      }

      setHooks(data.hooks || []);
      setStructuredHooks(data.structured_hooks ?? null);
      if ((data.hooks?.length ?? 0) > 0) {
        setPitchExpanded(true);
      }

      // Show email gate for anon users after 3rd real generation (once per session)
      if (!isAuthenticated && (data.hooks?.length ?? 0) > 0) {
        const alreadyShown = typeof sessionStorage !== "undefined" && sessionStorage.getItem("demo_gate_shown");
        if (!alreadyShown) {
          const prevCount = parseInt(sessionStorage.getItem("demo_gen_count") || "0", 10);
          const newCount = prevCount + 1;
          sessionStorage.setItem("demo_gen_count", String(newCount));
          if (newCount >= 3) {
            sessionStorage.setItem("demo_gate_shown", "1");
            setShowEmailGate(true);
          }
        }
      }

      if (data.resolvedCompany) {
        const label = `${data.resolvedCompany.name} (${data.resolvedCompany.url})`;
        setResolvedCompanyLabel(label);
        // Persist the resolved URL so follow-up actions (like email generation)
        // can rely on a concrete company URL.
        setCompanyUrl(data.resolvedCompany.url);
      }

      if (!data.hooks || data.hooks.length === 0) {
        setError(
          data.suggestion
            ? data.suggestion
            : "No signals found from this URL. Try pasting a TechCrunch article, GetLatka page, or press release about this company instead.",
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedUrl = companyUrl.trim();
    const trimmedName = companyName.trim();

    if (!trimmedUrl && !trimmedName) {
      setError("Enter a company URL or company name to get started.");
      return;
    }

    const normalizedUrl = trimmedUrl
      ? trimmedUrl.match(/^https?:\/\//) ? trimmedUrl : `https://${trimmedUrl}`
      : undefined;

    await fetchHooks({
      url: normalizedUrl,
      companyName: !trimmedUrl ? trimmedName || undefined : undefined,
      context: pitchContext,
    });
  }

  async function handleGenerateEmail(index: number) {
    const hookPayload = structuredHooks?.[index];
    const trimmedUrl = companyUrl.trim();

    if (!trimmedUrl) {
      setEmailByIndex((prev) => ({
        ...prev,
        [index]: {
          loading: false,
          error: "Please enter a company URL first.",
          email: null,
        },
      }));
      return;
    }

    if (!hookPayload) {
      setEmailByIndex((prev) => ({
        ...prev,
        [index]: {
          loading: false,
          error:
            "Email generation is only available when structured hooks are present.",
          email: null,
        },
      }));
      return;
    }

    setEmailByIndex((prev) => ({
      ...prev,
      [index]: {
        loading: true,
        error: null,
        email: null,
      },
    }));

    try {
      const response = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyUrl: trimmedUrl,
          hook: hookPayload,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { email?: GeneratedEmail; error?: string }
        | null;

      if (!response.ok || !data || !data.email) {
        const message =
          data?.error || "Failed to generate email for this hook.";
        throw new Error(message);
      }

      setEmailByIndex((prev) => ({
        ...prev,
        [index]: {
          loading: false,
          error: null,
          email: data.email!,
        },
      }));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the email.";
      setEmailByIndex((prev) => ({
        ...prev,
        [index]: {
          loading: false,
          error: message,
          email: null,
        },
      }));
    }
  }

  async function handleBatchSubmit(event: FormEvent) {
    event.preventDefault();

    const urls = batchInput
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setBatchError("Please enter at least one company URL.");
      return;
    }

    if (urls.length > 20) {
      setBatchError("Limit is 20 URLs at a time.");
      return;
    }

    setBatchError(null);
    setIsBatchLoading(true);
    setBatchResults(null);

    try {
      const response = await fetch("/api/generate-hooks-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: urls.map((url) => ({ url })),
          maxHooksPerUrl: 3,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        const message =
          data?.error || "Failed to generate hooks for the batch.";
        throw new Error(message);
      }

      const data = (await response.json()) as { results?: BatchItemResult[] };
      setBatchResults(data.results ?? null);

      if (!data.results || data.results.length === 0) {
        setBatchError("No hooks were generated. Try again with different URLs.");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while generating hooks.";
      setBatchError(message);
    } finally {
      setIsBatchLoading(false);
    }
  }

  return (
    <section id="demo" className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <div className="mx-auto mb-14 max-w-xl text-center">
          <p className="mb-4 text-[0.9375rem] font-semibold text-amber-500">
            Live demo
          </p>
          <h2 className="text-[clamp(2.25rem,3.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white">
            Try it now (3 generations/day)
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-zinc-400">
            Paste a company URL or a news article about them, pick a role, and get hooks with receipts you can copy into outbound.
          </p>
        </div>

        {/* Main demo card with gradient background */}
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-[#0d0d1a] via-[#0f0f16] to-[#0c0c12] p-px shadow-[0_4px_40px_rgba(0,0,0,0.4),0_0_80px_rgba(139,92,246,0.05)]">
          <div className="rounded-[11px] bg-gradient-to-br from-[#0f0f1a] via-[#111118] to-[#0e0e14] p-6 sm:p-8">
            {/* Mode toggle */}
            <div className="mb-6 flex gap-1.5 rounded-lg bg-[#0a0a12] p-1 text-[0.8125rem]">
              <button
                type="button"
                onClick={() => {
                  setMode("single");
                  setError(null);
                }}
                className={`flex-1 rounded-md px-3 py-2 font-medium transition-all duration-200 ${mode === "single" ? "bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]" : "bg-transparent text-zinc-400 hover:text-zinc-200"}`}
              >
                Single company
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("batch");
                  setBatchError(null);
                }}
                className={`flex-1 rounded-md px-3 py-2 font-medium transition-all duration-200 ${mode === "batch" ? "bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]" : "bg-transparent text-zinc-400 hover:text-zinc-200"}`}
              >
                Batch mode
              </button>
            </div>

            {mode === "single" && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Company search */}
                <div>
                  <label htmlFor="company-search" className="mb-2 block text-[0.8125rem] font-medium text-zinc-400">
                    Who are you targeting?
                  </label>
                  <CompanySearchInput
                    onSourceSelected={(sourceUrl, name) => {
                      setCompanyUrl(sourceUrl);
                      setCompanyName(name);
                      fetchHooks({ url: sourceUrl, companyName: name, context: pitchContext });
                    }}
                    onCompanyNameChange={(name) => {
                      setCompanyName(name);
                      setCompanyUrl("");
                    }}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[0.8125rem] font-medium text-zinc-400">
                    Who are you emailing?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["Any role", "VP Sales", "RevOps", "SDR Manager", "Marketing", "Founder/CEO"].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setTargetRole(role);
                          const newDefault = ROLE_PITCH_DEFAULTS[role];
                          // Only auto-apply if pitch hasn't been customised beyond the last role default
                          if (pitchContext === lastRoleDefault || pitchContext === "") {
                            setPitchContext(newDefault);
                            typeText(newDefault, role);
                          }
                          setLastRoleDefault(newDefault);
                          if (showingSample) {
                            const styleHooks = SAMPLE_HOOKS_BY_STYLE[messagingStyle]?.[role];
                            const roleHooks = styleHooks ?? SAMPLE_HOOKS_BY_ROLE[role] ?? SAMPLE_HOOKS_BY_ROLE["Any role"];
                            setHooks(roleHooks.hooks);
                            setStructuredHooks(roleHooks.structured);
                          }
                        }}
                        className={`rounded-md px-3 py-1.5 sm:py-1 text-[0.75rem] font-medium border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0f0f1a] ${
                          targetRole === role
                            ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                            : "bg-[#111119] border-white/[0.06] text-zinc-400 hover:border-violet-500/30 hover:text-zinc-200"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[0.8125rem] font-medium text-zinc-400">
                    Messaging style
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "evidence", label: "Evidence" },
                      { value: "challenger", label: "Challenger" },
                      { value: "implication", label: "Implication" },
                      { value: "risk", label: "Risk" },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setMessagingStyle(value);
                          if (showingSample) {
                            const styleHooks = SAMPLE_HOOKS_BY_STYLE[value]?.[targetRole];
                            const roleHooks = styleHooks ?? SAMPLE_HOOKS_BY_ROLE[targetRole] ?? SAMPLE_HOOKS_BY_ROLE["Any role"];
                            setHooks(roleHooks.hooks);
                            setStructuredHooks(roleHooks.structured);
                          }
                        }}
                        className={`rounded-md px-3 py-1.5 sm:py-1 text-[0.75rem] font-medium border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0f0f1a] ${
                          messagingStyle === value
                            ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                            : "bg-[#111119] border-white/[0.06] text-zinc-400 hover:border-violet-500/30 hover:text-zinc-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-white shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_32px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f1a] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <>
                      <Spinner />
                      Generating...
                    </>
                  ) : (
                    <>
                      {hooks.length > 0 && !showingSample ? "Regenerate" : "Generate hooks"}
                      <svg
                        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                        />
                      </svg>
                    </>
                  )}
                </button>

                {error && (
                  <p className="text-[0.875rem] text-red-400">{error}</p>
                )}

                {companyStatus === "needs_disambiguation" && companyCandidates && (
                  <div className="mt-4 rounded-lg border border-violet-500/30 bg-[#0b0b13] p-4 text-[0.875rem] text-zinc-200">
                    <p className="mb-2 font-medium text-violet-200">
                      Did you mean one of these companies?
                    </p>
                    <ul className="space-y-2">
                      {companyCandidates.map((candidate) => (
                        <li
                          key={candidate.id}
                          className="rounded-md border border-white/10 bg-[#111119] p-3"
                       >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[0.875rem] font-semibold text-zinc-100">
                                {candidate.name}
                              </p>
                              <p className="text-[0.8125rem] text-zinc-500">
                                {candidate.url}
                              </p>
                              {candidate.description && (
                                <p className="mt-1 text-[0.75rem] text-zinc-500">
                                  {candidate.description}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                fetchHooks({
                                  url: candidate.url,
                                  context: pitchContext,
                                })
                              }
                              className="mt-2 inline-flex items-center justify-center rounded-md bg-violet-600 px-3 py-1.5 text-[0.75rem] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_14px_rgba(139,92,246,0.35)] sm:mt-0"
                            >
                              Use this company
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {resolvedCompanyLabel && (
                  <p className="mt-3 text-[0.8125rem] text-zinc-400">
                    Using <span className="font-medium text-zinc-100">{resolvedCompanyLabel}</span> based on your input.
                  </p>
                )}
              </form>
            )}

            {mode === "single" && (
              <div aria-live="polite" aria-atomic="false" className="mt-8 border-t border-white/[0.06] pt-6">
                {isLoading && (
                  <div className="flex items-center justify-center gap-3 py-4 text-[0.9375rem] text-zinc-400">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                    Gathering context and drafting hooks...
                  </div>
                )}

                {showingSample && hooks.length > 0 && (
                  <div className="mb-4 flex items-center gap-2 text-[0.8125rem]">
                    <span className="rounded-full bg-violet-600/20 border border-violet-500/30 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-violet-300">
                      Sample
                    </span>
                    <span className="text-zinc-400">
                      Showing pre-generated hooks for <span className="font-medium text-zinc-200">{SAMPLE_HOOKS.company}</span>{" "}
                      from{" "}
                      <a href={SAMPLE_HOOKS.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400/80 underline decoration-violet-500/20 hover:text-violet-300 transition-colors">
                        {SAMPLE_HOOKS.sourceUrl.replace("https://", "")}
                      </a>
                      . Enter your own company URL above to generate fresh hooks.
                    </span>
                  </div>
                )}

                {!isLoading && hooks.length > 0 && !showingSample && resolvedCompanyLabel && (
                  <p className="mb-3 text-[0.8125rem] text-zinc-400">
                    Here are your hooks for{" "}
                    <span className="font-semibold text-zinc-100">
                      {resolvedCompanyLabel.split(" (")[0]}
                    </span>
                  </p>
                )}

                {!isLoading && hooks.length > 0 && (
                  <ul key={targetRole} className="flex flex-col gap-3">
                    {hooks.map((hook, index) => {
                      const structured = structuredHooks?.[index] ?? null;
                      const emailState = emailByIndex[index];

                      return (
                        <li
                          key={index}
                          className="animate-fade-in-up group rounded-xl border border-white/[0.06] bg-gradient-to-br from-[#131320]/80 to-[#111118]/60 p-5 transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_20px_rgba(139,92,246,0.06)] hover:-translate-y-0.5"
                          style={{ animationDelay: `${index * 80}ms` }}

                        >
                          <div className="mb-2.5 flex items-center justify-between gap-3">
                            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-violet-400/60 transition-colors duration-200 group-hover:text-violet-400">
                              Hook {index + 1}
                            </div>
                            {structured && (
                              <div className="flex items-center gap-1.5">
                                <AnglePill angle={structured.angle} />
                                <ConfidencePill confidence={structured.confidence} />
                                {structured.evidence_tier && (
                                  <TierBadge tier={structured.evidence_tier} />
                                )}
                              </div>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-[0.9375rem] leading-[1.65] text-zinc-200">
                            {hook}
                          </p>

                          {structured?.promise && (
                            <p className="mt-2 mb-1 text-[0.75rem] text-zinc-500">
                              <span className="font-medium text-zinc-300">Promise:</span> {structured.promise}
                            </p>
                          )}

                          {/* Evidence panel */}
                          {structured && structured.evidence_snippet && (
                            <div className="mt-4 rounded-lg border border-violet-500/10 bg-[#0e0d1a] px-4 py-3 text-[0.75rem] text-zinc-400">
                              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-violet-400/60">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Evidence
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(hook)}
                                    className="rounded-md border border-white/10 bg-[#0a0a12] px-2.5 py-1 text-[0.6875rem] font-medium text-zinc-300 transition-all duration-200 hover:border-violet-500/40 hover:text-white hover:scale-[1.02]"
                                  >
                                    Copy for email
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(
                                        `Hook:\n${hook}\n\nEvidence:\n"${structured.evidence_snippet}"\n— ${structured.source_title}`,
                                      )
                                    }
                                    className="rounded-md border border-violet-500/30 bg-violet-600/[0.08] px-2.5 py-1 text-[0.6875rem] font-medium text-violet-300 transition-all duration-200 hover:border-violet-400/50 hover:text-white hover:scale-[1.02]"
                                  >
                                    Copy with receipts
                                  </button>
                                </div>
                              </div>
                              <p className="text-[0.8125rem] leading-relaxed text-zinc-300/80">
                                {structured.evidence_snippet}
                              </p>
                              {structured.source_title && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-zinc-500">
                                  <span>
                                    Source:{" "}
                                    {structured.source_url ? (
                                      <a
                                        href={structured.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-violet-400/70 underline decoration-violet-500/20 transition-colors hover:text-violet-300"
                                      >
                                        {structured.source_title}
                                      </a>
                                    ) : (
                                      structured.source_title
                                    )}
                                  </span>
                                  {structured.source_date && (
                                    <span className="text-zinc-600">
                                      {structured.source_date}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Email generate button */}
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              type="button"
                              onClick={() => handleGenerateEmail(index)}
                              disabled={!structured || emailState?.loading}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-600/40 bg-violet-600/[0.08] px-4 py-2 text-[0.75rem] font-semibold text-violet-300 transition-all duration-200 hover:border-violet-500/60 hover:bg-violet-600/[0.15] hover:text-white hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                            >
                              {emailState?.loading ? (
                                <>
                                  <Spinner className="h-3 w-3" />
                                  Generating email...
                                </>
                              ) : (
                                "Generate email"
                              )}
                            </button>
                            {emailState?.error && (
                              <p className="text-[0.75rem] text-red-400">
                                {emailState.error}
                              </p>
                            )}
                          </div>

                          {/* Email result */}
                          {emailState?.email && (
                            <div className="animate-fade-in-up mt-4 rounded-lg border border-violet-500/20 bg-gradient-to-br from-[#12101e] to-[#0f0d18] px-4 py-3 text-[0.8125rem] text-zinc-100">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="font-semibold text-violet-200">
                                  {emailState.email.subject}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      `${emailState.email!.subject}\n\n${emailState.email!.body}`,
                                    )
                                  }
                                  className="shrink-0 rounded-md border border-violet-600/40 bg-[#0a0a12] px-2.5 py-1 text-[0.6875rem] font-medium text-violet-200 transition-all duration-200 hover:border-violet-400 hover:text-white hover:scale-[1.02]"
                                >
                                  Copy email
                                </button>
                              </div>
                              <p className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-zinc-300">
                                {emailState.email.body}
                              </p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Pitch toggle button — only visible when hooks are showing */}
                {hooks.length > 0 && (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setPitchExpanded((v) => !v)}
                      className="text-[0.8125rem] font-medium text-zinc-500 transition-colors hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f1a]"
                    >
                      {pitchExpanded ? "← Hide pitch" : "Customise pitch →"}
                    </button>
                  </div>
                )}

                {/* Pitch customisation section — shown below hooks */}
                {hooks.length > 0 && pitchExpanded && (
                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <label htmlFor="pitch-context" className="block text-[0.8125rem] font-medium text-zinc-400">
                        Your pitch{" "}
                        <span className="text-zinc-600">(what do you sell?)</span>
                      </label>
                      {isTyping && typingRole && (
                        <span className="animate-fade-in text-[0.75rem] font-medium text-violet-400/80">
                          ✦ Tailoring for {typingRole}...
                        </span>
                      )}
                    </div>
                    <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[0.75rem] text-zinc-600">
                        Quick angles{targetRole !== "Any role" ? ` for ${targetRole}` : ""}:
                      </span>
                      {(ROLE_QUICK_ANGLES[targetRole] ?? ROLE_QUICK_ANGLES["Any role"]).map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setPitchContext(preset.value)}
                          className="rounded-md bg-[#111119] px-2.5 py-1 text-[0.75rem] font-medium text-zinc-400 border border-white/[0.06] transition-all duration-200 hover:border-violet-500/30 hover:text-zinc-200 hover:shadow-[0_1px_6px_rgba(139,92,246,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0f0f1a]"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      id="pitch-context"
                      placeholder="e.g. We help B2B SaaS teams reduce churn with better onboarding..."
                      value={pitchContext}
                      onChange={(event) => setPitchContext(event.target.value)}
                      rows={3}
                      className={`w-full rounded-lg border bg-[#111119] px-4 py-3 text-[0.9375rem] text-zinc-50 outline-none transition-all duration-200 placeholder:text-zinc-600 focus:shadow-[0_0_16px_rgba(139,92,246,0.08)] resize-none cursor-text ${isTyping ? "border-violet-500/40 ring-1 ring-violet-500/40 shadow-[0_0_12px_rgba(139,92,246,0.1)]" : "border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"}`}
                    />
                  </div>
                )}

                {/* Email gate — inline card below hooks (not an overlay) */}
                {showEmailGate && (
                  <DemoEmailGate onDismiss={() => setShowEmailGate(false)} />
                )}
              </div>
            )}

            {mode === "batch" && (
              <form onSubmit={handleBatchSubmit} className="flex flex-col gap-5">
                <div>
                  <label htmlFor="batch-urls" className="mb-2 block text-[0.8125rem] font-medium text-zinc-400">
                    Company URLs
                  </label>
                  <textarea
                    id="batch-urls"
                    placeholder="One URL per line, up to 20.\nhttps://acme.com\nhttps://contoso.com"
                    value={batchInput}
                    onChange={(event) => setBatchInput(event.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-white/10 bg-[#111119] px-4 py-3 text-[0.9375rem] text-zinc-50 outline-none transition-all duration-200 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:shadow-[0_0_16px_rgba(139,92,246,0.08)] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isBatchLoading}
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-white shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_32px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f1a] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isBatchLoading ? (
                    <>
                      <Spinner />
                      Generating batch hooks...
                    </>
                  ) : (
                    <>
                      Generate hooks
                      <svg
                        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                        />
                      </svg>
                    </>
                  )}
                </button>

                {batchError && (
                  <p className="text-[0.875rem] text-red-400">{batchError}</p>
                )}

                {batchResults && (
                  <div className="mt-6 border-t border-white/[0.06] pt-5">
                    <ul className="flex flex-col gap-4">
                      {batchResults.map((item, idx) => (
                        <li
                          key={`${item.url}-${idx}`}
                          className="animate-fade-in-up rounded-xl border border-white/[0.06] bg-gradient-to-br from-[#131320]/80 to-[#111118]/60 p-5 transition-all duration-300 hover:border-violet-500/15 hover:shadow-[0_4px_20px_rgba(139,92,246,0.05)] hover:-translate-y-0.5"
                        >
                          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[0.875rem] font-semibold text-zinc-100">
                              {item.url || "(missing URL)"}
                            </p>
                            {item.error ? (
                              <span className="text-[0.8125rem] text-red-400">
                                {item.error}
                              </span>
                            ) : (
                              <span className="text-[0.75rem] text-zinc-500">
                                {item.hooks.length} hook
                                {item.hooks.length === 1 ? "" : "s"} generated
                              </span>
                            )}
                          </div>

                          {!item.error && item.hooks.length > 0 && (
                            <ul className="mt-2 flex flex-col gap-2">
                              {item.hooks.map((hook, hIdx) => (
                                <li
                                  key={hIdx}
                                  className="rounded-lg border border-white/[0.06] bg-[#0e0e16] p-3.5 transition-all duration-200 hover:border-violet-500/15"
                                >
                                  <div className="mb-1.5 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-violet-400/70">
                                        Hook {hIdx + 1}
                                      </span>
                                      <AnglePill angle={hook.angle} />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <ConfidencePill confidence={hook.confidence} />
                                      {hook.evidence_tier && (
                                        <TierBadge tier={hook.evidence_tier} />
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-[0.875rem] leading-relaxed text-zinc-200">
                                    {hook.hook}
                                  </p>
                                  {hook.evidence_snippet && (
                                    <div className="mt-2.5 rounded-md border border-violet-500/10 bg-[#0c0b16] px-3 py-2">
                                      <div className="mb-1 flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-violet-400/50">
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Evidence
                                      </div>
                                      <p className="text-[0.75rem] leading-relaxed text-zinc-400">
                                        {hook.evidence_snippet}
                                      </p>
                                      {hook.source_title && (
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-zinc-500">
                                          <span>
                                            Source:{" "}
                                            {hook.source_url ? (
                                              <a
                                                href={hook.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-violet-400/60 underline decoration-violet-500/20 transition-colors hover:text-violet-300"
                                              >
                                                {hook.source_title}
                                              </a>
                                            ) : (
                                              hook.source_title
                                            )}
                                          </span>
                                          {hook.source_date && (
                                            <span className="text-zinc-600">
                                              {hook.source_date}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(hook.hook)}
                                      className="rounded-md border border-white/10 bg-[#0a0a12] px-2.5 py-1 text-[0.6875rem] font-medium text-zinc-300 transition-all duration-200 hover:border-violet-500/40 hover:text-white hover:scale-[1.02]"
                                    >
                                      Copy hook
                                    </button>
                                    {hook.evidence_snippet && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          copyToClipboard(
                                            `Hook:\n${hook.hook}\n\nEvidence:\n"${hook.evidence_snippet}"\n— ${hook.source_title}`,
                                          )
                                        }
                                        className="rounded-md border border-violet-500/30 bg-violet-600/[0.08] px-2.5 py-1 text-[0.6875rem] font-medium text-violet-300 transition-all duration-200 hover:border-violet-400/50 hover:text-white hover:scale-[1.02]"
                                      >
                                        Copy with receipts
                                      </button>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
