import { z } from "zod";
import { apiError, handler, json, parseBody, publicJson, requirePluginKey, verifyOwnerToken } from "@/lib/api";
import { parseOfferPrice } from "@/lib/money";
import { screenText } from "@/lib/policy";
import { addOffer, getBusinessBySlug, offersFor } from "@/lib/services/businesses";
import { offerBuyUrl, offerView } from "@/lib/services/views";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).default(""),
  priceUsd: z.number().positive().max(10000),
  kind: z.enum(["product", "service", "booking", "digital", "subscription"]),
});

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const b = await getBusinessBySlug(slug);
  if (!b) return apiError(404, "business_not_found", `No business ${slug}`);
  return publicJson({ offers: (await offersFor(b.id)).map(offerView) });
});

/** Owner adds an offer; it is live on the storefront and buyable over x402 immediately. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const denied = requirePluginKey(req);
  if (denied) return denied;
  const { slug } = await ctx.params;
  const b = await getBusinessBySlug(slug);
  const token = req.headers.get("x-awning-owner-token");
  if (!b || !verifyOwnerToken(token, b)) {
    return apiError(token ? 403 : 401, token ? "forbidden" : "unauthorized", "Missing or invalid x-awning-owner-token for this business");
  }
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;
  if (b.status === "suspended") return apiError(403, "business_suspended", `${b.name} is under review; offers can't be changed.`);
  const screened = screenText(`${body.data.title} ${body.data.description}`);
  if (!screened.ok) return apiError(422, "policy_blocked", screened.reason, { category: screened.category });
  let priceAtomic: bigint;
  try {
    priceAtomic = parseOfferPrice(body.data.priceUsd);
  } catch (err) {
    return apiError(400, "invalid_request", `priceUsd: ${err instanceof Error ? err.message : "invalid"}`);
  }
  const offer = await addOffer(b, { title: body.data.title, description: body.data.description || body.data.title, priceAtomic, kind: body.data.kind });
  const offers = await offersFor(b.id);
  return json({ offer: { ...offerView(offer), buyUrl: offerBuyUrl(b.slug, offer.sku) }, offers: offers.map(offerView) }, { status: 201 });
});
