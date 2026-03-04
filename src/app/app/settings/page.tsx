"use client";

import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

interface Integration {
  connected: boolean;
  integration: { id: string; status: string; lastSyncAt: string | null } | null;
  auth_url: string;
}

function BillingSection() {
  const { data: session } = useSession();
  const tierId = (session?.user as any)?.tierId || "starter";
  const [billingLoading, setBillingLoading] = useState(false);

  async function openPortal() {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleUpgrade(targetTier: string) {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: targetTier }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBillingLoading(false);
    }
  }

  const nextTier = tierId === "starter" ? "pro" : tierId === "pro" ? "concierge" : null;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-4">Billing</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Current Plan</p>
            <p className="text-xs text-zinc-500 capitalize">{tierId}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openPortal}
              disabled={billingLoading}
              className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              Manage Subscription
            </button>
            {nextTier && (
              <button
                onClick={() => handleUpgrade(nextTier)}
                disabled={billingLoading}
                className="text-xs text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                Upgrade to {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [hubspot, setHubspot] = useState<Integration | null>(null);
  const [salesforce, setSalesforce] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(false);

  function getToken(): string {
    return localStorage.getItem("gsh_token") || "";
  }

  const headers = () => ({
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [keysRes, hsRes, sfRes] = await Promise.all([
      fetch("/api/api-keys", { headers: headers() }).catch(() => null),
      fetch("/api/integrations/hubspot", { headers: headers() }).catch(() => null),
      fetch("/api/integrations/salesforce", { headers: headers() }).catch(() => null),
    ]);

    if (keysRes?.ok) {
      const data = await keysRes.json();
      setKeys(data.keys || []);
    }
    if (hsRes?.ok) setHubspot(await hsRes.json());
    if (sfRes?.ok) setSalesforce(await sfRes.json());
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: newKeyName }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key);
        setNewKeyName("");
        loadData();
      }
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: string) {
    await fetch(`/api/api-keys?id=${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    loadData();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {/* API Keys */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">API Keys</h2>

        {newKey && (
          <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-emerald-300 mb-2">
              New key created (copy now — shown once):
            </p>
            <code className="text-sm text-emerald-400 font-mono break-all select-all">
              {newKey}
            </code>
            <button
              onClick={() => setNewKey("")}
              className="block text-xs text-zinc-500 mt-2 hover:text-zinc-300"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production)"
              className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
            />
            <button
              onClick={createKey}
              disabled={loading || !newKeyName.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Create
            </button>
          </div>
        </div>

        {keys.length > 0 && (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {key.keyPrefix}...
                    {key.lastUsedAt && (
                      <span className="ml-2">
                        Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => revokeKey(key.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Integrations */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Integrations</h2>
        <div className="space-y-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-600/20 rounded-lg flex items-center justify-center text-orange-400 font-bold text-sm">
                H
              </div>
              <div>
                <p className="text-sm font-medium">HubSpot</p>
                <p className="text-xs text-zinc-500">
                  {hubspot?.connected ? "Connected" : "Not connected"}
                </p>
              </div>
            </div>
            {hubspot?.connected ? (
              <span className="text-xs text-emerald-400">Active</span>
            ) : (
              <a
                href={hubspot?.auth_url || "#"}
                className="text-xs text-emerald-400 hover:underline"
              >
                Connect
              </a>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-400 font-bold text-sm">
                S
              </div>
              <div>
                <p className="text-sm font-medium">Salesforce</p>
                <p className="text-xs text-zinc-500">
                  {salesforce?.connected ? "Connected" : "Not connected"}
                </p>
              </div>
            </div>
            {salesforce?.connected ? (
              <span className="text-xs text-emerald-400">Active</span>
            ) : (
              <a
                href={salesforce?.auth_url || "#"}
                className="text-xs text-emerald-400 hover:underline"
              >
                Connect
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Billing */}
      <BillingSection />

      {/* Account */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
