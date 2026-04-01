"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Plus, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface Lead {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  linkedinUrl: string | null;
  source: string;
  status: "cold" | "in_conversation" | "won" | "lost" | "unreachable";
  sequenceStep: number;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  intentScore: number | null;
  temperature: "hot" | "warm" | "cold" | null;
  signalsCount: number;
  lastScoredAt: string | null;
}

interface Sequence {
  id: string;
  name: string;
  isDefault?: number;
  steps?: Array<{ channel?: string; type?: string }>;
}

interface LeadAssignment {
  id: string;
  leadId: string;
  sequenceId: string;
  sequenceName: string;
  currentStep: number;
  totalSteps: number;
  status: string;
  startedAt: string;
}

const STATUS_MAP: Record<Lead["status"], { label: string; className: string }> = {
  cold: { label: "Cold", className: "text-slate-400" },
  in_conversation: { label: "In Conversation", className: "text-blue-400" },
  won: { label: "Won", className: "text-green-400" },
  lost: { label: "Lost", className: "text-red-400" },
  unreachable: { label: "Unreachable", className: "text-slate-600" },
};

const TEMP_MAP: Record<"hot" | "warm" | "cold", { label: string; className: string }> = {
  hot: { label: "Hot", className: "text-orange-500 bg-orange-500/10" },
  warm: { label: "Warm", className: "text-yellow-500 bg-yellow-500/10" },
  cold: { label: "Cold", className: "text-blue-400 bg-blue-400/10" },
};

function SkeletonRows() {
  return (
    <table className="w-full border-collapse">
      <thead className="bg-white/[0.02] text-[10px] uppercase font-black text-slate-500 tracking-widest border-b border-white/5">
        <tr>
          <th className="p-4">Contact</th>
          <th className="p-4">Company</th>
          <th className="p-4">Status</th>
          <th className="p-4">Signal</th>
          <th className="p-4 w-8" />
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <tr key={i}>
            <td className="p-4"><div className="h-3 w-32 rounded bg-white/10" /></td>
            <td className="p-4"><div className="h-3 w-24 rounded bg-white/5" /></td>
            <td className="p-4"><div className="h-3 w-16 rounded bg-white/10" /></td>
            <td className="p-4"><div className="h-3 w-12 rounded bg-white/5" /></td>
            <td className="p-4" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "—";
  }
}

interface AddLeadModalProps {
  onClose: () => void;
  onSaved: () => void;
  initialForm?: {
    email?: string;
    name?: string;
    title?: string;
    company_name?: string;
    company_website?: string;
  };
}

interface SequenceModalProps {
  lead: Lead;
  sequences: Sequence[];
  assignment: LeadAssignment | null;
  onClose: () => void;
  onSaved: () => void;
}

