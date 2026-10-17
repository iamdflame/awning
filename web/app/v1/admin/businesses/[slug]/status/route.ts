import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { apiError, handler, json, parseBody } from "@/lib/api";
import { env } from "@/lib/env";
import { setBusinessStatus } from "@/lib/policy";
import { getBusinessBySlug } from "@/lib/services/businesses";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["suspend", "restore"]), reason: z.string().trim().min(3).max(500) });

function isOperator(req: Request): boolean {
  const expected = env.adminKey();
  const got = req.headers.get("x-awning-admin-key") ?? "";
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Operator takedown / restore. Disabled unless AWNING_ADMIN_KEY is configured. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  if (!env.adminKey()) return apiError(503, "misconfigured", "Operator actions are not configured on this server");
  if (!isOperator(req)) return apiError(401, "unauthorized", "Missing or invalid x-awning-admin-key header");
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;
  const { slug } = await ctx.params;
  const b = await getBusinessBySlug(slug);
  if (!b) return apiError(404, "business_not_found", `No business ${slug}`);
  const row = await setBusinessStatus(b, body.data.action === "suspend" ? "suspended" : "restored", body.data.reason, "admin");
  return json({ slug: row.slug, status: row.status });
});
