import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { not, eq } from "drizzle-orm";
import {
  provisionInstance,
  stopInstance,
  startInstance,
  removeInstance,
} from "@/lib/n8n/manager";

/** GET /api/n8n-instances — list all instances */
export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  const instances = await db
    .select({
      id: schema.n8nInstances.id,
      name: schema.n8nInstances.name,
      port: schema.n8nInstances.port,
      status: schema.n8nInstances.status,
      webhookUrl: schema.n8nInstances.webhookUrl,
      templates: schema.n8nInstances.templates,
      errorMessage: schema.n8nInstances.errorMessage,
      createdAt: schema.n8nInstances.createdAt,
    })
    .from(schema.n8nInstances)
    .where(not(eq(schema.n8nInstances.status, "removed")));

  return NextResponse.json({ instances });
}

/** POST /api/n8n-instances — provision a new instance */
export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "name is required." },
        { status: 400 },
      );
    }

    const templateIds = body.templates ?? ["followup-core"];
    const result = await provisionInstance(name, templateIds);

    return NextResponse.json(
      {
        status: "ok",
        instance: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error provisioning n8n instance:", error);
    return NextResponse.json(
      { status: "error", code: "PROVISION_FAILED", message: (error as Error).message },
      { status: 500 },
    );
  }
}

/** PATCH /api/n8n-instances?id=<id>&action=<start|stop|remove> */
export async function PATCH(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const action = url.searchParams.get("action");

  if (!id || !action) {
    return NextResponse.json(
      {
        status: "error",
        code: "INVALID_PARAMS",
        message: "id and action query params required. action: start|stop|remove",
      },
      { status: 400 },
    );
  }

  try {
    switch (action) {
      case "start":
        await startInstance(id);
        break;
      case "stop":
        await stopInstance(id);
        break;
      case "remove":
        await removeInstance(id);
        break;
      default:
        return NextResponse.json(
          {
            status: "error",
            code: "INVALID_ACTION",
            message: `Unknown action '${action}'. Use: start, stop, remove`,
          },
          { status: 400 },
        );
    }

    return NextResponse.json({ status: "ok", action, instance_id: id });
  } catch (error) {
    console.error(`Error ${action} n8n instance:`, error);
    return NextResponse.json(
      { status: "error", code: "ACTION_FAILED", message: (error as Error).message },
      { status: 500 },
    );
  }
}
