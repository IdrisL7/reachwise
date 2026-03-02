import { NextResponse } from "next/server";

export function unauthorized(message = "Missing or invalid authorization token.") {
  return NextResponse.json(
    { status: "error", code: "UNAUTHORIZED", message },
    { status: 401 },
  );
}

export function validateBearerToken(request: Request): boolean {
  const token = process.env.FOLLOWUP_ENGINE_API_TOKEN;
  if (!token) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return false;

  return parts[1] === token;
}
