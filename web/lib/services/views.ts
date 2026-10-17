import type { BusinessRow, EventRow, OfferRow, OrderRow, PlanRow } from "../db/schema";
import { businessUrl, env, subdomainUrl } from "../env";
import { atomicToUsd, atomicToUsdString, PRO_FEE_ATOMIC } from "../money";
import { apiUrl } from "../api";

export function offerView(o: OfferRow) {
  return { sku: o.sku, title: o.title, description: o.description, priceUsd: atomicToUsd(o.priceAtomic), kind: o.kind };
}

export function offerBuyUrl(slug: string, sku: string) {
  return apiUrl(`/x402/b/${slug}/${sku}`);
}

/** Business as returned inside a plan (draft or live). */
export function planBusinessView(b: BusinessRow, offers: OfferRow[]) {
  return {
    slug: b.slug,
    name: b.name,
    tagline: b.tagline,
    description: b.description,
    category: b.category,
    ...(b.city ? { city: b.city } : {}),
    palette: b.palette,
    offers: offers.map(offerView),
    status: b.status,
  };
}

/** Public business shape (directory + GET /v1/businesses/:slug). */
export function publicBusinessView(b: BusinessRow, offers: OfferRow[]) {
  return {
    slug: b.slug,
    name: b.name,
    tagline: b.tagline,
    description: b.description,
    category: b.category,
    city: b.city,
    url: businessUrl(b),
    ...(b.phone ? { phone: b.phone } : {}),
    ...(b.domain && b.package === "pro" ? { domain: b.domain } : {}),
    status: b.status,
    package: b.package,
    palette: b.palette,
    offers: offers.map((o) => ({ ...offerView(o), buyUrl: offerBuyUrl(b.slug, o.sku) })),
    payTo: b.ownerWallet,
    openedAt: b.openedAt ? b.openedAt.toISOString() : null,
    salesCount: b.salesCount,
  };
}

export function directoryEntryView(b: BusinessRow, offers: OfferRow[]) {
  return {
    slug: b.slug,
    name: b.name,
    tagline: b.tagline,
    category: b.category,
    city: b.city,
    url: businessUrl(b),
    ...(b.phone ? { phone: b.phone } : {}),
    offers: offers.map((o) => ({ sku: o.sku, title: o.title, priceUsd: atomicToUsd(o.priceAtomic), kind: o.kind })),
    openedAt: b.openedAt ? b.openedAt.toISOString() : null,
    salesCount: b.salesCount,
  };
}

export function packagesView(plan: PlanRow, business: BusinessRow) {
  const recommended = plan.domains.find((d) => d.domain === plan.recommendedDomain && d.available);
  const root = env.rootDomain();
  return [
    {
      id: "free" as const,
      label: "Free",
      includes: [`Storefront at ${business.slug}.${root}`, "Listed in the Awning directory", "x402 checkout paid straight to your wallet"],
      priceUsd: 0,
    },
    {
      id: "pro" as const,
      label: "Pro",
      includes: [
        recommended ? `Custom domain ${recommended.domain} (first year)` : "Custom domain (first year)",
        "Phone line with an AI receptionist",
        "Everything in Free",
        `$${atomicToUsdString(PRO_FEE_ATOMIC)} first month of phone + receptionist`,
      ],
      priceUsd: recommended ? atomicToUsd(BigInt(recommended.totalAtomic)) : null,
      ...(recommended ? { domain: recommended.domain } : {}),
    },
  ];
}

export function planView(plan: PlanRow, business: BusinessRow, offers: OfferRow[]) {
  return {
    planId: plan.id,
    expiresAt: plan.expiresAt.toISOString(),
    status: plan.status,
    business: planBusinessView(business, offers),
    previewUrl: subdomainUrl(business.slug),
    domains: plan.domains.map((d) => ({
      domain: d.domain,
      available: d.available,
      priceUsd: atomicToUsd(BigInt(d.priceAtomic)),
      /** Exact Pro opening price for this domain (domain + $9.00 first month); what /x402/open charges. */
      totalUsd: d.available ? atomicToUsd(BigInt(d.totalAtomic)) : null,
      totalAtomic: d.available ? d.totalAtomic : null,
    })),
    recommendedDomain: plan.recommendedDomain,
    packages: packagesView(plan, business),
    openUrl: apiUrl(`/x402/open/${plan.id}`),
  };
}

export function orderView(o: OrderRow) {
  return {
    id: o.id,
    slug: o.slug,
    sku: o.sku,
    qty: o.qty,
    totalUsd: atomicToUsd(o.totalAtomic),
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
    tx: o.tx,
    payer: o.payer,
    buyerNote: o.buyerNote,
    buyerContact: o.buyerContact,
    fulfillment: o.fulfillment,
  };
}

export function eventView(e: EventRow) {
  return {
    type: e.type,
    at: e.at.toISOString(),
    slug: e.slug,
    name: e.name,
    ...(e.amountAtomic != null ? { amountUsd: atomicToUsd(e.amountAtomic) } : {}),
    ...(e.tx ? { tx: e.tx } : {}),
  };
}
