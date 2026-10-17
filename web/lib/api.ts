import { createHmac, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { env, isProduction } from "./env";
import { log } from "./log";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function replacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? v.toString() : v;
}

export function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body, replacer), { status: init.status ?? 200, headers: { ...JSON_HEADERS, ...(init.headers ?? {}) } });
}

/** Public GET responses: CORS-open, short shared cache. */
export function publicJson(body: unknown, maxAge = 0): Response {
  return json(body, {
    headers: { "access-control-allow-origin": "*", "cache-control": maxAge > 0 ? `public, max-age=${maxAge}` : "no-store" },
  });
}

export function apiError(status: number, error: string, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ error, message, ...extra }, { status });
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Parse a JSON body against a schema. An empty body parses as `{}`. */
export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<Parsed<z.infer<S>>> {
  let raw: unknown = {};
  const text = await req.text().catch(() => "");
  if (text.trim()) {
    if (text.length > 64 * 1024) return { ok: false, response: apiError(413, "body_too_large", "JSON body must be at most 64 KiB") };
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, response: apiError(400, "invalid_json", "Request body is not valid JSON") };
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    return { ok: false, response: apiError(400, "invalid_request", `${where}${issue?.message ?? "invalid body"}`) };
  }
  return { ok: true, data: parsed.data };
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

let warnedNoPluginKey = false;
/** `x-awning-plugin-key` check (PayBox injects it as a brokered header). Returns a 401 response or null. */
export function requirePluginKey(req: Request): Response | null {
  const expected = env.pluginKey();
  if (!expected) {
    if (isProduction()) return apiError(503, "misconfigured", "AWNING_PLUGIN_KEY is not configured");
    if (!warnedNoPluginKey) {
      warnedNoPluginKey = true;
      log.warn("AWNING_PLUGIN_KEY not set: plugin-key auth disabled (development only)");
    }
    return null;
  }
  const got = req.headers.get("x-awning-plugin-key") ?? "";
  if (!got || !safeEqual(got, expected)) return apiError(401, "unauthorized", "Missing or invalid x-awning-plugin-key header");
  return null;
}

function ownerSecret(): string {
  const s = env.ownerTokenSecret();
  if (s) return s;
  if (isProduction()) throw new Error("AWNING_OWNER_TOKEN_SECRET is not configured");
  return "awning-dev-owner-secret-not-for-production";
}

/**
 * Owner tokens are derived, not stored: HMAC(secret, businessId:version).
 * The same open (or an idempotent retry of it) always yields the same token;
 * bumping owner_token_version revokes every earlier token.
 */
export function ownerTokenFor(businessId: string, version: number): string {
  const mac = createHmac("sha256", ownerSecret()).update(`owner:${businessId}:${version}`).digest("base64url");
  return `awn_ot_${mac}`;
}

export function verifyOwnerToken(token: string | null | undefined, business: { id: string; ownerTokenVersion: number }): boolean {
  if (!token) return false;
  return safeEqual(token, ownerTokenFor(business.id, business.ownerTokenVersion));
}

/** Absolute URL for an API path; prefers the configured public API origin. */
export function apiUrl(path: string): string {
  return `${env.apiUrl()}${path}`;
}

/** Wraps a route handler: unexpected errors become a JSON 500 (no stack, no secrets). */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      const id = `err_${Date.now().toString(36)}`;
      log.error("unhandled route error", { id, error: err instanceof Error ? err.message : String(err) });
      return apiError(500, "internal_error", `Something went wrong (${id}).`);
    }
  };
}
