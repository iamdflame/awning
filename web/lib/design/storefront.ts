import type { BusinessRow, OfferKind, OfferRow } from "../db/schema";
import type { ImageRole } from "../db/images";
import { env } from "../env";
import { atomicToUsdString } from "../money";
import { offerBuyUrl } from "../services/views";
import { ART, artKindFor, coffee, type ArtKind } from "./art";
import { storefrontFontsHref, structureFor, themeFrom, tileSVG, type Structure, type Theme } from "./theme";

/**
 * Everything the storefront template needs, derived from the DB row (the same
 * fields design/storefront/storefront.js reads from the API shape).
 */
export type StoreOffer = { sku: string; title: string; desc: string; price: string; unit: string; verb: string; kind: OfferKind; buyUrl: string; prompt: string };
export type StorePhoto = { url: string; width: number; height: number };
export type StoreView = {
  slug: string;
  name: string;
  tagline: string;
  about: string;
  category: string;
  city: string | null;
  status: "draft" | "live" | "suspended";
  domain: string;
  phone: string | null;
  tel: string | null;
  receptionist: string;
  wallet: string;
  walletShort: string;
  structure: Structure;
  theme: Theme;
  art: string;
  artKind: ArtKind;
  photos: Partial<Record<ImageRole, StorePhoto>>;
  offers: StoreOffer[];
  featured: StoreOffer | null;
  statusLine: string;
  navOffers: string;
  fontsHref: string;
  tile: string | null;
};

/** "$5", "$14.50" (storefronts drop ".00"). */
export function usd(price: string): string {
  return "$" + price.replace(/\.00$/, "");
}

/** What a price is for, from the offer's kind and words. */
export function unitFor(kind: OfferKind, title: string): string {
  const t = title.toLowerCase();
  if (kind === "subscription") return /week/.test(t) ? "per week" : /year|annual/.test(t) ? "per year" : "per month";
  if (kind === "booking") return /class|lesson|tasting|workshop|tour|session|cupping/.test(t) ? "per person" : /table|reservation|deposit/.test(t) ? "deposit" : "per booking";
  if (kind === "digital") return "download";
  if (kind === "service") return /hour/.test(t) ? "per hour" : "fixed price";
  return "each";
}

/** storefront.js verb(): the action on an offer's button. */
export function verbFor(kind: OfferKind, title: string): string {
  const s = title.toLowerCase();
  if (kind === "booking" || /class|tasting|tune|call|session|lesson/.test(s)) return "Book";
  if (kind === "subscription" || /month|box|subscri/.test(s)) return "Subscribe";
  return "Buy";
}

function phrase(title: string): string {
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(title) || /^[A-Z]{2}/.test(title)) return title;
  return title.charAt(0).toLowerCase() + title.slice(1);
}

function article(p: string): string {
  if (/^(the|a|an|my|our)\s/i.test(p) || /^\d/.test(p)) return "";
  return /^[aeiou]/i.test(p) ? "an " : "a ";
}

/** The exact sentence to give an agent with PayBox. */
export function agentPrompt(kind: OfferKind, title: string, name: string, domain: string): string {
  const p = phrase(title);
  if (kind === "booking") return `Book ${article(p)}${p} at ${name} (${domain}) and pay with PayBox.`;
  if (kind === "subscription") return `Start ${article(p)}${p} with ${name} (${domain}) and pay with PayBox.`;
  return `Buy ${article(p)}${p} from ${name} (${domain}) and pay with PayBox.`;
}

const CC = new Set(["1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98", "212", "213", "216", "220", "221", "223", "225", "226", "227", "228", "229", "231", "232", "233", "234", "237", "250", "251", "254", "255", "256", "260", "263", "351", "352", "353", "354", "358", "359", "370", "371", "372", "380", "385", "386", "420", "421", "852", "880", "886", "961", "962", "966", "971", "972", "974"]);