function SequenceModal({
  lead,
  sequences,
  assignment,
  onClose,
  onSaved,
}: SequenceModalProps) {
  const defaultSequenceId =
    assignment?.sequenceId ||
    sequences.find((sequence) => sequence.isDefault === 1)?.id ||
    sequences[0]?.id ||
    "";
  const [selectedSequenceId, setSelectedSequenceId] = useState(defaultSequenceId);
  const [approvalMode, setApprovalMode] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSequence = sequences.find((sequence) => sequence.id === selectedSequenceId) ?? null;
  const channels =
    selectedSequence?.steps?.map((step) => step.channel).filter((value): value is string => Boolean(value)) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSequenceId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/lead-sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          sequenceId: selectedSequenceId,
          approvalMode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to start sequence");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B0F1A] p-6 shadow-2xl">
        <h2 className="text-sm font-bold mb-2">{assignment ? "Change Sequence" : "Start Sequence"}</h2>
        <p className="mb-5 text-sm text-slate-400">
          {lead.name || lead.email} at {lead.companyName || lead.companyWebsite || "this account"}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Sequence
            </label>
            <select
              value={selectedSequenceId}
              onChange={(e) => setSelectedSequenceId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            >
              {sequences.map((sequence) => (
                <option key={sequence.id} value={sequence.id} className="bg-[#0B0F1A] text-white">
                  {sequence.name}
                </option>
              ))}
            </select>
          </div>

          {selectedSequence ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Recommended path
              </p>
              <p className="mt-2 text-sm text-white">{selectedSequence.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {channels.length > 0
                  ? `This sequence starts from the Leads workflow and runs through ${channels.join(" -> ")}.`
                  : "This sequence is ready to attach to the lead workflow."}
              </p>
            </div>
          ) : null}

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <input
              type="checkbox"
              checked={approvalMode}
              onChange={(e) => setApprovalMode(e.target.checked)}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-semibold text-white">Keep approval mode on</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Drafts generated by this sequence will still land in Inbox for review before queueing.
              </p>
            </div>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-white/5 py-2 text-xs font-bold transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedSequenceId}
              className="flex-1 rounded-lg bg-purple-600 py-2 text-xs font-bold transition-colors hover:bg-purple-500 disabled:opacity-50"
            >
              {submitting ? "Saving…" : assignment ? "Update Sequence" : "Start Sequence"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onSaved, initialForm }: AddLeadModalProps) {
  const [form, setForm] = useState({
    email: initialForm?.email || "",
    name: initialForm?.name || "",
    title: initialForm?.title || "",
    company_name: initialForm?.company_name || "",
    company_website: initialForm?.company_website || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: [form] }),
      });
      if (!res.ok) throw new Error("Failed to add lead");
      onSaved();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0B0F1A] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-sm font-bold mb-5">Add Lead</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { field: "email", label: "Email *", placeholder: "name@company.com", required: true },
            { field: "name", label: "Name", placeholder: "Jane Smith" },
            { field: "title", label: "Job Title", placeholder: "Head of Sales" },
            { field: "company_name", label: "Company", placeholder: "Acme Corp" },
            { field: "company_website", label: "Company Website", placeholder: "https://acme.com" },
          ].map(({ field, label, placeholder, required }) => (
            <div key={field}>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                {label}
              </label>
              <input
                type={field === "email" ? "email" : "text"}
                required={required}
                placeholder={placeholder}
                value={(form as any)[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Adding…" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [assignments, setAssignments] = useState<LeadAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLeadForSequence, setSelectedLeadForSequence] = useState<Lead | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("companyName") || searchParams.get("email") || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefillConsumedRef = useRef(false);

  const prefillLeadForm = {
    email: searchParams.get("email") || "",
    name: searchParams.get("name") || "",
    title: searchParams.get("title") || "",
    company_name: searchParams.get("companyName") || "",
    company_website: searchParams.get("companyWebsite") || "",
  };

  async function fetchLeads() {
    try {
      const [leadRes, sequenceRes, assignmentRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/sequences"),
        fetch("/api/lead-sequences"),
      ]);
      if (!leadRes.ok) throw new Error("Failed to fetch leads");
      const leadData = await leadRes.json();
      setLeads(leadData.leads ?? []);

      if (sequenceRes.ok) {
        const sequenceData = await sequenceRes.json();
        setSequences(sequenceData.sequences ?? []);
      }

      if (assignmentRes.ok) {
        const assignmentData = await assignmentRes.json();
        setAssignments(assignmentData.assignments ?? []);
      }
    } catch {
      setError("Could not load leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLeads(); }, []);

  useEffect(() => {
    if (prefillConsumedRef.current) return;
    const shouldOpen = searchParams.get("add") === "1";
    const hasPrefill = Object.values(prefillLeadForm).some(Boolean);
    if (!shouldOpen && !hasPrefill) return;
    prefillConsumedRef.current = true;
    setShowAddModal(true);
  }, [searchParams, prefillLeadForm]);

  useEffect(() => {
    if (loading) return;
    const shouldStartSequence = searchParams.get("sequence") === "1";
    const companyName = searchParams.get("companyName") || "";
    if (!shouldStartSequence || !companyName || selectedLeadForSequence) return;
    const matchingLead = leads.find((lead) =>
      (lead.companyName || "").toLowerCase() === companyName.toLowerCase(),
    );
    if (matchingLead) {
      setSelectedLeadForSequence(matchingLead);
    }
  }, [loading, searchParams, leads, selectedLeadForSequence]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete(id: string) {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    try {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (!res.ok) {
        await fetchLeads(); // roll back on failure
      }
    } catch {
      await fetchLeads();
    }
  }

  const assignmentsByLead = new Map(assignments.map((assignment) => [assignment.leadId, assignment]));
  const visibleLeads = leads.filter((lead) => {
    const haystack = [
      lead.email,
      lead.name,
      lead.title,
      lead.companyName,
      lead.companyWebsite,
      assignmentsByLead.get(lead.id)?.sequenceName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return;

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const idx = (col: string) => headers.indexOf(col);

    const parsed = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        email: cols[idx("email")] ?? "",
        name: cols[idx("name")] ?? "",
        title: cols[idx("title")] ?? "",
        company_name: cols[idx("company_name")] ?? "",
        company_website: cols[idx("company_website")] ?? "",
        linkedin_url: cols[idx("linkedin_url")] ?? "",
      };
    }).filter((r) => r.email);

    if (parsed.length === 0) {
      showToast("No valid rows found in CSV");
      return;
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: parsed }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await fetchLeads();
      showToast(`Imported ${data.created} lead${data.created !== 1 ? "s" : ""}`);
    } catch {
      showToast("Import failed. Please try again.");
    }
  }

  return (
    <div className="p-8 bg-[#030014] min-h-screen">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#0B0F1A] border border-white/10 rounded-xl px-4 py-3 text-sm shadow-2xl">
          {toast}
        </div>
      )}

      {/* Add Lead modal */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSaved={fetchLeads}
          initialForm={prefillLeadForm}
        />
      )}
      {selectedLeadForSequence && (
        <SequenceModal
          lead={selectedLeadForSequence}
          sequences={sequences}
          assignment={assignmentsByLead.get(selectedLeadForSequence.id) ?? null}
          onClose={() => setSelectedLeadForSequence(null)}
          onSaved={async () => {
            await fetchLeads();
            showToast("Sequence attached");
          }}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-white/5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Leads</h3>
            <p className="mt-1 text-xs text-slate-500">
              Turn saved contacts into active sequence workflow without leaving this page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.href = "/api/leads/export"}
              className="bg-white/5 hover:bg-white/10 px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={handleImportClick}
              className="bg-white/5 hover:bg-white/10 px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <Upload size={14} /> Import CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <Plus size={14} /> Add Lead
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <div className="p-8 text-center text-sm text-slate-500">{error}</div>
        ) : leads.length === 0 ? (
          <div className="p-16 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-slate-500">No leads yet. Add your first lead to get started.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <Plus size={14} /> Add Lead
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-white/5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <label className="flex-1">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Search leads
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                    <Search size={14} className="text-slate-500" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search contact, company, title, or sequence"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </div>
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Leads</p>
                    <p className="mt-1 text-lg font-semibold text-white">{leads.length}</p>
                  </div>
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.08] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200/80">In sequence</p>
                    <p className="mt-1 text-lg font-semibold text-white">{assignments.length}</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200/80">Needs sequence</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {leads.filter((lead) => !assignmentsByLead.has(lead.id)).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {visibleLeads.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-slate-500">No leads match this search.</p>
              </div>
            ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/[0.02] text-[10px] uppercase font-black text-slate-500 tracking-widest border-b border-white/5">
              <tr>
                <th className="p-4">Contact</th>
                <th className="p-4">Company</th>
                <th className="p-4">Status</th>
                <th className="p-4">Signal</th>
                <th className="p-4">Workflow</th>
                <th className="p-4 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visibleLeads.map((lead) => {
                const status = STATUS_MAP[lead.status] ?? { label: lead.status, className: "text-slate-400" };
                const temp = lead.temperature ? TEMP_MAP[lead.temperature] : null;
                const assignment = assignmentsByLead.get(lead.id);
                return (
                  <tr key={lead.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-bold text-slate-200">{lead.name || lead.email}</p>
                      {lead.name && <p className="text-xs text-slate-500 font-mono">{lead.email}</p>}
                      {lead.title ? <p className="mt-1 text-xs text-slate-500">{lead.title}</p> : null}
                    </td>
                    <td className="p-4 text-sm text-slate-400 font-mono italic">
                      {lead.companyWebsite
                        ? lead.companyWebsite.replace(/^https?:\/\//, "")
                        : lead.companyName ?? "—"}
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-4">
                      {temp ? (
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${temp.className}`}>
                          {temp.label}
                        </span>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      {assignment ? (
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-white">{assignment.sequenceName}</p>
                            <p className="text-[11px] text-slate-500">
                              Step {assignment.currentStep + 1} of {assignment.totalSteps} • {assignment.status}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setSelectedLeadForSequence(lead)}
                              className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                            >
                              Change
                            </button>
                            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                              Last touch {formatRelative(assignment.startedAt || lead.lastContactedAt)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2">
                            <p className="text-[11px] text-slate-400">No sequence attached yet.</p>
                          </div>
                          <button
                            onClick={() => setSelectedLeadForSequence(lead)}
                            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition-colors hover:bg-purple-500"
                          >
                            <Sparkles size={12} />
                            Start Sequence
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                        aria-label="Delete lead"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
