import { handler, json, parseBody, requirePluginKey } from "@/lib/api";
import { createPlan, planInputSchema } from "@/lib/services/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Draft a business from one sentence. No money, no external side effects beyond the draft row. */
export const POST = handler(async (req: Request) => {
  const denied = requirePluginKey(req);
  if (denied) return denied;
  const body = await parseBody(req, planInputSchema);
  if (!body.ok) return body.response;
  const plan = await createPlan(body.data);
  return json(plan, { status: 201 });
});
