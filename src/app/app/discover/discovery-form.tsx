"use client";

import type { DiscoveryCriteria } from "@/lib/discovery";

interface Props {
  criteria: DiscoveryCriteria;
  setCriteria: (v: DiscoveryCriteria) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function DiscoveryForm({ criteria, setCriteria, onSubmit, loading }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
      <div className="grid sm:grid-cols-2 gap-3">
        <input className="bg-zinc-800 rounded-lg px-3 py-2 text-sm" placeholder="Industry" value={criteria.industry || ""} onChange={(e) => setCriteria({ ...criteria, industry: e.target.value })} />
        <input className="bg-zinc-800 rounded-lg px-3 py-2 text-sm" placeholder="Company size (e.g. 51-200)" value={criteria.companySize || ""} onChange={(e) => setCriteria({ ...criteria, companySize: e.target.value })} />
        <input className="bg-zinc-800 rounded-lg px-3 py-2 text-sm" placeholder="Location" value={criteria.location || ""} onChange={(e) => setCriteria({ ...criteria, location: e.target.value })} />
        <input className="bg-zinc-800 rounded-lg px-3 py-2 text-sm" placeholder="Tech stack (comma-separated)" value={(criteria.techStack || []).join(", ")} onChange={(e) => setCriteria({ ...criteria, techStack: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </div>
      <textarea className="w-full mt-3 bg-zinc-800 rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Keywords" value={criteria.keywords || ""} onChange={(e) => setCriteria({ ...criteria, keywords: e.target.value })} />
      <button onClick={onSubmit} disabled={loading} className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
        {loading ? "Discovering..." : "Discover Companies"}
      </button>
    </div>
  );
}
