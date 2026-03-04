/**
 * Manages Caddy reverse proxy routes for n8n instances.
 * Uses Caddy's admin API to dynamically add/remove routes
 * so each customer gets a subdomain with auto-HTTPS.
 */

const CADDY_ADMIN_URL = process.env.CADDY_ADMIN_URL || "http://caddy:2019";
const N8N_DOMAIN = process.env.N8N_DOMAIN || "n8n.getsignalhooks.com";

/**
 * Register a new n8n subdomain route in Caddy.
 * Maps {name}.{N8N_DOMAIN} → gsh-n8n-{name}:5678
 */
export async function registerN8nRoute(
  name: string,
  containerName: string,
): Promise<void> {
  const hostname = `${name}.${N8N_DOMAIN}`;

  // First, ensure the n8n server exists in Caddy config
  await ensureN8nServer();

  // Add the route
  const route = {
    match: [{ host: [hostname] }],
    handle: [
      {
        handler: "reverse_proxy",
        upstreams: [{ dial: `${containerName}:5678` }],
      },
    ],
  };

  const res = await fetch(
    `${CADDY_ADMIN_URL}/config/apps/http/servers/n8n/routes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(route),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to register Caddy route for ${hostname}: ${res.status} ${text}`);
  }
}

/**
 * Remove an n8n subdomain route from Caddy.
 */
export async function removeN8nRoute(name: string): Promise<void> {
  const hostname = `${name}.${N8N_DOMAIN}`;

  // Get current routes
  const res = await fetch(
    `${CADDY_ADMIN_URL}/config/apps/http/servers/n8n/routes`,
  );

  if (!res.ok) return; // Server might not exist yet

  const routes: Array<{ match?: Array<{ host?: string[] }> }> = await res.json();
  const routeIndex = routes.findIndex(
    (r) => r.match?.[0]?.host?.[0] === hostname,
  );

  if (routeIndex === -1) return;

  // Delete by index
  const delRes = await fetch(
    `${CADDY_ADMIN_URL}/config/apps/http/servers/n8n/routes/${routeIndex}`,
    { method: "DELETE" },
  );

  if (!delRes.ok) {
    console.error(`Failed to remove Caddy route for ${hostname}: ${delRes.status}`);
  }
}

/**
 * Get the public URL for an n8n instance.
 */
export function getN8nPublicUrl(name: string): string {
  return `https://${name}.${N8N_DOMAIN}`;
}

/**
 * Ensure the n8n server block exists in Caddy config.
 * Creates it if missing.
 */
async function ensureN8nServer(): Promise<void> {
  const res = await fetch(
    `${CADDY_ADMIN_URL}/config/apps/http/servers/n8n`,
  );

  if (res.ok) return; // Already exists

  // Create the server with wildcard listener and TLS
  const server = {
    listen: [":443"],
    routes: [],
    tls_connection_policies: [{}], // Use default/auto TLS
  };

  const createRes = await fetch(
    `${CADDY_ADMIN_URL}/config/apps/http/servers/n8n`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(server),
    },
  );

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create Caddy n8n server: ${createRes.status} ${text}`);
  }
}
