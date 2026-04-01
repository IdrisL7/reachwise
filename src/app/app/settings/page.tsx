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
  const [portalLoading, setPortalLoading] = useState(false);

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

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  }

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
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">Workspace Setup</h3>
        <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-white">Make the product feel like your team</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This page controls the strategic context behind hook generation and outbound workflow. A good setup here makes the rest of the app feel more opinionated and more on-brand.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "1. Define the offer clearly",
                body: "Tell the AI what you sell, who it is for, and why buyers care.",
              },
              {
                title: "2. Pick the voice",
                body: "Choose the tone that should carry through hooks, drafts, and follow-up.",
              },
              {
                title: "3. Set the KPI",
                body: "Anchor the system around the action you actually want from outbound.",
              },
              {
                title: "4. Connect systems",
                body: "Use integrations and billing settings when you are ready to operationalise at scale.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
              <p className="mt-2 text-[11px] text-slate-600 italic leading-relaxed">
                {voiceTone === "Direct & Professional" && "\"Your NPS dropped 12 points — is that a churn risk or a product issue?\""}
                {voiceTone === "Friendly & Casual" && "\"Hey, saw your team just hit 50 people — exciting! Quick question though...\""}
                {voiceTone === "Formal & Corporate" && "\"Following your recent Series C announcement, I wanted to raise a consideration...\""}
                {voiceTone === "Conversational" && "\"So I noticed you're hiring 8 SDRs — does your onboarding actually keep up with that?\""}
              </p>
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
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">Billing</h3>
        <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-8">
          <p className="text-sm text-slate-400 mb-6">Manage your subscription, update payment details, or view invoices. The plan here controls monthly hook limits and how much active workflow your team can run comfortably.</p>
          <button
            onClick={openBillingPortal}
            disabled={portalLoading}
            className="bg-white/5 border border-white/10 hover:bg-white/10 transition-colors px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {portalLoading ? "Opening…" : "Manage Billing →"}
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">CRM Integrations</h3>
        <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-8">
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white">When to connect CRM</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Connect HubSpot or Salesforce once your team wants generated hooks and outbound activity to show up inside the rest of your revenue stack. Until then, the core product loop works fully inside Accounts, Leads, Inbox, and Analytics.
            </p>
          </div>
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

      <section>
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">Where To Work Next</h3>
        <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-8">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { href: "/app/accounts", title: "Accounts", body: "Prioritise companies with fresh signals and clear next actions." },
              { href: "/app/leads", title: "Leads", body: "Save contacts and attach sequence workflow." },
              { href: "/app/inbox", title: "Inbox", body: "Review and approve generated drafts before queueing." },
              { href: "/app/analytics", title: "Analytics", body: "Measure workflow pressure, traction, and what is stalling." },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-violet-500/20 hover:bg-white/[0.05]"
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
                <p className="mt-3 text-xs font-semibold text-violet-300">Open {item.title} →</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
