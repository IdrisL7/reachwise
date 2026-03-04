import Docker from "dockerode";
import { db, schema } from "@/lib/db";
import { eq, not, inArray } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";
import { registerN8nRoute, removeN8nRoute, getN8nPublicUrl } from "./caddy";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const N8N_IMAGE = process.env.N8N_DOCKER_IMAGE || "n8nio/n8n:latest";
const N8N_PORT_RANGE_START = parseInt(process.env.N8N_PORT_START || "5680", 10);
const N8N_PORT_RANGE_END = parseInt(process.env.N8N_PORT_END || "5780", 10);
const N8N_NETWORK = process.env.N8N_DOCKER_NETWORK || "gsh-n8n";

/** Sanitize name for use as container/subdomain identifier */
function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Find the next available port in the configured range */
export async function allocatePort(): Promise<number> {
  const usedPorts = await db
    .select({ port: schema.n8nInstances.port })
    .from(schema.n8nInstances)
    .where(not(inArray(schema.n8nInstances.status, ["removed"])));

  const usedSet = new Set(usedPorts.map((r) => r.port));

  for (let port = N8N_PORT_RANGE_START; port <= N8N_PORT_RANGE_END; port++) {
    if (!usedSet.has(port)) return port;
  }

  throw new Error(
    `No available ports in range ${N8N_PORT_RANGE_START}-${N8N_PORT_RANGE_END}`,
  );
}

/** Ensure the Docker network exists */
async function ensureNetwork(): Promise<void> {
  const networks = await docker.listNetworks({
    filters: { name: [N8N_NETWORK] },
  });
  if (networks.length === 0) {
    await docker.createNetwork({ Name: N8N_NETWORK, Driver: "bridge" });
  }
}

