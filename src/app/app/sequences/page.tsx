"use client";

import { useState, useEffect, useCallback } from 'react';
import { Edit3, Trash2, X, Plus, Pause, Play, Inbox, Users, Zap } from 'lucide-react';
import { AppPageShell, EmptyStatePanel, SurfaceCard } from "../page-shell";

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

interface LeadSequenceAssignment {
  id: string;
  leadId: string;
  leadEmail: string;
  leadName: string | null;
  companyName: string | null;
  sequenceId: string;
  sequenceName: string;
  currentStep: number;
  totalSteps: number;
  status: "active" | "paused" | "completed";
  lastContactedAt: string | null;
  startedAt: string;
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

const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'linkedin_connection', label: 'LinkedIn Connection' },
  { value: 'linkedin_message', label: 'LinkedIn Message' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'video_script', label: 'Video Script' },
];

const STEP_TYPES = [
  { value: 'first', label: 'First Touch' },
  { value: 'bump', label: 'Bump' },
  { value: 'breakup', label: 'Breakup' },
];

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

function StatusBadge({ status }: { status: LeadSequenceAssignment["status"] }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    completed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${styles[status] ?? styles.completed}`}>
      {status}
    </span>
  );
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

  const [editingSeq, setEditingSeq] = useState<Sequence | null>(null);
  const [editName, setEditName] = useState('');
  const [editSteps, setEditSteps] = useState<SequenceStep[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Active lead-sequences state
  const [assignments, setAssignments] = useState<LeadSequenceAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

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

  const fetchAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const res = await fetch('/api/lead-sequences');
      if (!res.ok) throw new Error('Failed to load active sequences');
      const data = await res.json();
      setAssignments(data.assignments ?? []);
    } catch (e: unknown) {
      setAssignmentsError(e instanceof Error ? e.message : 'Failed to load active sequences');
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSequences();
    fetchAssignments();
  }, [fetchAssignments]);

  async function handlePause(assignment: LeadSequenceAssignment) {
    setTogglingIds(prev => new Set(prev).add(assignment.id));
    try {
      const res = await fetch('/api/followups/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: assignment.leadId, reason: 'manual' }),
      });
      if (!res.ok) {
        // Fallback: directly update lead-sequence status
        await fetch(`/api/lead-sequences/${assignment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'paused' }),
        });
      }
      await fetchAssignments();
    } catch {
      // Optimistic rollback not needed — we just refetch
      await fetchAssignments();
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(assignment.id);
        return next;
      });
    }
  }

  async function handleResume(assignment: LeadSequenceAssignment) {
    setTogglingIds(prev => new Set(prev).add(assignment.id));
    try {
      await fetch(`/api/lead-sequences/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      await fetchAssignments();
    } catch {
      await fetchAssignments();
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(assignment.id);
        return next;
      });
    }
  }

  async function handleDelete(id: string) {
    setSequences(prev => prev.filter(s => s.id !== id));
    try {
      const res = await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
      if (!res.ok) fetchSequences();
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

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSeq || !editName.trim() || editSteps.length === 0) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const steps = editSteps.map((s, i) => ({ ...s, order: i + 1 }));
      const res = await fetch(`/api/sequences/${editingSeq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), steps }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error ?? 'Failed to save'); return; }
      setEditingSeq(null);
      fetchSequences();
    } catch {
      setEditError('Failed to save');
    } finally {
      setEditSubmitting(false);
    }
  }

  function updateEditStep(idx: number, patch: Partial<SequenceStep>) {
    setEditSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  function removeEditStep(idx: number) {
    setEditSteps(prev => prev.filter((_, i) => i !== idx));
  }

  function addEditStep() {
    setEditSteps(prev => [...prev, { order: prev.length + 1, channel: 'email', delayDays: 3, type: 'bump' }]);
  }

  return (
    <AppPageShell
      eyebrow="Follow-up orchestration"
      title="Sequences"
      description="Build the follow-up paths that turn saved leads into queued drafts. If there are no active sequences yet, the fastest next step is usually to save a lead or generate more hooks upstream."
      actions={[
        { label: "New Sequence", icon: Plus, variant: "primary", onClick: () => { setShowModal(true); setSubmitError(null); } },
        { href: "/app/leads", label: "Open Leads", icon: Users },
        { href: "/app/inbox", label: "Review Inbox", icon: Inbox },
      ]}
      stats={[
        { label: "Saved sequences", value: loading ? "..." : String(sequences.length), tone: "violet" },
        { label: "Active assignments", value: assignmentsLoading ? "..." : String(assignments.filter((assignment) => assignment.status === "active").length), tone: "teal" },
        { label: "Paused assignments", value: assignmentsLoading ? "..." : String(assignments.filter((assignment) => assignment.status === "paused").length), tone: "amber" },
      ]}
    >
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-6 py-4 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      <SurfaceCard
        title="Sequence library"
        description="Create reusable follow-up tracks, then assign them from Leads so Inbox has drafts ready for review."
      >
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
          <EmptyStatePanel
            icon={Plus}
            title="No sequences yet"
            description="Create your first outreach sequence, then assign it from Leads so approved drafts start flowing into Inbox."
            actions={[
              { label: "New Sequence", icon: Plus, variant: "primary", onClick: () => { setShowModal(true); setSubmitError(null); } },
              { href: "/app/leads", label: "Open Leads", icon: Users },
              { href: "/app/hooks", label: "Generate Hooks", icon: Zap },
            ]}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sequences.map((seq) => {
              const tag = getTagInfo(seq);
              return (
                <div key={seq.id} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 transition-all group">
                <div className="flex justify-between mb-4">
                  <span className={`text-[10px] ${tag.color} px-2 py-1 rounded font-black uppercase tracking-widest`}>{tag.label}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit3
                      size={14}
                      className="text-slate-500 cursor-pointer hover:scale-[1.02]"
                      onClick={() => {
                        setEditingSeq(seq);
                        setEditName(seq.name);
                        setEditSteps(seq.steps);
                        setEditError(null);
                      }}
                    />
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
      </SurfaceCard>

      <SurfaceCard
        title="Active sequences"
        description="Pause, resume, and monitor current follow-up progress without leaving the authenticated workflow."
      >

        {assignmentsError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-6 py-4 rounded-xl mb-6 text-sm">
            {assignmentsError}
          </div>
        )}

        {assignmentsLoading ? (
          <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 animate-pulse">
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="h-4 w-32 bg-white/10 rounded" />
                  <div className="h-4 w-24 bg-white/10 rounded" />
                  <div className="h-4 w-20 bg-white/10 rounded" />
                  <div className="h-4 w-16 bg-white/10 rounded ml-auto" />
                </div>
              ))}
            </div>
          </div>
        ) : assignments.length === 0 ? (
          <EmptyStatePanel
            icon={Inbox}
            title="No active sequences"
            description="Start one from Leads after you save prospects, or generate fresh hooks first if you still need accounts worth following up with."
            actions={[
              { href: "/app/leads", label: "Open Leads", icon: Users, variant: "primary" },
              { href: "/app/hooks", label: "Generate Hooks", icon: Zap },
              { href: "/app/inbox", label: "Review Inbox", icon: Inbox },
            ]}
          />
        ) : (
          <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_1fr_100px_90px_110px_80px] gap-4 px-6 py-3 border-b border-white/5 text-[10px] text-slate-500 uppercase font-black tracking-widest">
              <span>Lead</span>
              <span>Company</span>
              <span>Sequence</span>
              <span>Progress</span>
              <span>Status</span>
              <span>Last Contacted</span>
              <span className="text-right">Action</span>
            </div>

            {/* Table rows */}
            {assignments.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[1fr_1fr_1fr_100px_90px_110px_80px] gap-4 px-6 py-4 border-b border-white/5 last:border-b-0 items-center hover:bg-white/[0.02] transition-colors"
              >
                {/* Lead */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{a.leadName || 'Unknown'}</p>
                  <p className="text-xs text-slate-500 truncate">{a.leadEmail}</p>
                </div>

                {/* Company */}
                <p className="text-sm text-slate-300 truncate">{a.companyName || '—'}</p>

                {/* Sequence */}
                <p className="text-sm text-slate-300 truncate">{a.sequenceName}</p>

                {/* Progress */}
                <div>
                  <p className="text-sm font-semibold">
                    Step {a.currentStep} of {a.totalSteps}
                  </p>
                  <div className="mt-1 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: a.totalSteps > 0 ? `${(a.currentStep / a.totalSteps) * 100}%` : '0%' }}
                    />
                  </div>
                </div>

                {/* Status */}
                <StatusBadge status={a.status} />

                {/* Last Contacted */}
                <p className="text-xs text-slate-500">
                  {a.lastContactedAt ? formatDate(a.lastContactedAt) : '—'}
                </p>

                {/* Action */}
                <div className="flex justify-end">
                  {a.status === 'active' && (
                    <button
                      onClick={() => handlePause(a)}
                      disabled={togglingIds.has(a.id)}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Pause sequence"
                    >
                      <Pause size={13} />
                      <span>Pause</span>
                    </button>
                  )}
                  {a.status === 'paused' && (
                    <button
                      onClick={() => handleResume(a)}
                      disabled={togglingIds.has(a.id)}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Resume sequence"
                    >
                      <Play size={13} />
                      <span>Resume</span>
                    </button>
                  )}
                  {a.status === 'completed' && (
                    <span className="text-xs text-slate-600">Done</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

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
                {submitting ? 'Creating...' : 'Create Sequence'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingSeq && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B0F1A] border border-white/10 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Edit Sequence</h3>
              <button onClick={() => setEditingSeq(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-500 block mb-2">Sequence Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="e.g. SaaS Founder Outreach"
                  className="w-full bg-[#030014] border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-purple-500"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-slate-500 block mb-2">Steps</label>
                <div className="space-y-2">
                  {editSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 rounded-lg border border-white/10 bg-[#030014]">
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest w-5 shrink-0">{idx + 1}</span>
                      <select
                        value={step.channel}
                        onChange={e => updateEditStep(idx, { channel: e.target.value })}
                        className="flex-1 bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs outline-none focus:border-purple-500 text-slate-300"
                      >
                        {CHANNELS.map(c => (
                          <option key={c.value} value={c.value} className="bg-[#0B0F1A]">{c.label}</option>
                        ))}
                      </select>
                      <select
                        value={step.type}
                        onChange={e => updateEditStep(idx, { type: e.target.value })}
                        className="w-28 bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs outline-none focus:border-purple-500 text-slate-300"
                      >
                        {STEP_TYPES.map(t => (
                          <option key={t.value} value={t.value} className="bg-[#0B0F1A]">{t.label}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={0}
                          value={step.delayDays}
                          onChange={e => updateEditStep(idx, { delayDays: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-10 bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs outline-none focus:border-purple-500 text-slate-300 text-center"
                        />
                        <span className="text-[10px] text-slate-600">d</span>
                      </div>
                      <button
                        type="button"
                        disabled={editSteps.length <= 1}
                        onClick={() => removeEditStep(idx)}
                        className="text-red-500/40 hover:text-red-500/80 disabled:opacity-20 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addEditStep}
                  className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Plus size={12} /> Add Step
                </button>
              </div>
              {editError && (
                <p className="text-red-400 text-sm">{editError}</p>
              )}
              <button
                type="submit"
                disabled={editSubmitting || !editName.trim() || editSteps.length === 0}
                className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}
