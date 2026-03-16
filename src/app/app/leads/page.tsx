"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";

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

interface AddLeadModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function AddLeadModal({ onClose, onSaved }: AddLeadModalProps) {
  const [form, setForm] = useState({
    email: "",
    name: "",
    title: "",
    company_name: "",
    company_website: "",
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchLeads() {
    try {
      const res = await fetch("/api/leads");
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      setLeads(data.leads ?? []);
    } catch {
      setError("Could not load leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLeads(); }, []);

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
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Leads</h3>
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
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/[0.02] text-[10px] uppercase font-black text-slate-500 tracking-widest border-b border-white/5">
              <tr>
                <th className="p-4">Contact</th>
                <th className="p-4">Company</th>
                <th className="p-4">Status</th>
                <th className="p-4">Signal</th>
                <th className="p-4 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leads.map((lead) => {
                const status = STATUS_MAP[lead.status] ?? { label: lead.status, className: "text-slate-400" };
                const temp = lead.temperature ? TEMP_MAP[lead.temperature] : null;
                return (
                  <tr key={lead.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-bold text-slate-200">{lead.name || lead.email}</p>
                      {lead.name && <p className="text-xs text-slate-500 font-mono">{lead.email}</p>}
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
      </div>
    </div>
  );
}
