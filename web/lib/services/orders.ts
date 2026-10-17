import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { adapters } from "../adapters";
import { apiError, apiUrl } from "../api";
import { db, schema } from "../db/client";
import type { BusinessRow, Fulfillment, OfferRow } from "../db/schema";
import { businessUrl } from "../env";
import { newId, shortCode } from "../ids";
import { errorMessage, log } from "../log";
import { atomicToUsd, atomicToUsdString, MAX_QTY, orderTotalAtomic } from "../money";
import { BASE_NETWORK } from "../x402/constants";
import { handlePaidRequest, type WorkResult } from "../x402/flow";
import type { Charge } from "../x402/seller";
import { getBusinessBySlug, getOffer } from "./businesses";
import { emitEvent } from "./events";
import { orderView } from "./views";

export const buyBodySchema = z.object({
  qty: z.number().int().min(1).max(MAX_QTY).optional(),
  buyerNote: z.string().trim().max(500).optional(),
  buyerContact: z.string().trim().max(200).optional(),
});

export function fulfillmentFor(b: BusinessRow, offer: OfferRow, orderId: string, qty: number, buyerContact: string | null): Fulfillment {
  const code = `${b.slug.slice(0, 3).toUpperCase()}-${shortCode(orderId, 6)}`;
  const url = businessUrl(b);
  const contact = buyerContact ? ` at ${buyerContact}` : "";
  const reach = b.phone ? ` You can also call ${b.phone}.` : "";
  const what = qty > 1 ? `${qty} × ${offer.title}` : offer.title;
  switch (offer.kind) {
    case "product":
      return { kind: "product", code, url, message: `Order ${code} confirmed: ${what}. ${b.name} has been notified and will arrange delivery${contact}. Include a shipping address in buyerNote if you have not.${reach}` };
    case "service":
      return { kind: "service", code, url, message: `Order ${code} confirmed: ${what}. ${b.name} will contact you${contact} to get started.${reach}` };
    case "booking":
      return { kind: "booking", code, url, message: `Booking ${code} confirmed: ${what}. ${b.name} will confirm the time with you${contact}. Quote ${code} when you arrive.${reach}` };
    case "digital":
      return { kind: "digital", code, url, message: `Purchase ${code} confirmed: ${what}. Your access code is ${code}; ${b.name} will send the files or redeem the code${contact}.` };
    case "subscription":
      return { kind: "subscription", code, url, message: `Subscription ${code} started: ${what}, first period paid. ${b.name} will be in touch${contact}. Renewals are separate payments; nothing is charged automatically.` };
  }
}

type BuyQuote = { business: BusinessRow; offer: OfferRow; qty: number; charge: Charge; quote: Record<string, unknown> };

export async function quoteBuy(slug: string, sku: string, body: z.infer<typeof buyBodySchema>, url: URL): Promise<BuyQuote | Response> {
  const business = await getBusinessBySlug(slug);
  if (!business) return apiError(404, "business_not_found", `No business ${slug}`);
  if (business.status !== "live") return apiError(409, "business_not_open", `${business.name} is not open yet`);
  const offer = await getOffer(business.id, sku);
  if (!offer || !offer.active) return apiError(404, "offer_not_found", `${business.name} has no offer ${sku}`);
  const qRaw = url.searchParams.get("qty");
  const qFromQuery = qRaw != null && /^\d+$/.test(qRaw) ? Number(qRaw) : undefined;
  if (body.qty != null && qFromQuery != null && body.qty !== qFromQuery) return apiError(400, "invalid_request", "qty in body and query differ");
  const qty = body.qty ?? qFromQuery ?? 1;
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return apiError(400, "invalid_request", `qty must be 1–${MAX_QTY}`);
  const amountAtomic = orderTotalAtomic(offer.priceAtomic, qty);
  const charge: Charge = {
    amountAtomic,
    payTo: business.ownerWallet,
    resourceUrl: apiUrl(`/x402/b/${business.slug}/${offer.sku}`),
    description: `${qty} × ${offer.title} from ${business.name}`,
  };
  const quote = {
    slug: business.slug,
    business: business.name,
    sku: offer.sku,
    title: offer.title,
    qty,
    unitUsd: atomicToUsd(offer.priceAtomic),
    totalUsd: atomicToUsd(amountAtomic),
    payTo: business.ownerWallet,
    note: "Paid directly to the business owner's wallet. Charged only once the order is recorded.",
  };
  return { business, offer, qty, charge, quote };
}

