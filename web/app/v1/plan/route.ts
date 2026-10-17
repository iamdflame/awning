import { apiError, handler, json, parseBody, requirePluginKey } from "@/lib/api";
import { PolicyError, RateLimitError } from "@/lib/policy";
import { createPlan, planInputSchema } from "@/lib/services/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Draft a business from one sentence. No money, no external side effects beyond the draft row. */
export const POST = handler(async (req: Request) => {
  const denied = requirePluginKey(req);
  if (denied) return denied;
  const body = await parseBody(req, planInputSchema);
  if (!body.ok) return body.response;
  try {
    const plan = await createPlan(body.data);
    return json(plan, { status: 201 });
  } catch (err) {
    if (err instanceof PolicyError) return apiError(422, "policy_blocked", err.result.reason, { category: err.result.category });
    if (err instanceof RateLimitError) return json({ error: "rate_limited", message: err.message }, { status: 429, headers: { "retry-after": String(err.retryAfterSeconds) } });
    throw err;
  }
});
