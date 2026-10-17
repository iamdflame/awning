import { handler, parseBody } from "@/lib/api";
import { openBodySchema, openPro } from "@/lib/services/open";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ planId: string }> };

/**
 * x402: open a planned business on the Pro package (custom domain + phone +
 * AI receptionist). Unpaid → 402 quote (no side effects). Paid retry →
 * provision, then settle; failures before settlement are never charged.
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { planId } = await ctx.params;
  const body = await parseBody(req.clone(), openBodySchema);
  if (!body.ok) return body.response;
  return openPro(req, planId, body.data);
});

/** Same quote for clients that probe with GET (`?domain=` selects the domain). */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { planId } = await ctx.params;
  return openPro(req, planId, {});
});
