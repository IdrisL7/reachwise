export type StructuredHook = {
  news_item: number;
  angle: "pain" | "gain" | "contrast";
  hook: string;
  evidence_snippet: string;
  source_title: string;
  confidence: "high" | "med" | "low";
};

export type HookResponse = {
  hooks: string[];
  structured_hooks?: StructuredHook[];
  error?: string;
};
