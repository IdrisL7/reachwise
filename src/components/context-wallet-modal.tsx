"use client";

import { useState } from "react";
import {
  OFFER_CATEGORIES,
  PROFILE_PRESETS,
} from "@/lib/workspace";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1k", "1k+"];

const BUYER_ROLES = [
  "VP Sales",
  "RevOps",
  "Marketing",
  "Founder",
  "CTO",
  "SDR Manager",
  "Head of Growth",
  "Other",
];

const PRIMARY_OUTCOMES = [
  "Pipeline",
  "Meetings",
  "Conversion",
  "Retention",
  "Cost",
  "Risk",
  "Speed",
  "Compliance",
];

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface InitialValues {
  whatYouSell: string;
  icpIndustry: string;
  icpCompanySize: string;
  buyerRoles: string[];
  primaryOutcome: string;
  offerCategory: string;
  proof?: string[] | null;
}

interface ContextWalletModalProps {
  onSave: () => void;
  onClose?: () => void;
  onSkip?: () => void;
  showClose?: boolean;
  showSkip?: boolean;
  initialValues?: InitialValues;
  /** JIT gate mode — different copy + CTA text */
  gateMode?: boolean;
}

export default function ContextWalletModal({
  onSave,
  onClose,
  onSkip,
  showClose = false,
  showSkip = false,
  initialValues,
  gateMode = false,
}: ContextWalletModalProps) {
  const [whatYouSell, setWhatYouSell] = useState(initialValues?.whatYouSell ?? "");
  const [icpIndustry, setIcpIndustry] = useState(initialValues?.icpIndustry ?? "");
  const [icpCompanySize, setIcpCompanySize] = useState(initialValues?.icpCompanySize ?? "");
  const [buyerRoles, setBuyerRoles] = useState<string[]>(initialValues?.buyerRoles ?? []);
  const [primaryOutcome, setPrimaryOutcome] = useState(initialValues?.primaryOutcome ?? "");
  const [offerCategory, setOfferCategory] = useState(initialValues?.offerCategory ?? "");
  const [proof, setProof] = useState(initialValues?.proof?.join("\n") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  function applyPreset(label: string) {
    const preset = PROFILE_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setWhatYouSell(preset.whatYouSell);
    setIcpIndustry(preset.icpIndustry);
    setIcpCompanySize(preset.icpCompanySize);
    setBuyerRoles([...preset.buyerRoles]);
    setPrimaryOutcome(preset.primaryOutcome);
    setOfferCategory(preset.offerCategory);
    setValidationError("");
  }

  function toggleRole(role: string) {
    setBuyerRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function validate(): boolean {
    if (!whatYouSell.trim()) {
      setValidationError("Please describe what you sell.");
      return false;
    }
    if (!icpIndustry.trim()) {
      setValidationError("Please enter your industry.");
      return false;
    }
    if (!icpCompanySize) {
      setValidationError("Please select a company size.");
      return false;
    }
    if (buyerRoles.length === 0) {
      setValidationError("Please select at least one buyer role.");
      return false;
    }
    if (!primaryOutcome) {
      setValidationError("Please select a primary outcome.");
      return false;
    }
    if (!offerCategory) {
      setValidationError("Please select an offer category.");
      return false;
    }
    setValidationError("");
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setError("");

    try {
      const proofLines = proof
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const res = await fetch("/api/workspace-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatYouSell: whatYouSell.trim(),
          icpIndustry: icpIndustry.trim(),
          icpCompanySize,
          buyerRoles,
          primaryOutcome,
          offerCategory,
          proof: proofLines.length > 0 ? proofLines : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile.");
      }

      onSave();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
        {showClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        <h2 className="text-xl font-bold text-zinc-100 mb-1">
          {gateMode ? "Before we generate — 60 seconds to personalise your hooks" : "Add your 60-second profile"}
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          {gateMode
            ? "We can see the prospect\u2019s signals. Add your pitch context so the hook connects to what you sell \u2014 with receipts and no made-up claims."
            : "To generate hooks that connect the prospect\u2019s signal to YOUR offer, we need a little context."}
        </p>

        {/* Preset dropdown */}
        <div className="mb-5">
          <label className="block text-sm text-zinc-400 mb-1.5">
            Start from a template
          </label>
          <select
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
            }}
            defaultValue=""
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-600"
          >
            <option value="" disabled>
              Select a preset...
            </option>
            {PROFILE_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* What you sell */}
        <div className="mb-5">
          <label className="block text-sm text-zinc-400 mb-1.5">
            What you sell <span className="text-red-400">*</span>
          </label>
          <textarea
            value={whatYouSell}
            onChange={(e) => setWhatYouSell(e.target.value)}
            placeholder="Example: We help B2B teams book more meetings by generating evidence-backed outbound hooks."
            rows={2}
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 resize-none"
          />
          <p className="text-xs text-zinc-500 mt-1">
            One sentence. What you do + who it&apos;s for + the outcome.
          </p>
        </div>

        {/* Industry */}
        <div className="mb-5">
          <label className="block text-sm text-zinc-400 mb-1.5">
            Industry <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={icpIndustry}
            onChange={(e) => setIcpIndustry(e.target.value)}
            placeholder="e.g., SaaS, FinTech, Healthcare, B2B Services"
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Company size */}
        <div className="mb-5">
          <label className="block text-sm text-zinc-400 mb-1.5">
            Company size <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {COMPANY_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setIcpCompanySize(size)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  icpCompanySize === size
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Buyer roles */}
        <div className="mb-5">
          <label className="block text-sm text-zinc-400 mb-1.5">
            Buyer role(s) <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {BUYER_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  buyerRoles.includes(role)
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Primary outcome */}
        <div className="mb-5">
          <label className="block text-sm text-zinc-400 mb-1.5">
            Primary outcome <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PRIMARY_OUTCOMES.map((outcome) => (
              <button
                key={outcome}
                type="button"
                onClick={() => setPrimaryOutcome(outcome)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  primaryOutcome === outcome
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {outcome}
              </button>
            ))}
          </div>
        </div>

        {/* Offer category */}
        <div className="mb-5">
          <label className="block text-sm text-zinc-400 mb-1.5">
            Offer category <span className="text-red-400">*</span>
          </label>
          <select
            value={offerCategory}
            onChange={(e) => setOfferCategory(e.target.value)}
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-600"
          >
            <option value="" disabled>
              Select a category...
            </option>
            {OFFER_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {formatCategory(cat)}
              </option>
            ))}
          </select>
        </div>

        {/* Proof (optional) */}
        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-1.5">
            Proof <span className="text-zinc-600">(optional)</span>
          </label>
          <textarea
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder={"Examples: 'Used by X', '+22% reply rate', 'SOC2', or 'No proof yet'"}
            rows={2}
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 resize-none"
          />
          <p className="text-xs text-zinc-500 mt-1">
            1-2 bullets max. One per line.
          </p>
        </div>

        {/* Errors */}
        {validationError && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-2.5 rounded-lg mb-4 text-sm">
            {validationError}
          </div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-2.5 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {saving ? "Saving..." : gateMode ? "Save & generate hooks" : "Save profile"}
        </button>
        {showSkip && onSkip && (
          <button
            onClick={onSkip}
            className="w-full mt-2 text-sm text-zinc-500 hover:text-zinc-300 py-2 transition-colors"
          >
            Generate a demo hook instead — won&apos;t mention your product
          </button>
        )}
      </div>
    </div>
  );
}
