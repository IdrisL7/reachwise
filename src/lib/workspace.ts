// ── Workspace types & constants ──

export const OFFER_CATEGORIES = [
  "outbound_agency",
  "sdr_team",
  "revops_consulting",
  "sales_engagement_platform",
  "security_compliance",
  "marketing_automation",
  "data_enrichment",
  "recruiting",
  "b2b_saas_generic",
  "other",
] as const;

export type OfferCategory = (typeof OFFER_CATEGORIES)[number];

export interface WorkspaceProfile {
  workspaceId: string;
  whatYouSell: string;
  icpIndustry: string;
  icpCompanySize: string;
  buyerRoles: string[];
  primaryOutcome: string;
  offerCategory: OfferCategory;
  proof?: string[] | null;
  updatedAt: string;
}

/** The subset of workspace profile data passed to the hook generator. */
export interface SenderContext {
  whatYouSell: string;
  icpIndustry: string;
  icpCompanySize: string;
  buyerRoles: string[];
  primaryOutcome: string;
  offerCategory: OfferCategory;
  proof?: string[] | null;
  voiceTone?: string | null;
}

export interface ProfilePreset {
  label: string;
  whatYouSell: string;
  icpIndustry: string;
  icpCompanySize: string;
  buyerRoles: string[];
  primaryOutcome: string;
  offerCategory: OfferCategory;
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    label: "Outbound agency",
    whatYouSell: "We run outbound campaigns for B2B companies",
    icpIndustry: "B2B Services",
    icpCompanySize: "50-500",
    buyerRoles: ["VP Sales", "Head of Growth", "CEO"],
    primaryOutcome: "Meetings",
    offerCategory: "outbound_agency",
  },
  {
    label: "SDR team",
    whatYouSell: "We help prospects book demos",
    icpIndustry: "SaaS",
    icpCompanySize: "100-1000",
    buyerRoles: ["SDR Manager", "VP Sales", "RevOps"],
    primaryOutcome: "Pipeline",
    offerCategory: "sdr_team",
  },
  {
    label: "RevOps consulting",
    whatYouSell: "We optimize CRM and sales processes",
    icpIndustry: "Technology",
    icpCompanySize: "200-2000",
    buyerRoles: ["RevOps Lead", "VP Sales", "CRO"],
    primaryOutcome: "Speed",
    offerCategory: "revops_consulting",
  },
  {
    label: "Sales engagement platform",
    whatYouSell: "We provide tools for sales outreach at scale",
    icpIndustry: "SaaS",
    icpCompanySize: "100-5000",
    buyerRoles: ["SDR Manager", "VP Sales", "Sales Enablement"],
    primaryOutcome: "Conversion",
    offerCategory: "sales_engagement_platform",
  },
  {
    label: "Security/compliance",
    whatYouSell: "We help companies meet security standards",
    icpIndustry: "Technology",
    icpCompanySize: "50-5000",
    buyerRoles: ["CISO", "VP Engineering", "Head of Compliance"],
    primaryOutcome: "Compliance",
    offerCategory: "security_compliance",
  },
  {
    label: "B2B SaaS (generic)",
    whatYouSell: "We sell B2B software",
    icpIndustry: "Technology",
    icpCompanySize: "50-1000",
    buyerRoles: ["VP", "Director", "Head of Department"],
    primaryOutcome: "Pipeline",
    offerCategory: "b2b_saas_generic",
  },
];
