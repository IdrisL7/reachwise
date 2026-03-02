export type EvidenceTier = "A" | "B" | "C";

export type StructuredHook = {
  news_item: number;
  angle: "pain" | "gain" | "contrast";
  hook: string;
  evidence_snippet: string;
  source_title: string;
  source_date: string;
  source_url: string;
  evidence_tier: EvidenceTier;
  confidence: "high" | "med" | "low";
};

export type CompanyResolutionStatus = "ok" | "needs_disambiguation" | "no_match";

export type CompanyCandidate = {
  id: string;
  name: string;
  url: string;
  description?: string;
  source?: string;
};

export type HookResponse = {
  hooks: string[];
  structured_hooks?: StructuredHook[];
  error?: string;
  status?: CompanyResolutionStatus;
  companyName?: string;
  resolvedCompany?: CompanyCandidate | null;
  candidates?: CompanyCandidate[];
  suggestion?: string;
};
