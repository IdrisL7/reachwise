import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const API_BASE = "https://app.getsignalhooks.com";

const endpoints = [
  {
    method: "POST",
    path: "/api/leads",
    auth: true,
    description: "Create leads in batch. Duplicates by email are silently skipped.",
    body: `{
  "leads": [
    {
      "email": "jane@acme.com",
      "name": "Jane Doe",
      "title": "VP Sales",
      "company_name": "Acme Inc",
      "company_website": "https://acme.com",
      "source": "apollo"
    }
  ]
}`,
    response: `{ "created": 1, "leads": [{ "id": "...", "email": "jane@acme.com", ... }] }`,
  },
  {
    method: "GET",
    path: "/api/leads",
    auth: true,
    description:
      "List leads. Optional query params: status (cold|in_conversation|won|lost|unreachable), limit (max 500).",
    body: null,
    response: `{ "leads": [{ "id": "...", "email": "...", "status": "cold", ... }] }`,
  },
  {
    method: "POST",
    path: "/api/generate-hooks",
    auth: false,
    description:
      "Generate evidence-first hooks from a company URL or name. Returns hooks with confidence scores and evidence tiers.",
    body: `{
  "url": "https://acme.com",
  "company_name": "Acme Inc"
}`,
    response: `{
  "hooks": [
    {
      "text": "...",
      "angle": "trigger",
      "confidence": "high",
      "evidence_tier": "A",
      "source_snippet": "..."
    }
  ]
}`,
  },
  {
    method: "POST",
    path: "/api/generate-hooks-batch",
    auth: false,
    description: "Batch hook generation for multiple URLs (up to 75 for Pro tier).",
    body: `{ "urls": ["https://acme.com", "https://example.com"] }`,
    response: `{ "results": [{ "url": "...", "hooks": [...] }] }`,
  },
  {
    method: "POST",
    path: "/api/generate-followup",
    auth: true,
    description:
      "Generate a follow-up email for a lead at a given sequence step. Uses angle rotation to avoid repeating hooks.",
    body: `{
  "lead_id": "uuid-here",
  "step": 1,
  "mode": "send",
  "avoid_angle": "trigger"
}`,
    response: `{
  "email": { "subject": "...", "body": "..." },
  "meta": { "angle": "risk", "confidence": "high" }
}`,
  },
  {
    method: "GET",
    path: "/api/followup/due",
    auth: true,
    description: "Check which leads are due for follow-up. Used by the n8n Follow-Up Engine workflow.",
    body: null,
    response: `{
  "leads": [
    {
      "lead_id": "...",
      "email_to": "...",
      "followup_step": 1,
      "mode": "send"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/n8n-templates",
    auth: true,
    description:
      "List available n8n workflow templates. Add ?id=<template-id> to get the full workflow JSON for import.",
    body: null,
    response: `{
  "templates": [
    {
      "id": "followup-core",
      "name": "Follow-Up Engine Core",
      "category": "automation",
      "requiredCredentials": ["GSH_AUTH", "GMAIL_CRED"]
    }
  ]
}`,
  },
  {
    method: "POST",
    path: "/api/api-keys",
    auth: true,
    description:
      "Create a new API key. The full key is only shown once in the response. Requires the master bearer token.",
    body: `{
  "name": "My Integration",
  "scopes": ["leads", "hooks", "followups"],
  "expires_at": "2026-12-31T00:00:00Z"
}`,
    response: `{
  "id": "...",
  "name": "My Integration",
  "key": "gsh_abc123...",
  "key_prefix": "gsh_abc12345",
  "scopes": ["leads", "hooks", "followups"]
}`,
  },
];

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-900/50 text-emerald-400 border-emerald-700",
    POST: "bg-blue-900/50 text-blue-400 border-blue-700",
    DELETE: "bg-red-900/50 text-red-400 border-red-700",
    PATCH: "bg-amber-900/50 text-amber-400 border-amber-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-mono font-bold rounded border ${colors[method] ?? "bg-zinc-800 text-zinc-400 border-zinc-600"}`}
    >
      {method}
    </span>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100 font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold mb-4">API Documentation</h1>
        <p className="text-zinc-400 mb-8 text-lg">
          Integrate GetSignalHooks into your workflow. All authenticated
          endpoints accept a Bearer token via the{" "}
          <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded text-sm">
            Authorization
          </code>{" "}
          header.
        </p>

        {/* Auth section */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <p className="text-zinc-300 mb-4">
              You can authenticate using either your <strong>master bearer token</strong>{" "}
              (set in your environment) or a <strong>self-serve API key</strong>{" "}
              (prefixed with <code className="text-emerald-400">gsh_</code>).
            </p>
            <div className="bg-black rounded-md p-4 font-mono text-sm text-zinc-300">
              <span className="text-zinc-500"># Using bearer token</span>
              <br />
              curl -H &quot;Authorization: Bearer YOUR_TOKEN&quot; \<br />
              &nbsp;&nbsp;{API_BASE}/api/leads
              <br />
              <br />
              <span className="text-zinc-500"># Using API key</span>
              <br />
              curl -H &quot;Authorization: Bearer gsh_your_api_key&quot; \<br />
              &nbsp;&nbsp;{API_BASE}/api/leads
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Endpoints</h2>
          <div className="space-y-8">
            {endpoints.map((ep) => (
              <div
                key={`${ep.method}-${ep.path}`}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
              >
                <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
                  <MethodBadge method={ep.method} />
                  <code className="text-sm font-mono text-zinc-200">
                    {ep.path}
                  </code>
                  {ep.auth && (
                    <span className="ml-auto text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-800">
                      Auth required
                    </span>
                  )}
                </div>
                <div className="px-6 py-4">
                  <p className="text-zinc-400 text-sm mb-4">{ep.description}</p>

                  {ep.body && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                        Request Body
                      </p>
                      <pre className="bg-black rounded-md p-4 text-xs font-mono text-zinc-300 overflow-x-auto">
                        {ep.body}
                      </pre>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                      Response
                    </p>
                    <pre className="bg-black rounded-md p-4 text-xs font-mono text-zinc-300 overflow-x-auto">
                      {ep.response}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rate limits */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold mb-4">Rate Limits</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-3">Tier</th>
                  <th className="pb-3">Hooks / month</th>
                  <th className="pb-3">Batch size</th>
                  <th className="pb-3">Follow-Up Engine</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-t border-zinc-800">
                  <td className="py-3">Starter ($29)</td>
                  <td className="py-3">~200</td>
                  <td className="py-3">10 URLs</td>
                  <td className="py-3 text-zinc-600">-</td>
                </tr>
                <tr className="border-t border-zinc-800">
                  <td className="py-3">Pro ($149)</td>
                  <td className="py-3">~750</td>
                  <td className="py-3">75 URLs</td>
                  <td className="py-3 text-emerald-400">Included</td>
                </tr>
                <tr className="border-t border-zinc-800">
                  <td className="py-3">Concierge ($499)</td>
                  <td className="py-3">Unlimited</td>
                  <td className="py-3">75 URLs</td>
                  <td className="py-3 text-emerald-400">Managed</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