/** E.164 → a readable local format: "+1 (737) 555-0119", "+233 30 290 0143". */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/[^\d]/g, "");
  if (!e164.startsWith("+") || digits.length < 8) return e164;
  if (digits.startsWith("1") && digits.length === 11) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  const cc = [3, 2, 1].map((n) => digits.slice(0, n)).find((c) => CC.has(c)) ?? digits.slice(0, 2);
  const rest = digits.slice(cc.length);
  const groups = rest.length === 9 ? [rest.slice(0, 2), rest.slice(2, 5), rest.slice(5)] : rest.length === 10 ? [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6)] : (rest.match(/.{1,3}(?=(.{4})*$)|.{4}/g) ?? [rest]);
  return `+${cc} ${groups.join(" ")}`;
}

export function shortWallet(w: string): string {
  return w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
}

export function displayDomain(b: Pick<BusinessRow, "slug" | "domain" | "package" | "status">): string {
  if (b.domain && b.package === "pro" && b.status === "live") return b.domain;
  return `${b.slug}.${env.rootDomain()}`;
}

/** The coffee bag's label for a real business: its own weight if an offer names one, else its initial and city. */
function coffeeLabel(name: string, city: string | null, offers: OfferRow[]) {
  const w = offers.map((o) => /(\d{2,4})\s?(g|kg|oz|lb)\b/i.exec(o.title)).find(Boolean);
  return { big: w ? `${w[1]}${w[2]!.toLowerCase()}` : (name.trim()[0] ?? "A").toUpperCase(), small: (city ?? "small batch").toUpperCase().slice(0, 18) };
}

export function buildStoreView(b: BusinessRow, offerRows: OfferRow[], photos: Partial<Record<ImageRole, StorePhoto>> = {}): StoreView {
  const structure = structureFor({ category: b.category, name: b.name, tagline: b.tagline, offers: offerRows });
  const theme = themeFrom(b.palette, structure.hero);
  const status = b.status === "suspended" ? "suspended" : b.status === "live" ? "live" : "draft";
  const domain = displayDomain(b);
  const offers: StoreOffer[] = offerRows.map((o) => ({
    sku: o.sku,
    title: o.title,
    desc: o.description,
    price: atomicToUsdString(o.priceAtomic),
    unit: unitFor(o.kind, o.title),
    verb: verbFor(o.kind, o.title),
    kind: o.kind,
    buyUrl: offerBuyUrl(b.slug, o.sku),
    prompt: agentPrompt(o.kind, o.title, b.name, domain),
  }));
  const artKind = artKindFor([b.category, b.name, b.tagline, ...offerRows.map((o) => o.title)].join(" "));
  const artPalette = { ...theme, displayFont: structure.display, textFont: structure.text };
  // the coffee bag carries this business's own label, never the sample's "250g / VOLTA WASHED"
  const art = artKind === "coffee" ? coffee(artPalette, b.name, `sf-${b.slug}`, coffeeLabel(b.name, b.city, offerRows)) : ART[artKind](artPalette, b.name, `sf-${b.slug}`);
  const hasPhone = !!b.phone && status === "live";
  const place = b.city ? ` in ${b.city}` : "";
  return {
    slug: b.slug,
    name: b.name,
    tagline: b.tagline,
    about: b.description,
    category: b.category,
    city: b.city,
    status,
    domain,
    phone: hasPhone ? formatPhone(b.phone!) : null,
    tel: hasPhone ? b.phone!.replace(/[^+\d]/g, "") : null,
    receptionist: b.receptionistName ?? "our receptionist",
    wallet: b.ownerWallet,
    walletShort: shortWallet(b.ownerWallet),
    structure,
    theme,
    art,
    artKind,
    photos,
    offers,
    featured: offers[0] ?? null,
    statusLine: status === "suspended" ? `Closed for review${place}` : status === "draft" ? `Opening soon${place}` : `Open for orders${place}`,
    navOffers: structure.hero === "arch" ? "Work and classes" : structure.hero === "poster" ? "Prices" : "Menu",
    fontsHref: storefrontFontsHref(structure),
    tile: structure.canopy === "tile" ? `url("data:image/svg+xml,${encodeURIComponent(tileSVG(theme))}")` : null,
  };
}