/** Ensure the n8n image is pulled */
async function ensureImage(): Promise<void> {
  try {
    await docker.getImage(N8N_IMAGE).inspect();
  } catch {
    // Pull the image
    const stream = await docker.pull(N8N_IMAGE);
    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

/** Provision a new n8n Docker container with Caddy subdomain */
export async function provisionInstance(
  name: string,
  templateIds: string[] = ["followup-core"],
): Promise<{ id: string; port: number; webhookUrl: string; publicUrl: string }> {
  const port = await allocatePort();
  const safeName = sanitizeName(name);
  const containerName = `gsh-n8n-${safeName}`;
  const publicUrl = getN8nPublicUrl(safeName);
  const adminPassword = crypto.randomUUID().slice(0, 16);

  // Create DB record first
  const [instance] = await db
    .insert(schema.n8nInstances)
    .values({
      name: safeName,
      port,
      status: "provisioning",
      webhookUrl: publicUrl,
      templates: templateIds,
    })
    .returning();

  try {
    await ensureNetwork();
    await ensureImage();

    // Create the container
    const container = await docker.createContainer({
      name: containerName,
      Image: N8N_IMAGE,
      Env: [
        "N8N_HOST=0.0.0.0",
        "N8N_PORT=5678",
        "N8N_PROTOCOL=https",
        `WEBHOOK_URL=${publicUrl}/`,
        "N8N_BASIC_AUTH_ACTIVE=true",
        "N8N_BASIC_AUTH_USER=admin",
        `N8N_BASIC_AUTH_PASSWORD=${adminPassword}`,
        "GENERIC_TIMEZONE=UTC",
      ],
      ExposedPorts: { "5678/tcp": {} },
      HostConfig: {
        PortBindings: {
          "5678/tcp": [{ HostPort: String(port) }],
        },
        NetworkMode: N8N_NETWORK,
        RestartPolicy: { Name: "unless-stopped" },
      },
    });

    await container.start();

    const containerId = container.id;

    // Update DB with container ID
    await db
      .update(schema.n8nInstances)
      .set({
        containerId,
        status: "running",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.n8nInstances.id, instance.id));

    // Register subdomain in Caddy
    try {
      await registerN8nRoute(safeName, containerName);
    } catch (err) {
      console.error(`Caddy route registration failed (non-fatal):`, err);
      // Non-fatal — instance still accessible via direct port
    }

    // Inject templates after n8n starts up
    setTimeout(() => {
      injectTemplates(instance.id, port, templateIds).catch((err) =>
        console.error(`Template injection failed for ${instance.id}:`, err),
      );
    }, 15000);

    return {
      id: instance.id,
      port,
      webhookUrl: `http://localhost:${port}`,
      publicUrl,
    };
  } catch (err) {
    await db
      .update(schema.n8nInstances)
      .set({
        status: "error",
        errorMessage: (err as Error).message,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.n8nInstances.id, instance.id));

    throw err;
  }
}

/** Inject workflow templates into a running n8n instance via its REST API */
async function injectTemplates(
  instanceId: string,
  port: number,
  templateIds: string[],
): Promise<void> {
  const templateDir = join(process.cwd(), "src/lib/n8n-templates");

  for (const templateId of templateIds) {
    try {
      const templatePath = join(templateDir, `${templateId}.json`);
      const workflow = JSON.parse(readFileSync(templatePath, "utf-8"));

      const res = await fetch(`http://localhost:${port}/api/v1/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflow.name,
          nodes: workflow.nodes,
          connections: workflow.connections,
          settings: workflow.settings,
          active: false,
        }),
      });

      if (!res.ok) {
        console.error(
          `Failed to inject template ${templateId} into instance ${instanceId}: ${res.status}`,
        );
      }
    } catch (err) {
      console.error(
        `Error injecting template ${templateId}:`,
        (err as Error).message,
      );
    }
  }
}

/** Stop an n8n instance */
export async function stopInstance(instanceId: string): Promise<void> {
  const [instance] = await db
    .select()
    .from(schema.n8nInstances)
    .where(eq(schema.n8nInstances.id, instanceId))
    .limit(1);

  if (!instance?.containerId) throw new Error("Instance not found or has no container");

  const container = docker.getContainer(instance.containerId);
  await container.stop();

  await db
    .update(schema.n8nInstances)
    .set({ status: "stopped", updatedAt: new Date().toISOString() })
    .where(eq(schema.n8nInstances.id, instanceId));
}

/** Start a stopped n8n instance */
export async function startInstance(instanceId: string): Promise<void> {
  const [instance] = await db
    .select()
    .from(schema.n8nInstances)
    .where(eq(schema.n8nInstances.id, instanceId))
    .limit(1);

  if (!instance?.containerId) throw new Error("Instance not found or has no container");

  const container = docker.getContainer(instance.containerId);
  await container.start();

  await db
    .update(schema.n8nInstances)
    .set({ status: "running", updatedAt: new Date().toISOString() })
    .where(eq(schema.n8nInstances.id, instanceId));
}

/** Remove an n8n instance, its container, and its Caddy route */
export async function removeInstance(instanceId: string): Promise<void> {
  const [instance] = await db
    .select()
    .from(schema.n8nInstances)
    .where(eq(schema.n8nInstances.id, instanceId))
    .limit(1);

  if (!instance) throw new Error("Instance not found");

  // Remove Docker container
  if (instance.containerId) {
    try {
      const container = docker.getContainer(instance.containerId);
      try { await container.stop(); } catch { /* may already be stopped */ }
      await container.remove({ force: true });
    } catch {
      // Container may already be gone
    }
  }

  // Remove Caddy route
  try {
    await removeN8nRoute(instance.name);
  } catch {
    // Non-fatal
  }

  await db
    .update(schema.n8nInstances)
    .set({ status: "removed", updatedAt: new Date().toISOString() })
    .where(eq(schema.n8nInstances.id, instanceId));
}

/** Refresh instance status from Docker */
export async function refreshInstanceStatus(instanceId: string): Promise<string> {
  const [instance] = await db
    .select()
    .from(schema.n8nInstances)
    .where(eq(schema.n8nInstances.id, instanceId))
    .limit(1);

  if (!instance?.containerId) return instance?.status ?? "removed";

  try {
    const container = docker.getContainer(instance.containerId);
    const info = await container.inspect();
    const status = info.State.Status;

    const mappedStatus =
      status === "running" ? "running" : status === "exited" ? "stopped" : "error";

    if (mappedStatus !== instance.status) {
      await db
        .update(schema.n8nInstances)
        .set({ status: mappedStatus, updatedAt: new Date().toISOString() })
        .where(eq(schema.n8nInstances.id, instanceId));
    }

    return mappedStatus;
  } catch {
    return instance.status;
  }
}
