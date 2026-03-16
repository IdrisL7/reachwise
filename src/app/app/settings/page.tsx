"use client";

import { useState, useEffect } from "react";

const VOICE_TONES = ["Direct & Professional", "Friendly & Casual", "Formal & Corporate", "Conversational"];
const PRIMARY_KPIS = ["Book a Demo", "Schedule a Call", "Start a Trial", "Download Content"];

export default function SettingsPage() {
  const [companyDescription, setCompanyDescription] = useState("");
  const [voiceTone, setVoiceTone] = useState(VOICE_TONES[0]);
  const [primaryKpi, setPrimaryKpi] = useState(PRIMARY_KPIS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.companyDescription) setCompanyDescription(data.companyDescription);
        if (data.voiceTone && VOICE_TONES.includes(data.voiceTone)) setVoiceTone(data.voiceTone);
        if (data.primaryKpi && PRIMARY_KPIS.includes(data.primaryKpi)) setPrimaryKpi(data.primaryKpi);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyDescription, voiceTone, primaryKpi }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-12 bg-[#030014]">
      <section>
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">AI Context (The Brain)</h3>
        <div className="space-y-6 bg-[#0B0F1A] border border-white/5 p-8 rounded-2xl">
          <div>
            <label className="text-[10px] text-slate-600 font-black uppercase mb-2 block">Company Description</label>
            <textarea
              className="w-full bg-[#030014] border border-white/10 rounded-xl p-4 text-sm min-h-[120px] disabled:opacity-50"
              value={loading ? "" : companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              disabled={loading}
              placeholder={loading ? "Loading…" : "Describe what you sell and who you sell it to"}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-600 font-black uppercase mb-2 block">Voice Tone</label>
              <select
                className="w-full bg-[#030014] border border-white/10 p-4 rounded-xl text-sm disabled:opacity-50"
                value={voiceTone}
                onChange={(e) => setVoiceTone(e.target.value)}
                disabled={loading}
              >
                {VOICE_TONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-600 font-black uppercase mb-2 block">Primary KPI</label>
              <select
                className="w-full bg-[#030014] border border-white/10 p-4 rounded-xl text-sm disabled:opacity-50"
                value={primaryKpi}
                onChange={(e) => setPrimaryKpi(e.target.value)}
                disabled={loading}
              >
                {PRIMARY_KPIS.map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full bg-purple-600 py-4 rounded-xl font-bold shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "Saving…" : saved ? "Saved" : "Save AI Configuration"}
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">CRM Integrations</h3>
        <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-8">
          <div className="space-y-4">
            {["HubSpot", "Salesforce"].map((crm) => (
              <div key={crm} className="bg-white/5 p-5 rounded-xl flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-800 rounded flex items-center justify-center font-bold text-xl">{crm[0]}</div>
                  <p className="font-bold">{crm}</p>
                </div>
                <span className="bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded">Coming Soon</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
