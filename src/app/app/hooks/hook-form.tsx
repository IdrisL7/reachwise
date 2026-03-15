"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface HookFormProps {
  url: string;
  setUrl: (v: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  targetRole: string;
  setTargetRole: (v: string) => void;
  showCustomRole: boolean;
  setShowCustomRole: (v: boolean) => void;
  customRoleInput: string;
  setCustomRoleInput: (v: string) => void;
  customPain: string;
  setCustomPain: (v: string) => void;
  customPromise: string;
  setCustomPromise: (v: string) => void;
  loading: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}

const loadingSteps = [
  "Finding signals...",
  "Analyzing evidence...",
  "Drafting hooks...",
];

function LoadingText() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % loadingSteps.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return <span className="animate-fade-in">{loadingSteps[step]}</span>;
}

export function HookForm({
  url,
  setUrl,
  companyName,
  setCompanyName,
  targetRole,
  setTargetRole,
  showCustomRole,
  setShowCustomRole,
  customRoleInput,
  setCustomRoleInput,
  customPain,
  setCustomPain,
  customPromise,
  setCustomPromise,
  loading,
  error,
  onSubmit,
}: HookFormProps) {
  return (
    <form id="hooks-form" onSubmit={onSubmit} className="mb-8">
      <div className="bg-[#14161a] border border-[#252830] rounded-xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Input
            type="text"
            label="Company URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. techcrunch.com/... or stripe.com/newsroom"
          />
          <Input
            type="text"
            label="Company Name (optional)"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Inc"
          />
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              Who are you emailing?
            </label>
            <select
              value={targetRole === "Custom" ? "Custom" : targetRole}
              onChange={(e) => {
                const val = e.target.value;
                setTargetRole(val);
                setShowCustomRole(val === "Custom");
                if (val !== "Custom") {
                  setCustomRoleInput("");
                  localStorage.setItem("gsh_targetRole", val);
                }
              }}
              className="w-full bg-[#0e0f10] border border-[#252830] rounded-lg px-4 py-2.5 text-[#eceae6] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors appearance-none"
            >
              <option value="Not sure / Any role">Not sure / Any role</option>
              <option value="VP Sales">VP Sales</option>
              <option value="RevOps">RevOps</option>
              <option value="SDR Manager">SDR Manager</option>
              <option value="Marketing">Marketing</option>
              <option value="Founder/CEO">Founder/CEO</option>
              <option value="Custom">Custom...</option>
            </select>
            {showCustomRole && (
              <>
                <div className="mt-2">
                  <Input
                    type="text"
                    value={customRoleInput}
                    onChange={(e) => setCustomRoleInput(e.target.value.slice(0, 30))}
                    placeholder="e.g. Head of Partnerships"
                    error={error && targetRole === "Custom" && !customRoleInput.trim() ? "Enter a role name to continue" : undefined}
                    className="text-sm"
                  />
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-[#878a8f] mb-1">What pain does this role feel?</label>
                  <textarea
                    value={customPain}
                    onChange={(e) => setCustomPain(e.target.value.slice(0, 200))}
                    placeholder="e.g. Spends too much time on unqualified leads"
                    maxLength={200}
                    rows={2}
                    className="w-full bg-[#0e0f10] border border-[#252830] rounded-lg px-3 py-2 text-sm text-[#eceae6] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors resize-none"
                  />
                  <span className="text-[10px] text-zinc-600">{customPain.length}/200</span>
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-[#878a8f] mb-1">What outcome can you promise?</label>
                  <input
                    type="text"
                    value={customPromise}
                    onChange={(e) => setCustomPromise(e.target.value.slice(0, 80))}
                    placeholder="e.g. A 10-min audit of your outbound signals"
                    maxLength={80}
                    className="w-full bg-[#0e0f10] border border-[#252830] rounded-lg px-3 py-2 text-sm text-[#eceae6] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors"
                  />
                  <span className="text-[10px] text-zinc-600">{customPromise.length}/80</span>
                </div>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-[#878a8f] mb-4">
          Best results: use a press page, funding article (TechCrunch, Reuters), or company newsroom. Generic homepages rarely have enough signal.
        </p>
        <button
          type="submit"
          disabled={loading || (!url && !companyName)}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors duration-200"
        >
          {loading && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? <LoadingText /> : "Generate Hooks"}
        </button>
      </div>
    </form>
  );
}
