"use client";

import { useState, useEffect } from "react";

interface SequenceStep {
  order: number;
  channel: string;
  delayDays: number;
  type: string;
  tone?: string;
}

interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  isDefault: number;
  createdAt: string;
}

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "linkedin_connection", label: "LinkedIn Connection" },
  { value: "linkedin_message", label: "LinkedIn DM" },
  { value: "cold_call", label: "Cold Call" },
  { value: "video_script", label: "Video Script" },
];

const STEP_TYPES = [
  { value: "first", label: "First" },
  { value: "bump", label: "Bump" },
  { value: "breakup", label: "Breakup" },
];

const channelIcon: Record<string, string> = {
  email: "✉",
  linkedin_connection: "in",
  linkedin_message: "in",
  cold_call: "☎",
  video_script: "▶",
};

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // sequence id or "new"
  const [formName, setFormName] = useState("");
  const [formSteps, setFormSteps] = useState<SequenceStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { fetchSequences(); }, []);

  async function fetchSequences() {
    try {
      const res = await fetch("/api/sequences");
      const data = await res.json();
      setSequences(data.sequences || []);
    } catch {} finally { setLoading(false); }
  }

  function startCreate() {
    setEditing("new");
    setFormName("");
    setFormSteps([{ order: 0, channel: "email", delayDays: 0, type: "first" }]);
    setMessage("");
  }

  function startEdit(seq: Sequence) {
    setEditing(seq.id);
    setFormName(seq.name);
    setFormSteps([...seq.steps]);
    setMessage("");
  }

  function cancelEdit() {
    setEditing(null);
    setFormName("");
    setFormSteps([]);
  }

  function addStep() {
    setFormSteps((prev) => [
      ...prev,
      { order: prev.length, channel: "email", delayDays: 3, type: prev.length === 0 ? "first" : "bump" },
    ]);
  }

  function removeStep(idx: number) {
    setFormSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setFormSteps((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  }

  function updateStep(idx: number, field: keyof SequenceStep, value: string | number) {
    setFormSteps((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  async function handleSave() {
    if (!formName.trim() || formSteps.length === 0) return;
    setSaving(true);
    setMessage("");

    try {
      if (editing === "new") {
        const res = await fetch("/api/sequences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, steps: formSteps }),
        });
        const data = await res.json();
        if (!res.ok) { setMessage(data.error || "Failed to create"); setSaving(false); return; }
      } else {
        const res = await fetch(`/api/sequences/${editing}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, steps: formSteps }),
        });
        if (!res.ok) { setMessage("Failed to update"); setSaving(false); return; }
      }
      cancelEdit();
      fetchSequences();
    } catch { setMessage("Failed to save"); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sequence?")) return;
    await fetch(`/api/sequences/${id}`, { method: "DELETE" });
    fetchSequences();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sequences</h1>
          <p className="text-sm text-zinc-500 mt-1">Define multi-step outreach sequences with channel, timing, and tone per step.</p>
        </div>
        {!editing && (
          <button onClick={startCreate} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0">
            Create Sequence
          </button>
        )}
      </div>

      {message && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{message}</div>
      )}

      {/* Create/Edit Form */}
      {editing && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{editing === "new" ? "Create Sequence" : "Edit Sequence"}</h2>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Sequence name"
            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 mb-4"
          />

          <div className="space-y-2 mb-4">
            {formSteps.map((step, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 bg-black/50 border border-zinc-800 rounded-lg px-3 py-2">
                <span className="text-xs text-zinc-500 w-6 shrink-0">#{idx + 1}</span>
                <select
                  value={step.channel}
                  onChange={(e) => updateStep(idx, "channel", e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                >
                  {CHANNELS.map((ch) => <option key={ch.value} value={ch.value}>{ch.label}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-zinc-500">Day</span>
                  <input
                    type="number"
                    min={0}
                    value={step.delayDays}
                    onChange={(e) => updateStep(idx, "delayDays", parseInt(e.target.value) || 0)}
                    className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                  />
                </div>
                <select
                  value={step.type}
                  onChange={(e) => updateStep(idx, "type", e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                >
                  {STEP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <div className="flex gap-0.5 ml-auto">
                  <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 text-xs px-1">↑</button>
                  <button onClick={() => moveStep(idx, 1)} disabled={idx === formSteps.length - 1} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 text-xs px-1">↓</button>
                  <button onClick={() => removeStep(idx)} className="text-zinc-600 hover:text-red-400 text-xs px-1 ml-1">✕</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={addStep} className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800 px-3 py-1.5 rounded-lg transition-colors">
              + Add Step
            </button>
            <div className="ml-auto flex gap-2">
              <button onClick={cancelEdit} className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !formName.trim() || formSteps.length === 0} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sequence Cards */}
      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : sequences.length === 0 && !editing ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">No sequences yet</h2>
          <p className="text-sm text-zinc-500 mb-4">Create a sequence to define your outreach cadence.</p>
          <button onClick={startCreate} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Create Sequence
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sequences.map((seq) => (
            <div key={seq.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-200">{seq.name}</h3>
                  {seq.isDefault === 1 && (
                    <span className="text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">Default</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(seq)} className="text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 transition-colors">Edit</button>
                  <button onClick={() => handleDelete(seq.id)} className="text-xs text-zinc-500 hover:text-red-400 px-2 py-1 transition-colors">Delete</button>
                </div>
              </div>
              <div className="space-y-1">
                {(seq.steps as SequenceStep[]).map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="text-zinc-600 w-4">{i + 1}.</span>
                    <span className="text-zinc-500">{channelIcon[step.channel] || "?"}</span>
                    <span>{CHANNELS.find((c) => c.value === step.channel)?.label || step.channel}</span>
                    <span className="text-zinc-600">Day {step.delayDays}</span>
                    <span className="text-zinc-700">({step.type})</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-2">{(seq.steps as SequenceStep[]).length} steps</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
