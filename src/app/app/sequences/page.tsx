"use client";

import { useState, useEffect } from 'react';
import { Edit3, Trash2, X } from 'lucide-react';

interface SequenceStep {
  order: number;
  channel: string;
  delayDays: number;
  type: string;
}

interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  isDefault: number;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE_STEPS: Record<string, SequenceStep[]> = {
  email3: [
    { order: 1, channel: 'email', delayDays: 0, type: 'first' },
    { order: 2, channel: 'email', delayDays: 3, type: 'bump' },
    { order: 3, channel: 'email', delayDays: 7, type: 'breakup' },
  ],
  multi5: [
    { order: 1, channel: 'email', delayDays: 0, type: 'first' },
    { order: 2, channel: 'linkedin_connection', delayDays: 2, type: 'bump' },
    { order: 3, channel: 'email', delayDays: 4, type: 'bump' },
    { order: 4, channel: 'linkedin_message', delayDays: 7, type: 'bump' },
    { order: 5, channel: 'email', delayDays: 10, type: 'breakup' },
  ],
};

function getTagInfo(seq: Sequence): { label: string; color: string } {
  if (seq.isDefault) return { label: 'Default', color: 'bg-purple-500/10 text-purple-400' };
  const hasNonEmail = seq.steps.some(s => s.channel !== 'email');
  if (hasNonEmail) return { label: 'Multi-Channel', color: 'bg-purple-500/10 text-purple-400' };
  if (seq.steps.length > 0 && seq.steps.every(s => s.channel === 'email')) {
    return { label: 'Email Only', color: 'bg-blue-500/10 text-blue-400' };
  }
  return { label: 'Custom', color: 'bg-slate-500/10 text-slate-400' };
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalTemplate, setModalTemplate] = useState<'email3' | 'multi5'>('email3');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function fetchSequences() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sequences');
      if (!res.ok) throw new Error('Failed to load sequences');
      const data = await res.json();
      setSequences(data.sequences ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSequences(); }, []);

  async function handleDelete(id: string) {
    setSequences(prev => prev.filter(s => s.id !== id));
    try {
      const res = await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
      if (!res.ok) fetchSequences(); // rollback on failure
    } catch {
      fetchSequences();
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!modalName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const steps = TEMPLATE_STEPS[modalTemplate];
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modalName.trim(), steps }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to create sequence');
        return;
      }
      setShowModal(false);
      setModalName('');
      setModalTemplate('email3');
      fetchSequences();
    } catch {
      setSubmitError('Failed to create sequence');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 bg-[#030014] min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Sequences</h2>
        <button
          onClick={() => { setShowModal(true); setSubmitError(null); }}
          className="bg-teal-500 hover:bg-teal-400 px-6 py-2 rounded-lg font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          + New Sequence
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-6 py-4 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map(i => (
            <div key={i} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="h-5 w-24 bg-white/10 rounded" />
              </div>
              <div className="h-6 w-48 bg-white/10 rounded mb-6" />
              <div className="flex gap-8 mb-6">
                <div className="h-10 w-20 bg-white/10 rounded" />
                <div className="h-10 w-20 bg-white/10 rounded" />
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full" />
            </div>
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-slate-400 text-lg mb-2">No sequences yet.</p>
          <p className="text-slate-500 text-sm mb-6">Create your first outreach sequence.</p>
          <button
            onClick={() => { setShowModal(true); setSubmitError(null); }}
            className="bg-teal-500 hover:bg-teal-400 px-6 py-2 rounded-lg font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            New Sequence
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sequences.map((seq) => {
            const tag = getTagInfo(seq);
            return (
              <div key={seq.id} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 transition-all group">
                <div className="flex justify-between mb-4">
                  <span className={`text-[10px] ${tag.color} px-2 py-1 rounded font-black uppercase tracking-widest`}>{tag.label}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit3 size={14} className="text-slate-500 cursor-pointer hover:scale-[1.02]" onClick={() => {}} />
                    <Trash2 size={14} className="text-red-500/50 cursor-pointer hover:scale-[1.02]" onClick={() => handleDelete(seq.id)} />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-6">{seq.name}</h3>
                <div className="flex gap-8 mb-5">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Steps</p>
                    <p className="text-lg font-bold">{seq.steps.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Created</p>
                    <p className="text-lg font-bold">{formatDate(seq.createdAt)}</p>
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t border-white/5">
                  {seq.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-purple-500 transition-colors shrink-0" />
                      <span className="capitalize">{step.channel.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-600 ml-auto uppercase tracking-widest">Step {idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B0F1A] border border-white/10 rounded-2xl p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">New Sequence</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-500 block mb-2">Sequence Name</label>
                <input
                  type="text"
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="e.g. SaaS Founder Outreach"
                  className="w-full bg-[#030014] border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-purple-500"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-slate-500 block mb-2">Starter Template</label>
                <div className="space-y-2">
                  {([
                    { value: 'email3', label: 'Email (3-step)', desc: 'D0 first touch → D3 bump → D7 breakup' },
                    { value: 'multi5', label: 'Multi-Channel (5-step)', desc: 'Email + LinkedIn connection + message' },
                  ] as const).map(opt => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${modalTemplate === opt.value ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20'}`}>
                      <input
                        type="radio"
                        name="template"
                        value={opt.value}
                        checked={modalTemplate === opt.value}
                        onChange={() => setModalTemplate(opt.value)}
                        className="mt-0.5 accent-purple-500"
                      />
                      <div>
                        <p className="text-sm font-semibold">{opt.label}</p>
                        <p className="text-xs text-slate-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {submitError && (
                <p className="text-red-400 text-sm">{submitError}</p>
              )}
              <button
                type="submit"
                disabled={submitting || !modalName.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating…' : 'Create Sequence'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
