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
    const keysRes = await fetch("/api/api-keys", { headers: headers() }).catch(() => null);
    if (keysRes?.ok) {
      const data = await keysRes.json();
      setKeys(data.keys || []);
    }
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
                <p className="text-xs text-zinc-500">Sync leads bidirectionally with HubSpot</p>
              </div>
            </div>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-full">Coming soon</span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-400 font-bold text-sm">
                S
              </div>
              <div>
                <p className="text-sm font-medium">Salesforce</p>
                <p className="text-xs text-zinc-500">Sync leads bidirectionally with Salesforce</p>
              </div>
            </div>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-full">Coming soon</span>
          </div>
        </div>
      </section>

      {/* Billing */}
      <BillingSection />

      {/* Account */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </section>

      {/* Danger zone */}
      <DeleteAccountSection />
    </div>
  );
}

function DeleteAccountSection() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function handleDelete() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);

    try {
      const res = await fetch("/api/auth/delete-account", { method: "DELETE" });
      if (res.ok) {
        signOut({ callbackUrl: "/?deleted=true" });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete account.");
        setDeleting(false);
      }
    } catch {
      alert("Something went wrong.");
      setDeleting(false);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4 text-red-400">Danger Zone</h2>
      <div className="bg-zinc-900 border border-red-900/40 rounded-lg p-4">
        {!confirming ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Delete account</p>
              <p className="text-xs text-zinc-500">
                Permanently delete your account, leads, API keys, and all associated data.
              </p>
            </div>
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              Delete account
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-red-300 mb-3">
              This action is irreversible. Your subscription will be cancelled and all data permanently deleted.
            </p>
            <p className="text-xs text-zinc-400 mb-2">
              Type <span className="font-mono text-red-400 font-bold">DELETE</span> to confirm:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="flex-1 bg-black border border-red-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-600"
              />
              <button
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || deleting}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {deleting ? "Deleting..." : "Confirm delete"}
              </button>
              <button
                onClick={() => { setConfirming(false); setConfirmText(""); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
