import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";

import followupCore from "@/lib/n8n-templates/followup-core.json";
import hubspotSync from "@/lib/n8n-templates/hubspot-sync.json";
import salesforceSync from "@/lib/n8n-templates/salesforce-sync.json";
import customWebhook from "@/lib/n8n-templates/custom-webhook.json";

const TEMPLATES = {
  "followup-core": {
    id: "followup-core",
    name: "Follow-Up Engine Core",
    description:
      "Automated follow-up sequences with safety checks, batching, and audit logging. Polls for due leads every 4 hours.",
    category: "automation",
    requiredCredentials: ["GSH_AUTH", "GMAIL_CRED"],
    requiredVars: ["GSH_API_BASE", "SENDER_EMAIL"],
    workflow: followupCore,
  },
  "hubspot-sync": {
    id: "hubspot-sync",
    name: "HubSpot CRM Sync",
    description:
      "Bidirectional sync between GetSignalHooks and HubSpot. Pushes lead status updates to HubSpot contacts and imports new HubSpot contacts into GSH.",
    category: "crm",
    requiredCredentials: ["GSH_AUTH", "HUBSPOT_AUTH"],
    requiredVars: ["GSH_API_BASE"],
    workflow: hubspotSync,
  },
  "salesforce-sync": {
    id: "salesforce-sync",
    name: "Salesforce CRM Sync",
    description:
      "Bidirectional sync between GetSignalHooks and Salesforce. Pushes lead status to Salesforce Lead objects and imports new Salesforce leads into GSH.",
    category: "crm",
    requiredCredentials: ["GSH_AUTH", "SF_AUTH"],
    requiredVars: ["GSH_API_BASE", "SF_INSTANCE_URL"],
    workflow: salesforceSync,
  },
  "custom-webhook": {
    id: "custom-webhook",
    name: "Custom Webhook Integration",
    description:
      "Generic webhook endpoint that accepts JSON payloads and routes to GSH actions: import_leads, generate_hooks, or trigger_followup.",
    category: "integration",
    requiredCredentials: ["GSH_AUTH"],
    requiredVars: ["GSH_API_BASE"],
    workflow: customWebhook,
  },
} as const;

type TemplateId = keyof typeof TEMPLATES;

/** GET /api/n8n-templates — list all templates (metadata only) */
/** GET /api/n8n-templates?id=followup-core — get full template with workflow JSON */
export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  const url = new URL(request.url);
  const id = url.searchParams.get("id") as TemplateId | null;

  if (id) {
    const template = TEMPLATES[id];
    if (!template) {
      return NextResponse.json(
        {
          status: "error",
          code: "NOT_FOUND",
          message: `Template '${id}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
        },
        { status: 404 },
      );
    }
    return NextResponse.json(template);
  }

  // List mode — return metadata without full workflow JSON
  const list = Object.values(TEMPLATES).map(({ workflow: _w, ...meta }) => meta);
  return NextResponse.json({ templates: list });
}
