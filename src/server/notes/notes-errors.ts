/**
 * Origin Notes — typed errors and their HTTP mapping for both catch-all routes.
 */

import { ZodError } from "zod";

import { AuthzError } from "@/server/authz";
import { FeatureDisabledError } from "@/lib/feature-flags";

/** A failure the user can act on: `status` + a stable `code` + plain-English `message`. */
export class NotesError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;

  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const notFoundError = (what = "That note or folder") =>
  new NotesError(404, "not_found", `${what} was not found.`);

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function notesErrorResponse(error: unknown): Response {
  if (error instanceof NotesError) {
    return json(error.status, { detail: error.message, code: error.code, ...error.extra });
  }
  if (error instanceof AuthzError) {
    return json(error.status, { detail: error.message, code: error.status === 401 ? "unauthenticated" : "forbidden" });
  }
  if (error instanceof FeatureDisabledError) {
    return json(404, { detail: "Not found.", code: "feature_off" });
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const where = first?.path?.length ? `${first.path.join(".")}: ` : "";
    return json(400, { detail: `${where}${first?.message ?? "Invalid request."}`, code: "invalid_request" });
  }
  if (error instanceof SyntaxError) {
    return json(400, { detail: "The request body is not valid JSON.", code: "invalid_json" });
  }
  // pg unique violation on sibling names / external keys.
  if (typeof error === "object" && error && (error as { code?: string }).code === "23505") {
    return json(409, { detail: "Something with that name already exists here.", code: "duplicate" });
  }
  console.error("[notes] unexpected error", error instanceof Error ? error.message : error);
  return json(500, { detail: "Something went wrong. Please try again.", code: "server_error" });
}