/** POST /x402/b/:slug/:sku — buy from a business; payTo is the owner's own wallet. */
export async function buy(req: Request, slug: string, sku: string, body: z.infer<typeof buyBodySchema>): Promise<Response> {
  const q = await quoteBuy(slug, sku, body, new URL(req.url));
  if (q instanceof Response) return q;
  const { business, offer, qty, charge, quote } = q;

  return handlePaidRequest({
    req,
    charge,
    purpose: "order",
    refId: `${business.id}:${offer.sku}`,
    quote,
    // payTo is the owner's wallet: Awning never holds these funds, so it cannot refund them.
    refundable: false,
    work: async (ctx): Promise<WorkResult> => {
      const d = await db();
      const orderId = newId("ord");
      const fulfillment = fulfillmentFor(business, offer, orderId, qty, body.buyerContact ?? null);
      await d.insert(schema.orders).values({
        id: orderId,
        businessId: business.id,
        offerId: offer.id,
        slug: business.slug,
        sku: offer.sku,
        qty,
        unitAtomic: offer.priceAtomic,
        totalAtomic: charge.amountAtomic,
        payer: ctx.payer,
        payTo: business.ownerWallet.toLowerCase(),
        network: BASE_NETWORK,
        paymentKey: ctx.key,
        status: "pending",
        buyerNote: body.buyerNote ?? null,
        buyerContact: body.buyerContact ?? null,
        fulfillment,
      });
      return {
        ok: true,
        compensate: async (reason) => {
          await d.update(schema.orders).set({ status: "failed", error: reason.slice(0, 500) }).where(eq(schema.orders.id, orderId));
        },
        commit: async (s) => {
          const now = new Date();
          const [order] = await d.update(schema.orders).set({ status: "paid", tx: s.tx, paidAt: now }).where(eq(schema.orders.id, orderId)).returning();
          if (!order) throw new Error("order row vanished");
          await d.update(schema.businesses).set({ salesCount: sql`${schema.businesses.salesCount} + 1`, updatedAt: now }).where(eq(schema.businesses.id, business.id));
          await emitEvent({ type: "order", slug: business.slug, name: business.name, amountAtomic: charge.amountAtomic, tx: s.tx, data: { sku: offer.sku, qty } }).catch((err) =>
            log.warn("event emit failed", { error: errorMessage(err) }),
          );
          // Best effort, bounded: a slow SMS must not hold the buyer's receipt.
          await Promise.race([
            adapters()
              .notifier.orderPaid({
                businessName: business.name,
                ownerPhone: business.ownerPhone,
                fromNumber: business.phone && !business.provisioning.phoneMock ? business.phone : null,
                title: offer.title,
                qty,
                totalUsd: atomicToUsdString(charge.amountAtomic),
                buyerContact: body.buyerContact ?? null,
                buyerNote: body.buyerNote ?? null,
                tx: s.tx,
              })
              .catch((err) => log.warn("owner notification failed", { error: errorMessage(err) })),
            new Promise((r) => setTimeout(r, 3000)),
          ]);
          return {
            status: 200,
            body: {
              order: { id: order.id, slug: order.slug, sku: order.sku, qty: order.qty, totalUsd: atomicToUsd(order.totalAtomic), status: "paid" as const },
              receipt: { tx: s.tx, payer: s.payer, payTo: business.ownerWallet, network: s.network, settlement: s.confirmed ? "confirmed" : "unconfirmed" },
              fulfillment,
            },
          };
        },
      };
    },
  });
}

export async function ordersForBusiness(businessId: string, limit = 100) {
  const d = await db();
  const rows = await d.select().from(schema.orders).where(eq(schema.orders.businessId, businessId)).orderBy(desc(schema.orders.createdAt)).limit(limit);
  return rows.map(orderView);
}
