import { handler, parseBody } from "@/lib/api";
import { buy, buyBodySchema } from "@/lib/services/orders";

export const dynamic = "force-dynamic";
// verify + provisioning + settlement with an on-chain check; the reconciler covers a killed function.
export const maxDuration = 90;

type Ctx = { params: Promise<{ slug: string; sku: string }> };

/**
 * x402: buy an offer. payTo is the business owner's own wallet (non-custodial).
 * Unpaid → 402 quote (no side effects). Paid retry → order recorded, then
 * settled; the same payment always returns the same order.
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { slug, sku } = await ctx.params;
  const body = await parseBody(req.clone(), buyBodySchema);
  if (!body.ok) return body.response;
  return buy(req, slug, sku, body.data);
});

/** Same quote for clients that probe with GET (`?qty=` sets the quantity). */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { slug, sku } = await ctx.params;
  return buy(req, slug, sku, {});
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
