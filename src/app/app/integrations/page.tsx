"use client";

import { useState, useEffect, useCallback } from "react";

interface IntegrationStatus {
  connected: boolean;
  lastSyncAt: string | null;
}

type LoadState = "loading" | "loaded" | "error";

const INTEGRATIONS = [
  {
    id: "hubspot" as const,
    name: "HubSpot",
    description: "Sync leads bidirectionally with HubSpot CRM.",
    logoLetter: "H",
    logoBg: "bg-orange-600/20",
    logoText: "text-orange-400",
    connectUrl: "/api/integrations/hubspot/connect",
    statusUrl: "/api/integrations/hubspot/status",
    syncUrl: "/api/integrations/hubspot/sync",
  },
  {
    id: "salesforce" as const,
    name: "Salesforce",
    description: "Push and pull leads from Salesforce.",
    logoLetter: "S",
    logoBg: "bg-blue-600/20",
    logoText: "text-blue-400",
    connectUrl: "/api/integrations/salesforce/connect",
    statusUrl: "/api/integrations/salesforce/status",
    syncUrl: "/api/integrations/salesforce/sync",
  },
] as const;

type ProviderId = (typeof INTEGRATIONS)[number]["id"];

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<ProviderId, IntegrationStatus>>({
    hubspot: { connected: false, lastSyncAt: null },
    salesforce: { connected: false, lastSyncAt: null },
  });
  const [loadState, setLoadState] = useState<Record<ProviderId, LoadState>>({
    hubspot: "loading",
    salesforce: "loading",
  });
  const [actionLoading, setActionLoading] = useState<Record<ProviderId, boolean>>({
    hubspot: false,
    salesforce: false,
  });

  const fetchStatus = useCallback(async (provider: ProviderId, statusUrl: string) => {
    try {
      const res = await fetch(statusUrl);
      if (res.ok) {
        const data = await res.json();
        setStatuses((prev) => ({
          ...prev,
          [provider]: {
            connected: !!data.connected,
            lastSyncAt: data.lastSyncAt || null,
          },
        }));
        setLoadState((prev) => ({ ...prev, [provider]: "loaded" }));
      } else {
        setLoadState((prev) => ({ ...prev, [provider]: "loaded" }));
      }
    } catch {
      setLoadState((prev) => ({ ...prev, [provider]: "error" }));
    }
  }, []);

  useEffect(() => {
    for (const integration of INTEGRATIONS) {
      fetchStatus(integration.id, integration.statusUrl);
    }
  }, [fetchStatus]);

  async function handleDisconnect(provider: ProviderId) {
    if (!confirm(`Disconnect ${provider === "hubspot" ? "HubSpot" : "Salesforce"}?`)) return;

    setActionLoading((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch(`/api/integrations/${provider}`, { method: "DELETE" });
      if (res.ok) {
        setStatuses((prev) => ({
          ...prev,
          [provider]: { connected: false, lastSyncAt: null },
        }));
      }
    } catch {
      // ignore
    } finally {
      setActionLoading((prev) => ({ ...prev, [provider]: false }));
    }
  }

  async function handleSync(provider: ProviderId, syncUrl: string) {
    setActionLoading((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch(syncUrl, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setStatuses((prev) => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            lastSyncAt: data.syncedAt || new Date().toISOString(),
          },
        }));
      }
    } catch {
      // ignore
    } finally {
      setActionLoading((prev) => ({ ...prev, [provider]: false }));
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Integrations</h1>

      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => {
          const status = statuses[integration.id];
          const loading = loadState[integration.id] === "loading";
          const busy = actionLoading[integration.id];

          return (
            <div
              key={integration.id}
              className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 hover:border-purple-500/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div
                    className={`w-12 h-12 ${integration.logoBg} rounded-xl flex items-center justify-center ${integration.logoText} font-bold text-lg border border-white/5`}
                  >
                    {integration.logoLetter}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-100">
                        {integration.name}
                      </p>
                      {loading ? (
                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                          Checking…
                        </span>
                      ) : status.connected ? (
                        <span className="text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                          Connected
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                          Disconnected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {integration.description}
                    </p>
                    {status.connected && status.lastSyncAt && (
                      <p className="text-xs text-zinc-600 mt-1">
                        Last synced: {new Date(status.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {loading ? null : status.connected ? (
                    <>
                      <button
                        onClick={() => handleSync(integration.id, integration.syncUrl)}
                        disabled={busy}
                        className="text-xs text-slate-400 hover:text-slate-200 border border-white/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {busy ? "Syncing…" : "Sync Now"}
                      </button>
                      <button
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={busy}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <a
                      href={integration.connectUrl}
                      className="text-xs text-white bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-xl transition-colors font-bold"
                    >
                      Connect
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
