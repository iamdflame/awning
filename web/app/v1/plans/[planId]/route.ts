import { apiError, handler, json, requirePluginKey } from "@/lib/api";
import { getPlanView } from "@/lib/services/plans";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request, ctx: { params: Promise<{ planId: string }> }) => {
  const denied = requirePluginKey(req);
  if (denied) return denied;
  const { planId } = await ctx.params;
  const plan = await getPlanView(planId);
  if (!plan) return apiError(404, "plan_not_found", `No plan ${planId}`);
  return json(plan);
});
