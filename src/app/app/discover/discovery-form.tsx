"use client";

import { Loader2 } from "lucide-react";
import type { DiscoveryCriteria } from "@/lib/discovery";

interface Props {
  criteria: DiscoveryCriteria;
  setCriteria: (v: DiscoveryCriteria) => void;
  onSubmit: () => void;
  loading: boolean;
}

const inputCls = "w-full bg-[#030014] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/60 transition-colors";
const labelCls = "block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2";

export function DiscoveryForm({ criteria, setCriteria, onSubmit, loading }: Props) {
  return (
    <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 mb-6">
      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <div>
          <label className={labelCls}>Industry</label>
          <input
            className={inputCls}
            placeholder="e.g. SaaS, Fintech, Healthcare"
            value={criteria.industry || ""}
            onChange={(e) => setCriteria({ ...criteria, industry: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Company Size</label>
          <input
            className={inputCls}
            placeholder="e.g. 51-200"
            value={criteria.companySize || ""}
            onChange={(e) => setCriteria({ ...criteria, companySize: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input
            className={inputCls}
            placeholder="e.g. London, United States"
            value={criteria.location || ""}
            onChange={(e) => setCriteria({ ...criteria, location: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Tech Stack</label>
          <input
            className={inputCls}
            placeholder="e.g. Salesforce, HubSpot"
            value={(criteria.techStack || []).join(", ")}
            onChange={(e) =>
              setCriteria({
                ...criteria,
                techStack: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
      </div>
      <div className="mb-5">
        <label className={labelCls}>Keywords</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={3}
          placeholder="Describe your ideal customer — what problems they have, what they care about..."
          value={criteria.keywords || ""}
          onChange={(e) => setCriteria({ ...criteria, keywords: e.target.value })}
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Discovering…
          </>
        ) : (
          "Discover Companies"
        )}
      </button>
    </div>
  );
}
