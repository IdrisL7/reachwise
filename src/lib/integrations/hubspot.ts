import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

const HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_API_BASE = "https://api.hubapi.com";

interface HubSpotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface HubSpotContact {
  id: string;
  properties: Record<string, string>;
}

interface HubSpotSearchResponse {
  total: number;
  results: HubSpotContact[];
}

function getClientId(): string {
  const id = process.env.HUBSPOT_CLIENT_ID;
  if (!id) throw new Error("HUBSPOT_CLIENT_ID not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret) throw new Error("HUBSPOT_CLIENT_SECRET not set");
  return secret;
}

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/api/integrations/hubspot/callback`;
}

/** Build the HubSpot OAuth authorization URL */
export function getHubSpotAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: "crm.objects.contacts.read crm.objects.contacts.write",
    ...(state ? { state } : {}),
  });
  return `${HUBSPOT_AUTH_URL}?${params}`;
}

/** Exchange authorization code for tokens */
export async function exchangeHubSpotCode(code: string): Promise<HubSpotTokenResponse> {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      code,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Refresh an expired access token */
export async function refreshHubSpotToken(refreshToken: string): Promise<HubSpotTokenResponse> {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Get a valid access token, refreshing if needed */
async function getValidToken(integrationId: string): Promise<string> {
  const [integration] = await db
    .select()
    .from(schema.integrations)
    .where(
      and(
        eq(schema.integrations.id, integrationId),
        eq(schema.integrations.provider, "hubspot"),
      ),
    )
    .limit(1);

  if (!integration) throw new Error("HubSpot integration not found");

  // Check if token is expired (with 5 min buffer)
  if (
    integration.tokenExpiresAt &&
    new Date(integration.tokenExpiresAt).getTime() - 5 * 60 * 1000 < Date.now()
  ) {
    const tokens = await refreshHubSpotToken(integration.refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await db
      .update(schema.integrations)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.integrations.id, integrationId));

    return tokens.access_token;
  }

  return integration.accessToken;
}

/** Make an authenticated HubSpot API request */
async function hubspotFetch(
  integrationId: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getValidToken(integrationId);
  return fetch(`${HUBSPOT_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/** Search for a contact by email in HubSpot */
export async function searchHubSpotContact(
  integrationId: string,
  email: string,
): Promise<HubSpotContact | null> {
  const res = await hubspotFetch(integrationId, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: "EQ", value: email },
          ],
        },
      ],
      properties: [
        "email",
        "firstname",
        "lastname",
        "jobtitle",
        "company",
        "website",
        "gsh_status",
        "gsh_source",
      ],
      limit: 1,
    }),
  });

  if (!res.ok) return null;
  const data: HubSpotSearchResponse = await res.json();
  return data.results[0] ?? null;
}

/** Create a contact in HubSpot */
export async function createHubSpotContact(
  integrationId: string,
  lead: {
    email: string;
    name?: string | null;
    title?: string | null;
    companyName?: string | null;
    companyWebsite?: string | null;
    status?: string;
  },
): Promise<HubSpotContact> {
  const nameParts = (lead.name ?? "").split(" ");
  const res = await hubspotFetch(integrationId, "/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        email: lead.email,
        firstname: nameParts[0] || "",
        lastname: nameParts.slice(1).join(" ") || "",
        jobtitle: lead.title || "",
        company: lead.companyName || "",
        website: lead.companyWebsite || "",
        gsh_status: lead.status || "cold",
        gsh_source: "getsignalhooks",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot create contact failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Update a contact in HubSpot */
export async function updateHubSpotContact(
  integrationId: string,
  hubspotContactId: string,
  properties: Record<string, string>,
): Promise<void> {
  const res = await hubspotFetch(
    integrationId,
    `/crm/v3/objects/contacts/${hubspotContactId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot update contact failed: ${res.status} ${text}`);
  }
}

/** Fetch recent contacts from HubSpot that aren't from GSH */
export async function fetchNewHubSpotContacts(
  integrationId: string,
  limit = 100,
): Promise<HubSpotContact[]> {
  const res = await hubspotFetch(
    integrationId,
    `/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,jobtitle,company,website,gsh_source`,
  );

  if (!res.ok) return [];
  const data = await res.json();

  // Filter out contacts that originated from GSH
  return (data.results ?? []).filter(
    (c: HubSpotContact) => c.properties.gsh_source !== "getsignalhooks",
  );
}

/** Run a full bidirectional sync */
export async function pushHookToHubSpot(
  integrationId: string,
  hook: {
    companyName?: string | null;
    companyUrl: string;
    hookText: string;
    sourceUrl?: string;
    sourceTitle?: string;
    sourceDate?: string;
    sourceSnippet?: string;
    qualityScore?: number;
  },
): Promise<string> {
  const noteBody = [
    `Hook: ${hook.hookText}`,
    hook.qualityScore ? `Quality score: ${hook.qualityScore}/100` : null,
    hook.sourceSnippet ? `Evidence: ${hook.sourceSnippet}` : null,
    hook.sourceTitle || hook.sourceUrl ? `Source: ${hook.sourceTitle || hook.sourceUrl}` : null,
    hook.sourceDate ? `Date: ${hook.sourceDate}` : null,
    `Company URL: ${hook.companyUrl}`,
  ].filter(Boolean).join("\n");

  const res = await hubspotFetch(integrationId, "/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot note create failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.id as string;
}

export async function syncHubSpot(integrationId: string) {
  const results = { pushed: 0, pulled: 0, updated: 0, errors: [] as string[] };

  // 1. Push GSH leads → HubSpot
  const gshLeads = await db.select().from(schema.leads).limit(500);

  for (const lead of gshLeads) {
    try {
      const existing = await searchHubSpotContact(integrationId, lead.email);
      if (existing) {
        await updateHubSpotContact(integrationId, existing.id, {
          gsh_status: lead.status,
          gsh_sequence_step: String(lead.sequenceStep),
          ...(lead.lastContactedAt
            ? { gsh_last_contacted: lead.lastContactedAt }
            : {}),
        });
        results.updated++;
      } else {
        await createHubSpotContact(integrationId, lead);
        results.pushed++;
      }
    } catch (err) {
      results.errors.push(`Push ${lead.email}: ${(err as Error).message}`);
    }
  }

  // 2. Pull new HubSpot contacts → GSH
  try {
    const newContacts = await fetchNewHubSpotContacts(integrationId);
    for (const contact of newContacts) {
      const email = contact.properties.email;
      if (!email) continue;

      try {
        await db.insert(schema.leads).values({
          email: email.toLowerCase(),
          name:
            [contact.properties.firstname, contact.properties.lastname]
              .filter(Boolean)
              .join(" ") || null,
          title: contact.properties.jobtitle || null,
          companyName: contact.properties.company || null,
          companyWebsite: contact.properties.website || null,
          source: "hubspot",
        });
        results.pulled++;
      } catch (err: unknown) {
        // Skip duplicates silently
        if (!(err instanceof Error && err.message.includes("UNIQUE"))) {
          results.errors.push(`Pull ${email}: ${(err as Error).message}`);
        }
      }
    }
  } catch (err) {
    results.errors.push(`Pull contacts: ${(err as Error).message}`);
  }

  // Update last sync time
  await db
    .update(schema.integrations)
    .set({
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.integrations.id, integrationId));

  return results;
}
