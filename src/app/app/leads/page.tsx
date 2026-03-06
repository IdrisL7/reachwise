"use client";

import { useState, useEffect } from "react";

interface Lead {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  companyName: string | null;
  status: string;
  sequenceStep: number;
  createdAt: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvText, setCsvText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    try {
      const res = await fetch("/api/leads", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  function getToken(): string {
    // Will be replaced with session-based auth
    return localStorage.getItem("gsh_token") || "";
  }

  async function handleCsvUpload() {
    if (!csvText.trim()) return;
    setUploading(true);
    setMessage("");

    try {
      const lines = csvText.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const emailIdx = headers.findIndex((h) => h === "email");

      if (emailIdx === -1) {
        setMessage("CSV must have an 'email' column.");
        setUploading(false);
        return;
      }

      const nameIdx = headers.findIndex((h) => h === "name");
      const titleIdx = headers.findIndex((h) => h === "title");
      const companyIdx = headers.findIndex((h) =>
        ["company", "company_name", "companyname"].includes(h),
      );
      const websiteIdx = headers.findIndex((h) =>
        ["website", "company_website", "url"].includes(h),
      );

      const leadsData = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        return {
          email: cols[emailIdx],
          name: nameIdx >= 0 ? cols[nameIdx] : undefined,
          title: titleIdx >= 0 ? cols[titleIdx] : undefined,
          company_name: companyIdx >= 0 ? cols[companyIdx] : undefined,
          company_website: websiteIdx >= 0 ? cols[websiteIdx] : undefined,
        };
      }).filter((l) => l.email);

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ leads: leadsData }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Uploaded ${data.created} lead${data.created !== 1 ? "s" : ""}.`);
        setCsvText("");
        setShowUpload(false);
        fetchLeads();
      } else {
        setMessage(data.message || "Upload failed.");
      }
    } catch {
      setMessage("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== id));
        setMessage("Lead deleted.");
      } else {
        setMessage("Failed to delete lead.");
      }
    } catch {
      setMessage("Failed to delete lead.");
    } finally {
      setDeleting(null);
    }
  }

  const statusColors: Record<string, string> = {
    cold: "bg-blue-900/30 text-blue-400 border-blue-800",
    in_conversation: "bg-amber-900/30 text-amber-400 border-amber-800",
    won: "bg-emerald-900/30 text-emerald-400 border-emerald-800",
    lost: "bg-red-900/30 text-red-400 border-red-800",
    unreachable: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex items-center gap-2">
          {leads.length > 0 && (
            <a
              href="/api/leads/export"
              download
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Export CSV
            </a>
          )}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {showUpload ? "Cancel" : "Upload CSV"}
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {message}
        </div>
      )}

      {showUpload && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
          <p className="text-sm text-zinc-400 mb-3">
            Paste CSV with headers. Required: <code className="text-zinc-300">email</code>. Optional:{" "}
            <code className="text-zinc-300">name, title, company, website</code>.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            placeholder="email,name,title,company&#10;jane@acme.com,Jane Doe,VP Sales,Acme Inc"
            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 mb-3"
          />
          <button
            onClick={handleCsvUpload}
            disabled={uploading || !csvText.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : leads.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">No leads yet</h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-4">
            Upload a CSV from Apollo, Clay, or any spreadsheet to start managing
            your outbound pipeline. Or create leads via the API.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Upload CSV
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Step</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-t border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 text-zinc-200 font-mono text-xs">
                    {lead.email}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {lead.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {lead.companyName || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${statusColors[lead.status] || statusColors.cold}`}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {lead.sequenceStep}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteLead(lead.id)}
                      disabled={deleting === lead.id}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deleting === lead.id ? "..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
