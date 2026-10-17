import { handler, parseBody } from "@/lib/api";
import { openBodySchema, openPro } from "@/lib/services/open";

export const dynamic = "force-dynamic";
// verify + provisioning + settlement with an on-chain check; the reconciler covers a killed function.
export const maxDuration = 90;

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


/** CORS preflight: browsers send PAYMENT-SIGNATURE / X-PAYMENT on the paid retry. */
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, payment-signature, x-payment",
      "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
      "access-control-max-age": "86400",
    },
  });
}
