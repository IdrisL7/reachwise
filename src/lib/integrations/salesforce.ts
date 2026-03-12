import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

const SF_AUTH_URL = "https://login.salesforce.com/services/oauth2/authorize";
const SF_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const SF_API_VERSION = "v59.0";

interface SalesforceTokenResponse {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
}

interface SalesforceRecord {
  Id: string;
  Email?: string;
  FirstName?: string;
  LastName?: string;
  Title?: string;
  Company?: string;
  Website?: string;
  [key: string]: unknown;
}

interface SalesforceQueryResult {
  totalSize: number;
  done: boolean;
  records: SalesforceRecord[];
}

function getClientId(): string {
  const id = process.env.SALESFORCE_CLIENT_ID;
  if (!id) throw new Error("SALESFORCE_CLIENT_ID not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.SALESFORCE_CLIENT_SECRET;
  if (!secret) throw new Error("SALESFORCE_CLIENT_SECRET not set");
  return secret;
}

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/api/integrations/salesforce/callback`;
}

/** Build the Salesforce OAuth authorization URL */
export function getSalesforceAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: "api refresh_token",
    ...(state ? { state } : {}),
  });
  return `${SF_AUTH_URL}?${params}`;
}

/** Exchange authorization code for tokens */
export async function exchangeSalesforceCode(
  code: string,
): Promise<SalesforceTokenResponse> {
  const res = await fetch(SF_TOKEN_URL, {
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
    throw new Error(`Salesforce token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Refresh an expired access token */
export async function refreshSalesforceToken(
  refreshToken: string,
): Promise<{ access_token: string; instance_url: string }> {
  const res = await fetch(SF_TOKEN_URL, {
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
    throw new Error(`Salesforce token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Get a valid access token + instance URL, refreshing if needed */
async function getValidToken(
  integrationId: string,
): Promise<{ accessToken: string; instanceUrl: string }> {
  const [integration] = await db
    .select()
    .from(schema.integrations)
    .where(
      and(
        eq(schema.integrations.id, integrationId),
        eq(schema.integrations.provider, "salesforce"),
      ),
    )
    .limit(1);

  if (!integration) throw new Error("Salesforce integration not found");
  if (!integration.instanceUrl)
    throw new Error("Salesforce instance URL missing");

  // Salesforce tokens don't have explicit expiry — refresh on 401 instead
  // But we'll proactively refresh if tokenExpiresAt is set and passed
  if (
    integration.tokenExpiresAt &&
    new Date(integration.tokenExpiresAt).getTime() < Date.now()
  ) {
    const tokens = await refreshSalesforceToken(integration.refreshToken);
    await db
      .update(schema.integrations)
      .set({
        accessToken: tokens.access_token,
        instanceUrl: tokens.instance_url,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.integrations.id, integrationId));

    return {
      accessToken: tokens.access_token,
      instanceUrl: tokens.instance_url,
    };
  }

  return {
    accessToken: integration.accessToken,
    instanceUrl: integration.instanceUrl,
  };
}

/** Make an authenticated Salesforce API request with automatic token refresh on 401 */
async function sfFetch(
  integrationId: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  let { accessToken, instanceUrl } = await getValidToken(integrationId);
  let res = await fetch(`${instanceUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Retry once on 401
  if (res.status === 401) {
    const [integration] = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.id, integrationId))
      .limit(1);

    if (integration) {
      const tokens = await refreshSalesforceToken(integration.refreshToken);
      await db
        .update(schema.integrations)
        .set({
          accessToken: tokens.access_token,
          instanceUrl: tokens.instance_url,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.integrations.id, integrationId));

      res = await fetch(`${tokens.instance_url}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    }
  }

  return res;
}

/** Run a SOQL query */
async function sfQuery(
  integrationId: string,
  soql: string,
): Promise<SalesforceQueryResult> {
  const res = await sfFetch(
    integrationId,
    `/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce query failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Search for a Lead by email in Salesforce */
export async function searchSalesforceLead(
  integrationId: string,
  email: string,
): Promise<SalesforceRecord | null> {
  const result = await sfQuery(
    integrationId,
    `SELECT Id, Email, FirstName, LastName, Title, Company, Website FROM Lead WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`,
  );
  return result.records[0] ?? null;
}

/** Create a Lead in Salesforce */
export async function createSalesforceLead(
  integrationId: string,
  lead: {
    email: string;
    name?: string | null;
    title?: string | null;
    companyName?: string | null;
    companyWebsite?: string | null;
    status?: string;
  },
): Promise<{ id: string }> {
  const nameParts = (lead.name ?? "").split(" ");
  const res = await sfFetch(
    integrationId,
    `/services/data/${SF_API_VERSION}/sobjects/Lead`,
    {
      method: "POST",
      body: JSON.stringify({
        Email: lead.email,
        FirstName: nameParts[0] || "",
        LastName: nameParts.slice(1).join(" ") || "Unknown",
        Title: lead.title || "",
        Company: lead.companyName || "Unknown",
        Website: lead.companyWebsite || "",
        LeadSource: "GetSignalHooks",
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce create lead failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Update a Lead in Salesforce */
export async function updateSalesforceLead(
  integrationId: string,
  salesforceLeadId: string,
  fields: Record<string, string | number>,
): Promise<void> {
  const res = await sfFetch(
    integrationId,
    `/services/data/${SF_API_VERSION}/sobjects/Lead/${salesforceLeadId}`,
    {
      method: "PATCH",
      body: JSON.stringify(fields),
    },
  );

  // Salesforce PATCH returns 204 on success
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Salesforce update lead failed: ${res.status} ${text}`);
  }
}

/** Fetch recent leads from Salesforce that aren't from GSH */
export async function fetchNewSalesforceLeads(
  integrationId: string,
  limit = 100,
): Promise<SalesforceRecord[]> {
  const result = await sfQuery(
    integrationId,
    `SELECT Id, Email, FirstName, LastName, Title, Company, Website FROM Lead WHERE LeadSource != 'GetSignalHooks' AND CreatedDate = LAST_N_DAYS:1 LIMIT ${limit}`,
  );
  return result.records;
}

/** Push a generated hook as a Salesforce task */
export async function pushHookToSalesforce(
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
  const res = await sfFetch(integrationId, `/services/data/${SF_API_VERSION}/sobjects/Task`, {
    method: "POST",
    body: JSON.stringify({
      Subject: `GetSignalHooks insight${hook.companyName ? ` • ${hook.companyName}` : ""}`,
      Status: "Not Started",
      Priority: "Normal",
      Description: [
        `Hook: ${hook.hookText}`,
        hook.qualityScore ? `Quality score: ${hook.qualityScore}/100` : null,
        hook.sourceSnippet ? `Evidence: ${hook.sourceSnippet}` : null,
        hook.sourceTitle || hook.sourceUrl ? `Source: ${hook.sourceTitle || hook.sourceUrl}` : null,
        hook.sourceDate ? `Date: ${hook.sourceDate}` : null,
        `Company URL: ${hook.companyUrl}`,
      ].filter(Boolean).join("\n"),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce task create failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.id as string;
}

/** Run a full bidirectional sync */
export async function syncSalesforce(integrationId: string) {
  const results = { pushed: 0, pulled: 0, updated: 0, errors: [] as string[] };

  // 1. Push GSH leads → Salesforce
  const gshLeads = await db.select().from(schema.leads).limit(500);

  for (const lead of gshLeads) {
    try {
      const existing = await searchSalesforceLead(integrationId, lead.email);
      if (existing) {
        await updateSalesforceLead(integrationId, existing.Id, {
          Description: `GSH Status: ${lead.status}, Step: ${lead.sequenceStep}`,
        });
        results.updated++;
      } else {
        await createSalesforceLead(integrationId, lead);
        results.pushed++;
      }
    } catch (err) {
      results.errors.push(`Push ${lead.email}: ${(err as Error).message}`);
    }
  }

  // 2. Pull new Salesforce leads → GSH
  try {
    const newLeads = await fetchNewSalesforceLeads(integrationId);
    for (const record of newLeads) {
      const email = record.Email;
      if (!email) continue;

      try {
        await db.insert(schema.leads).values({
          email: email.toLowerCase(),
          name:
            [record.FirstName, record.LastName].filter(Boolean).join(" ") ||
            null,
          title: (record.Title as string) || null,
          companyName: (record.Company as string) || null,
          companyWebsite: (record.Website as string) || null,
          source: "salesforce",
        });
        results.pulled++;
      } catch (err: unknown) {
        if (!(err instanceof Error && err.message.includes("UNIQUE"))) {
          results.errors.push(`Pull ${email}: ${(err as Error).message}`);
        }
      }
    }
  } catch (err) {
    results.errors.push(`Pull leads: ${(err as Error).message}`);
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
