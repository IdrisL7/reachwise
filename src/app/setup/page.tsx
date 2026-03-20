"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

type Step = "welcome" | "api_key" | "crm" | "n8n" | "complete";

interface ApiKeyResult {
  key: string;
  key_prefix: string;
  id: string;
}

interface IntegrationStatus {
  connected: boolean;
  auth_url: string;
  integration: { id: string; status: string; lastSyncAt: string | null } | null;
}

interface N8nInstance {
  id: string;
  name: string;
  port: number;
  status: string;
  webhookUrl: string;
  publicUrl: string;
}

export default function SetupWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [token, setToken] = useState("");
  const [apiKey, setApiKey] = useState<ApiKeyResult | null>(null);
  const [keyName, setKeyName] = useState("My Integration");
  const [hubspot, setHubspot] = useState<IntegrationStatus | null>(null);
  const [salesforce, setSalesforce] = useState<IntegrationStatus | null>(null);
  const [n8nInstance, setN8nInstance] = useState<N8nInstance | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check URL params for OAuth callback results
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const errorParam = params.get("error");

    if (success?.includes("connected")) {
      setStep("crm");
    }
    if (errorParam) {
      setError(`Connection failed: ${params.get("message") || errorParam}`);
      setStep("crm");
    }

    // Clean URL
    if (success || errorParam) {
      window.history.replaceState({}, "", "/setup");
    }
  }, []);

  const headers = () => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  async function createApiKey() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: keyName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create API key");
      }
      const data = await res.json();
      setApiKey(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadIntegrationStatus() {
    setLoading(true);
    setError("");
    try {
      const [hsRes, sfRes] = await Promise.all([
        fetch("/api/integrations/hubspot", { headers: headers() }),
        fetch("/api/integrations/salesforce", { headers: headers() }),
      ]);
      if (hsRes.ok) setHubspot(await hsRes.json());
      if (sfRes.ok) setSalesforce(await sfRes.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function provisionN8n() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/n8n-instances", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name: instanceName || "default",
          templates: ["followup-core", "custom-webhook"],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to provision n8n");
      }
      const data = await res.json();
      setN8nInstance(data.instance);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const steps: { id: Step; label: string; number: number }[] = [
    { id: "welcome", label: "Welcome", number: 1 },
    { id: "api_key", label: "API Key", number: 2 },
    { id: "crm", label: "CRM", number: 3 },
    { id: "n8n", label: "Automation", number: 4 },
    { id: "complete", label: "Done", number: 5 },
  ];

  const currentIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 font-[family-name:var(--font-body)]">
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 py-20">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-12">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  i <= currentIndex
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {i < currentIndex ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  s.number
                )}
              </div>
              <span
                className={`text-xs hidden sm:block ${
                  i <= currentIndex ? "text-zinc-300" : "text-zinc-600"
                }`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-px ${
                    i < currentIndex ? "bg-emerald-600" : "bg-zinc-800"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
            <button
              onClick={() => setError("")}
              className="float-right text-red-400 hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step: Welcome */}
        {step === "welcome" && (
          <div>
            <h1 className="text-3xl font-bold mb-4">Setup Wizard</h1>
            <p className="text-zinc-400 mb-6">
              This wizard will help you configure GetSignalHooks with API
              access, CRM integration, and workflow automation.
            </p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
              <label className="block text-sm text-zinc-400 mb-2">
                Enter your admin bearer token to begin:
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Your FOLLOWUP_ENGINE_API_TOKEN"
                className="w-full bg-black border border-zinc-700 rounded-md px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <button
              onClick={() => {
                if (!token.trim()) {
                  setError("Token is required");
                  return;
                }
                setStep("api_key");
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              Begin Setup
            </button>
          </div>
        )}

        {/* Step: API Key */}
        {step === "api_key" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Create an API Key</h2>
            <p className="text-zinc-400 mb-6">
              Generate a <code className="text-emerald-400">gsh_</code>{" "}
              prefixed API key for your integrations. This key will only be shown
              once.
            </p>

            {!apiKey ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                <label className="block text-sm text-zinc-400 mb-2">
                  Key name:
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-md px-4 py-2.5 text-zinc-100 mb-4 focus:outline-none focus:border-emerald-600"
                />
                <button
                  onClick={createApiKey}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
                >
                  {loading ? "Creating..." : "Generate API Key"}
                </button>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                <p className="text-sm text-zinc-400 mb-2">
                  Your API key (copy it now — it won&apos;t be shown again):
                </p>
                <div className="bg-black rounded-md p-4 font-mono text-sm text-emerald-400 break-all select-all">
                  {apiKey.key}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Prefix: {apiKey.key_prefix}...
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("welcome")}
                className="text-zinc-400 hover:text-zinc-200 px-4 py-2.5 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => {
                  loadIntegrationStatus();
                  setStep("crm");
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                {apiKey ? "Next: CRM Setup" : "Skip for now"}
              </button>
            </div>
          </div>
        )}

        {/* Step: CRM */}
        {step === "crm" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Connect Your CRM</h2>
            <p className="text-zinc-400 mb-6">
              Connect HubSpot or Salesforce for bidirectional lead sync.
              You can connect one or both.
            </p>

            {/* HubSpot */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center text-orange-400 font-bold text-lg">
                    H
                  </div>
                  <div>
                    <h3 className="font-semibold">HubSpot</h3>
                    <p className="text-xs text-zinc-500">
                      {hubspot?.connected
                        ? `Connected${hubspot.integration?.lastSyncAt ? ` — last sync ${hubspot.integration.lastSyncAt}` : ""}`
                        : "Not connected"}
                    </p>
                  </div>
                </div>
                {hubspot?.connected ? (
                  <span className="text-emerald-400 text-sm font-medium">
                    Connected
                  </span>
                ) : (
                  <a
                    href={hubspot?.auth_url || "#"}
                    className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Connect HubSpot
                  </a>
                )}
              </div>
            </div>

            {/* Salesforce */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-400 font-bold text-lg">
                    S
                  </div>
                  <div>
                    <h3 className="font-semibold">Salesforce</h3>
                    <p className="text-xs text-zinc-500">
                      {salesforce?.connected
                        ? `Connected${salesforce.integration?.lastSyncAt ? ` — last sync ${salesforce.integration.lastSyncAt}` : ""}`
                        : "Not connected"}
                    </p>
                  </div>
                </div>
                {salesforce?.connected ? (
                  <span className="text-emerald-400 text-sm font-medium">
                    Connected
                  </span>
                ) : (
                  <a
                    href={salesforce?.auth_url || "#"}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Connect Salesforce
                  </a>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("api_key")}
                className="text-zinc-400 hover:text-zinc-200 px-4 py-2.5 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep("n8n")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                Next: Automation
              </button>
            </div>
          </div>
        )}

        {/* Step: n8n */}
        {step === "n8n" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Workflow Automation</h2>
            <p className="text-zinc-400 mb-6">
              Provision a dedicated n8n instance pre-loaded with your workflow
              templates. This creates an isolated Docker container.
            </p>

            {!n8nInstance ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                <label className="block text-sm text-zinc-400 mb-2">
                  Instance name:
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="e.g. my-company"
                  className="w-full bg-black border border-zinc-700 rounded-md px-4 py-2.5 text-zinc-100 mb-4 focus:outline-none focus:border-emerald-600"
                />
                <button
                  onClick={provisionN8n}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
                >
                  {loading ? "Provisioning..." : "Provision n8n Instance"}
                </button>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-medium text-sm">
                    {n8nInstance.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Public URL</span>
                    <a
                      href={n8nInstance.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline font-mono"
                    >
                      {n8nInstance.publicUrl}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Internal port</span>
                    <span className="text-zinc-300 font-mono">
                      {n8nInstance.port}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("crm")}
                className="text-zinc-400 hover:text-zinc-200 px-4 py-2.5 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep("complete")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                {n8nInstance ? "Finish" : "Skip for now"}
              </button>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-4">Setup Complete</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Your GetSignalHooks environment is configured. You can manage
              everything from the dashboard or via the API.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">API Key</p>
                <p className="text-sm font-medium">
                  {apiKey ? (
                    <span className="text-emerald-400">
                      {apiKey.key_prefix}...
                    </span>
                  ) : (
                    <span className="text-zinc-600">Skipped</span>
                  )}
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">CRM</p>
                <p className="text-sm font-medium">
                  {hubspot?.connected && salesforce?.connected ? (
                    <span className="text-emerald-400">Both connected</span>
                  ) : hubspot?.connected ? (
                    <span className="text-emerald-400">HubSpot</span>
                  ) : salesforce?.connected ? (
                    <span className="text-emerald-400">Salesforce</span>
                  ) : (
                    <span className="text-zinc-600">None</span>
                  )}
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">n8n</p>
                <p className="text-sm font-medium">
                  {n8nInstance ? (
                    <span className="text-emerald-400">
                      Port {n8nInstance.port}
                    </span>
                  ) : (
                    <span className="text-zinc-600">Skipped</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <a
                href="/docs"
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                View API Docs
              </a>
              <a
                href="/internal/followup-dashboard"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
