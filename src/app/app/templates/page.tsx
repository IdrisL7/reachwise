"use client";

import { useState } from "react";

interface Template {
  id: string;
  industry: string;
  name: string;
  hook: string;
  angle: "trigger" | "risk" | "tradeoff";
  description: string;
}

const TEMPLATES: Template[] = [
  // SaaS
  {
    id: "saas-1",
    industry: "SaaS",
    name: "New funding round",
    hook: "You just closed your Series B — are you scaling outbound before your board review in Q3, or waiting until pipeline proves itself?",
    angle: "tradeoff",
    description: "Use when a SaaS company has recently raised funding. The tradeoff angle forces a decision.",
  },
  {
    id: "saas-2",
    industry: "SaaS",
    name: "Hiring surge",
    hook: "You're hiring 12 SDRs this quarter — what happens if their ramp time doubles because the messaging hasn't been pressure-tested?",
    angle: "risk",
    description: "Hiring signals indicate growth. The risk angle highlights what could go wrong without action.",
  },
  {
    id: "saas-3",
    industry: "SaaS",
    name: "Product launch",
    hook: "Your new enterprise tier just went live — are outbound sequences already targeting the ICP shift, or is the team still using the old playbook?",
    angle: "trigger",
    description: "A product launch creates urgency. The trigger angle connects the event to an action.",
  },
  // Fintech
  {
    id: "fin-1",
    industry: "Fintech",
    name: "Regulatory change",
    hook: "The new PSD3 draft drops in September — is your compliance team building the partner shortlist now, or scrambling after the deadline?",
    angle: "tradeoff",
    description: "Regulatory deadlines create urgency. The tradeoff forces a timing decision.",
  },
  {
    id: "fin-2",
    industry: "Fintech",
    name: "Market expansion",
    hook: "You just launched in 3 new EU markets — what's the risk if local compliance gaps delay your first 100 customers by two quarters?",
    angle: "risk",
    description: "International expansion brings compliance risk. The risk angle quantifies potential delay.",
  },
  // Healthcare
  {
    id: "hc-1",
    industry: "Healthcare",
    name: "EHR migration",
    hook: "Your system just migrated to Epic — are the clinical workflows actually saving time, or did the switch just move the bottleneck?",
    angle: "trigger",
    description: "EHR migrations are a trigger event. The question challenges assumptions about the outcome.",
  },
  {
    id: "hc-2",
    industry: "Healthcare",
    name: "Staffing shortage",
    hook: "You posted 40 nursing roles last month — what breaks first if fill rates stay below 60% through Q4?",
    angle: "risk",
    description: "Staffing signals indicate operational strain. The risk angle surfaces downstream impact.",
  },
  // E-commerce
  {
    id: "ec-1",
    industry: "E-commerce",
    name: "Platform migration",
    hook: "You just moved from Magento to Shopify Plus — is the team rebuilding integrations from scratch, or did you bring the technical debt with you?",
    angle: "tradeoff",
    description: "Platform migrations create a natural opening. The tradeoff angle highlights hidden costs.",
  },
  {
    id: "ec-2",
    industry: "E-commerce",
    name: "Peak season prep",
    hook: "Black Friday is 90 days out — if your checkout flow drops 2% of carts under load, that's £400K left on the table. Is the infra stress-tested?",
    angle: "risk",
    description: "Seasonal pressure creates urgency. The risk angle quantifies the financial impact.",
  },
  // Agencies
  {
    id: "ag-1",
    industry: "Agencies",
    name: "Client churn signal",
    hook: "Your two largest clients both posted RFPs last month — is the account team proactively re-pitching, or waiting for the 90-day notice?",
    angle: "trigger",
    description: "RFP postings signal potential churn. The trigger angle urges proactive outreach.",
  },
  // Manufacturing
  {
    id: "mfg-1",
    industry: "Manufacturing",
    name: "Supply chain disruption",
    hook: "Your primary supplier just flagged 6-week delays — are you already qualifying backups, or hoping the timeline holds?",
    angle: "tradeoff",
    description: "Supply chain disruptions force a choice. The tradeoff angle highlights the decision point.",
  },
  {
    id: "mfg-2",
    industry: "Manufacturing",
    name: "Automation investment",
    hook: "You budgeted £2M for factory automation — what's the risk if integration takes 18 months instead of 9 and ROI slips past the next budget cycle?",
    angle: "risk",
    description: "CapEx investments need ROI justification. The risk angle highlights timeline risk.",
  },
];

const INDUSTRIES = [...new Set(TEMPLATES.map((t) => t.industry))];

const angleColors: Record<string, string> = {
  trigger: "text-blue-400 bg-blue-900/30 border-blue-800",
  risk: "text-red-400 bg-red-900/30 border-red-800",
  tradeoff: "text-amber-400 bg-amber-900/30 border-amber-800",
};

export default function TemplatesPage() {
  const [filter, setFilter] = useState<string>("All");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered =
    filter === "All"
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.industry === filter);

  async function copyHook(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Hook Templates</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Pre-built hooks by industry. Copy and customize for your outreach.
      </p>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {["All", ...INDUSTRIES].map((industry) => (
          <button
            key={industry}
            onClick={() => setFilter(industry)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === industry
                ? "bg-emerald-900/30 border-emerald-800 text-emerald-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {industry}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((template) => (
          <div
            key={template.id}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-zinc-500">
                {template.industry}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded border ${angleColors[template.angle]}`}
              >
                {template.angle}
              </span>
              <span className="text-xs text-zinc-600">{template.name}</span>
              <button
                onClick={() => copyHook(template.id, template.hook)}
                className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto transition-colors"
              >
                {copied === template.id ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-zinc-200 mb-2">{template.hook}</p>
            <p className="text-xs text-zinc-500">{template.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
