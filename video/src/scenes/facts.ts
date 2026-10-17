// The product's own numbers for the film's receipts: from awning.sh when the real shop and sale
// exist (public/capture/manifest.json, filled by `npm run capture`), else from the local mock build
// (then every graphic that prints them says LOCAL MOCK DATA).
import type { Assets } from "../data";
import { BUSINESS } from "../story";

type Offer = { title: string; priceUsd: number; sku?: string; kind?: string };
const short = (s?: string | null, a = 6, b = 4) => (s && s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s ?? "");
const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

export function shopFacts(assets: Assets) {
  const shot = assets.capture.shots["storefront"];
  const data = (shot?.data ?? {}) as { name?: string; offers?: Offer[]; payTo?: string; url?: string; domain?: string | null; palette?: { ink: string; paper: string; accent: string; primary: string } };
  const liveShop = assets.capture.live?.shops?.find((s) => s.slug === BUSINESS.slug);
  const offers: Offer[] = (liveShop?.offers as Offer[] | undefined) ?? data.offers ?? [];
  return {
    mock: shot?.source !== "live",
    name: liveShop?.name ?? data.name ?? BUSINESS.name,
    offers: offers.map((o) => ({ title: o.title, price: money(o.priceUsd) })),
    wallet: data.payTo ?? null,
    walletShort: short(data.payTo),
    // the shop's own colors (the drafter picks them), for anything drawn in its style
    palette: data.palette ?? { ink: "#2b1d16", paper: "#fbe8cf", accent: "#d98e48", primary: "#6b1d14" },
  };
}

export function saleFacts(assets: Assets) {
  const liveSale = assets.capture.live?.events?.find((e) => e.type === "order" && e.slug === BUSINESS.slug);
  const localSale = assets.capture.local?.events?.find((e) => e.type === "order");
  const ev = liveSale ?? localSale;
  const shop = shopFacts(assets);
  return {
    mock: !liveSale,
    amount: ev?.amountUsd != null ? ev.amountUsd.toFixed(2) : BUSINESS.tasting.priceUsdc,
    tx: ev?.tx ?? null,
    txShort: short(ev?.tx),
    at: ev?.at ?? null,
    wallet: shop.wallet,
    walletShort: shop.walletShort || "the owner's wallet",
  };
}
