"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type IntegrationState = {
  connected: boolean;
  lastSyncAt?: string | null;
};

export default function IntegrationsSettingsPage() {
  const searchParams = useSearchParams();
  const [hubspot, setHubspot] = useState<IntegrationState>({ connected: false });
  const [salesforce, setSalesforce] = useState<IntegrationState>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<"hubspot" | "salesforce" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const [hs, sf] = await Promise.all([
        fetch("/api/integrations/hubspot/status").then((r) => r.json()).catch(() => ({ connected: false })),
        fetch("/api/integrations/salesforce/status").then((r) => r.json()).catch(() => ({ connected: false })),
      ]);
      setHubspot(hs);
      setSalesforce(sf);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();

    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success) {
      const provider = success.includes("hubspot") ? "HubSpot" : "Salesforce";
      setMessage({ type: "success", text: `${provider} connected successfully.` });
    } else if (error) {
      const provider = error.includes("hubspot") ? "HubSpot" : "Salesforce";
      setMessage({ type: "error", text: `Failed to connect ${provider}. Please try again.` });
    }
  }, [searchParams]);

  async function disconnect(provider: "hubspot" | "salesforce") {
    setDisconnecting(provider);
    setMessage(null);
    try {
      await fetch(`/api/integrations/${provider}/status`, { method: "DELETE" });
      await loadStatus();
    } catch {
      setMessage({ type: "error", text: `Failed to disconnect ${provider}. Please try again.` });
    } finally {
      setDisconnecting(null);
    }
  }

  const row = (provider: "hubspot" | "salesforce", title: string, state: IntegrationState, color: string) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${color}`}>{title[0]}</div>
        <div>
          <p className="text-sm font-medium text-zinc-100">{title}</p>
          <p className="text-xs text-zinc-500">
            {state.connected ? `Connected${state.lastSyncAt ? ` • Last sync ${new Date(state.lastSyncAt).toLocaleString()}` : ""}` : "Not connected"}
          </p>
        </div>
      </div>
      <div>
        {state.connected ? (
          <button
            onClick={() => disconnect(provider)}
            disabled={disconnecting === provider}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-300 hover:text-red-200 hover:bg-red-950/30 disabled:opacity-50"
          >
            {disconnecting === provider ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <a
            href={`/api/integrations/${provider}/connect`}
            className="text-xs px-3 py-1.5 rounded-lg border border-violet-800 text-violet-300 hover:text-violet-200 hover:bg-violet-950/30"
          >
            Connect
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">CRM Integrations</h1>
      <p className="text-sm text-zinc-500 mb-6">Connect HubSpot and Salesforce to push generated hooks as CRM activities.</p>
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${message.type === "success" ? "bg-emerald-900/30 border border-emerald-800 text-emerald-300" : "bg-red-900/30 border border-red-800 text-red-300"}`}>
          {message.text}
        </div>
      )}
      {loading ? (
        <div className="text-zinc-500 text-sm">Loading connections...</div>
      ) : (
        <div className="space-y-3">
          {row("hubspot", "HubSpot", hubspot, "bg-orange-600/20 text-orange-400")}
          {row("salesforce", "Salesforce", salesforce, "bg-blue-600/20 text-blue-400")}
        </div>
      )}
    </div>
  );
}
