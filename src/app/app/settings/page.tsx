"use client";

import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  OFFER_CATEGORIES,
  PROFILE_PRESETS,
} from "@/lib/workspace";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1k", "1k+"];

const BUYER_ROLES = [
  "VP Sales",
  "RevOps",
  "Marketing",
  "Founder",
  "CTO",
  "SDR Manager",
  "Head of Growth",
  "Other",
];

const PRIMARY_OUTCOMES = [
  "Pipeline",
  "Meetings",
  "Conversion",
  "Retention",
  "Cost",
  "Risk",
  "Speed",
  "Compliance",
];

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ProfileData {
  whatYouSell: string;
  icpIndustry: string;
  icpCompanySize: string;
  buyerRoles: string[];
  primaryOutcome: string;
  offerCategory: string;
  proof?: string[] | null;
  updatedAt?: string;
}

function SenderProfileSection() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  // Form state
  const [whatYouSell, setWhatYouSell] = useState("");
  const [icpIndustry, setIcpIndustry] = useState("");
  const [icpCompanySize, setIcpCompanySize] = useState("");
  const [buyerRoles, setBuyerRoles] = useState<string[]>([]);
  const [primaryOutcome, setPrimaryOutcome] = useState("");
  const [offerCategory, setOfferCategory] = useState("");
  const [proof, setProof] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await fetch("/api/workspace-profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          populateForm(data.profile);
        }
      }
    } catch {
      // Ignore load errors
    } finally {
      setLoading(false);
    }
  }

  function populateForm(p: ProfileData) {
    setWhatYouSell(p.whatYouSell || "");
    setIcpIndustry(p.icpIndustry || "");
    setIcpCompanySize(p.icpCompanySize || "");
    setBuyerRoles(p.buyerRoles || []);
    setPrimaryOutcome(p.primaryOutcome || "");
    setOfferCategory(p.offerCategory || "");
    setProof(p.proof?.join("\n") ?? "");
  }

  function applyPreset(label: string) {
    const preset = PROFILE_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setWhatYouSell(preset.whatYouSell);
    setIcpIndustry(preset.icpIndustry);
    setIcpCompanySize(preset.icpCompanySize);
    setBuyerRoles([...preset.buyerRoles]);
    setPrimaryOutcome(preset.primaryOutcome);
    setOfferCategory(preset.offerCategory);
    setValidationError("");
  }

  function toggleRole(role: string) {
    setBuyerRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function validate(): boolean {
    if (!whatYouSell.trim()) {
      setValidationError("Please describe what you sell.");
      return false;
    }
    if (!icpIndustry.trim()) {
      setValidationError("Please enter your industry.");
      return false;
    }
    if (!icpCompanySize) {
      setValidationError("Please select a company size.");
      return false;
    }
    if (buyerRoles.length === 0) {
      setValidationError("Please select at least one buyer role.");
      return false;
    }
    if (!primaryOutcome) {
      setValidationError("Please select a primary outcome.");
      return false;
    }
    if (!offerCategory) {
      setValidationError("Please select an offer category.");
      return false;
    }
    setValidationError("");
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      const proofLines = proof
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const res = await fetch("/api/workspace-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatYouSell: whatYouSell.trim(),
          icpIndustry: icpIndustry.trim(),
          icpCompanySize,
          buyerRoles,
          primaryOutcome,
          offerCategory,
          proof: proofLines.length > 0 ? proofLines : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile.");
      }

      const data = await res.json();
      setProfile({
        whatYouSell: whatYouSell.trim(),
        icpIndustry: icpIndustry.trim(),
        icpCompanySize,
        buyerRoles,
        primaryOutcome,
        offerCategory,
        proof: proofLines.length > 0 ? proofLines : null,
        updatedAt: data.updatedAt,
      });
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Sender Profile</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-500">Loading profile...</p>
        </div>
      </section>
    );
  }

  // No profile yet — show setup prompt
  if (!profile && !editing) {
    return (
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Sender Profile</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
          <p className="text-sm text-zinc-400 mb-4">
            Set up your sender profile so hooks are personalized to your offer.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Set up your sender profile
          </button>
        </div>
      </section>
    );
  }

  // Profile exists and not editing — show summary
  if (profile && !editing) {
    return (
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Sender Profile</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1 min-w-0">
              <div>
                <p className="text-xs text-zinc-500">What you sell</p>
                <p className="text-sm text-zinc-200">{profile.whatYouSell}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-zinc-500">Industry</p>
                  <p className="text-sm text-zinc-200">{profile.icpIndustry}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Company size</p>
                  <p className="text-sm text-zinc-200">{profile.icpCompanySize}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Buyer roles</p>
                  <p className="text-sm text-zinc-200">{profile.buyerRoles.join(", ")}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Primary outcome</p>
                  <p className="text-sm text-zinc-200">{profile.primaryOutcome}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Offer category</p>
                  <p className="text-sm text-zinc-200">{formatCategory(profile.offerCategory)}</p>
                </div>
                {profile.proof && profile.proof.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500">Proof</p>
                    <p className="text-sm text-zinc-200">{profile.proof.join(", ")}</p>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors ml-4 shrink-0"
            >
              Edit
            </button>
          </div>
          {profile.updatedAt && (
            <p className="text-xs text-zinc-600">
              Last updated: {new Date(profile.updatedAt).toLocaleDateString()}
            </p>
          )}
          {saveSuccess && (
            <div className="bg-emerald-900/20 border border-emerald-800 text-emerald-300 px-3 py-2 rounded-lg text-sm">
              Profile saved successfully.
            </div>
          )}
        </div>
      </section>
    );
  }

  // Editing form (inline, not modal)
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-4">Sender Profile</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        {/* Preset dropdown */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Start from a template
          </label>
          <select
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
            }}
            defaultValue=""
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-600"
          >
            <option value="" disabled>
              Select a preset...
            </option>
            {PROFILE_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* What you sell */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            What you sell <span className="text-red-400">*</span>
          </label>
          <textarea
            value={whatYouSell}
            onChange={(e) => setWhatYouSell(e.target.value)}
            placeholder="Example: We help B2B teams book more meetings by generating evidence-backed outbound hooks."
            rows={2}
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 resize-none"
          />
          <p className="text-xs text-zinc-500 mt-1">
            One sentence. What you do + who it&apos;s for + the outcome.
          </p>
        </div>

        {/* Industry */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Industry <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={icpIndustry}
            onChange={(e) => setIcpIndustry(e.target.value)}
            placeholder="e.g., SaaS, FinTech, Healthcare, B2B Services"
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Company size */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Company size <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {COMPANY_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setIcpCompanySize(size)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  icpCompanySize === size
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Buyer roles */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Buyer role(s) <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {BUYER_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  buyerRoles.includes(role)
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Primary outcome */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Primary outcome <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PRIMARY_OUTCOMES.map((outcome) => (
              <button
                key={outcome}
                type="button"
                onClick={() => setPrimaryOutcome(outcome)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  primaryOutcome === outcome
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {outcome}
              </button>
            ))}
          </div>
        </div>

        {/* Offer category */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Offer category <span className="text-red-400">*</span>
          </label>
          <select
            value={offerCategory}
            onChange={(e) => setOfferCategory(e.target.value)}
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-600"
          >
            <option value="" disabled>
              Select a category...
            </option>
            {OFFER_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {formatCategory(cat)}
              </option>
            ))}
          </select>
        </div>

        {/* Proof (optional) */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Proof <span className="text-zinc-600">(optional)</span>
          </label>
          <textarea
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder={"Examples: 'Used by X', '+22% reply rate', 'SOC2', or 'No proof yet'"}
            rows={2}
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 resize-none"
          />
          <p className="text-xs text-zinc-500 mt-1">
            1-2 bullets max. One per line.
          </p>
        </div>

        {/* Errors */}
        {validationError && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-2.5 rounded-lg text-sm">
            {validationError}
          </div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-2.5 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? "Saving..." : profile ? "Save changes" : "Save profile"}
          </button>
          {profile && (
            <button
              onClick={() => {
                populateForm(profile);
                setEditing(false);
                setValidationError("");
                setError("");
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

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
  const [billingError, setBillingError] = useState("");

  async function openPortal() {
    setBillingLoading(true);
    setBillingError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setBillingError(data.error || "Failed to open billing portal.");
    } catch {
      setBillingError("Something went wrong. Please try again.");
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleUpgrade(targetTier: string) {
    setBillingLoading(true);
    setBillingError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: targetTier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setBillingError(data.error || "Failed to start checkout.");
    } catch {
      setBillingError("Something went wrong. Please try again.");
    } finally {
      setBillingLoading(false);
    }
  }

  const nextTier = tierId === "starter" ? "pro" : tierId === "pro" ? "concierge" : null;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-4">Billing</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        {billingError && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-2.5 rounded-lg text-sm">
            {billingError}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Current Plan</p>
            <p className="text-xs text-zinc-500 capitalize">{tierId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
  const [hubspotStatus, setHubspotStatus] = useState<"loading" | "connected" | "disconnected">("loading");

  function getToken(): string {
    return localStorage.getItem("gsh_token") || "";
  }

  const headers = () => ({
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  });

  useEffect(() => {
    loadData();
    loadHubspotStatus();
  }, []);

  async function loadData() {
    const keysRes = await fetch("/api/api-keys", { headers: headers() }).catch(() => null);
    if (keysRes?.ok) {
      const data = await keysRes.json();
      setKeys(data.keys || []);
    }
  }

  async function loadHubspotStatus() {
    const res = await fetch("/api/integrations/hubspot/status").catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setHubspotStatus(data.connected ? "connected" : "disconnected");
    } else {
      setHubspotStatus("disconnected");
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

      {/* Sender Profile */}
      <SenderProfileSection />

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Integrations</h2>
          <a href="/app/settings/integrations" className="text-xs text-violet-400 hover:text-violet-300">Manage CRM integrations</a>
        </div>
        <div className="space-y-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-600/20 rounded-lg flex items-center justify-center text-orange-400 font-bold text-sm shrink-0">
                H
              </div>
              <div>
                <p className="text-sm font-medium">HubSpot</p>
                <p className="text-xs text-zinc-500">
                  {hubspotStatus === "connected" ? "Connected" : "Sync leads bidirectionally with HubSpot"}
                </p>
              </div>
            </div>
            {hubspotStatus === "connected" ? (
              <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2.5 py-1 rounded-full">Connected</span>
            ) : hubspotStatus === "loading" ? (
              <span className="text-xs text-zinc-500">Loading...</span>
            ) : (
              <a
                href="/api/integrations/hubspot/connect"
                className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800 px-3 py-1.5 rounded-lg transition-colors"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-200">Delete account</p>
              <p className="text-xs text-zinc-500">
                Permanently delete your account, leads, API keys, and all associated data.
              </p>
            </div>
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-3 py-1.5 rounded-lg transition-colors shrink-0"
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
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="flex-1 min-w-[120px] bg-black border border-red-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-600"
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
