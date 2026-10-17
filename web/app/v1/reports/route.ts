import { apiError, handler, json, parseBody } from "@/lib/api";
import { AUTO_HOLD_REPORTERS, fileReport, reportSchema, reporterId } from "@/lib/policy";

export const dynamic = "force-dynamic";

/**
 * Anyone can report a business (no account). Reporters are identified by a
 * daily HMAC of their IP, never the IP itself. When AUTO_HOLD_REPORTERS
 * different people report the same business within 24 h, its checkout pauses
 * and it leaves the directory until an operator reviews it.
 */
export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, reportSchema);
  if (!body.ok) return body.response;
  const out = await fileReport(body.data, reporterId(req));
  if (out.status === "not_found") return apiError(404, "business_not_found", `No business ${body.data.slug}`);
  if (out.status === "rate_limited") return apiError(429, "rate_limited", "Too many reports from you today. Email abuse@awning.sh for anything urgent.");
  return json(
    {
      reportId: out.reportId,
      held: out.held,
      message: out.held
        ? "Thanks. This business's checkout is paused while a person reviews it."
        : `Thanks. A person reviews every report; checkout pauses automatically once ${AUTO_HOLD_REPORTERS} people report the same business.`,
    },
    { status: 201, headers: { "access-control-allow-origin": "*" } },
  );
});
