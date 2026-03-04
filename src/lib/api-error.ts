import { NextResponse } from "next/server";

interface ApiErrorOptions {
  status?: number;
  code?: string;
  headers?: Record<string, string>;
}

export function apiError(
  message: string,
  { status = 500, code = "SERVER_ERROR", headers }: ApiErrorOptions = {},
): NextResponse {
  return NextResponse.json(
    { status: "error", code, message },
    { status, headers },
  );
}

export function badRequest(message: string, code = "BAD_REQUEST") {
  return apiError(message, { status: 400, code });
}

export function notFound(message = "Resource not found.") {
  return apiError(message, { status: 404, code: "NOT_FOUND" });
}

export function serverError(message = "An unexpected error occurred.") {
  return apiError(message, { status: 500, code: "SERVER_ERROR" });
}
