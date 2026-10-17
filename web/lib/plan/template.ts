import type { OfferKind } from "../db/schema";
import type { BusinessDraft, DraftInput, DraftOffer } from "../adapters/types";
import { stableIndex } from "../ids";
import { CATEGORIES, GENERAL, type CategoryDef } from "./catalog";

/**
 * Deterministic business draft from one sentence (no LLM). Same sentence →
 * same draft. Uses only facts in the sentence plus generic, truthful copy.
 */

const STOP_NAME = new Set(["a", "an", "the", "my", "our", "start", "open", "launch", "create", "business", "shop", "store", "i", "we"]);
const CITY_STOP = new Set(["The", "A", "An", "My", "Our", "I", "We", "Instagram", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);

export function detectCategory(sentence: string): CategoryDef {
  const text = ` ${sentence.toLowerCase().replace(/[^a-z0-9é\s-]/g, " ")} `;
  let best: { def: CategoryDef; score: number; first: number } | null = null;
  for (const def of CATEGORIES) {
    let score = 0;
    let first = Infinity;
    for (const kw of def.keywords) {
      const idx = text.indexOf(` ${kw} `);
      const stem = text.indexOf(` ${kw}`);
      if (idx >= 0) {
        score += 2;
        first = Math.min(first, idx);
      } else if (stem >= 0 && kw.length >= 4) {
        score += 1;
        first = Math.min(first, stem);
      }
    }
    if (score > 0 && (!best || score > best.score || (score === best.score && first < best.first))) best = { def, score, first };
  }
  return best?.def ?? GENERAL;
}

export function detectCity(sentence: string): string | null {
  const re = /\b(?:in|from|based in|out of|serving|around)\s+([A-Z][a-zA-Zà-ÿ'’-]+(?:\s+[A-Z][a-zA-Zà-ÿ'’-]+)?)/g;
  for (const m of sentence.matchAll(re)) {
    const city = m[1]!.trim();
    const firstWord = city.split(/\s+/)[0]!;
    if (!CITY_STOP.has(firstWord)) return city;
  }
  return null;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 && /^(of|and|to|a|an|in|on|for|by)$/i.test(w) ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

function cleanName(raw: string): string | null {
  const name = raw
    .replace(/["“”'‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/, "");
  if (name.length < 2 || name.length > 40) return null;
  const words = name.split(" ");
  if (words.length > 5) return null;
  if (words.every((w) => STOP_NAME.has(w.toLowerCase()))) return null;
  return name;
}

export function detectName(sentence: string): string | null {
  const patterns: RegExp[] = [
    /\b(?:called|named)\s+["“']?([A-Z0-9][\w'’&.-]*(?:\s+(?:&\s+)?[A-Z0-9][\w'’&.-]*){0,4})/,
    /\bbusiness\s*:\s*["“]?([^—–,.:;"”(]+?)\s*(?:["”]|\s[—–-]\s|[—–,.:;(]|$)/i,
    /["“]([^"”]{2,40})["”]/,
    /^\s*([A-Z0-9][\w'’&.-]*(?:\s+(?:&\s+)?[A-Z0-9][\w'’&.-]*){0,4})\s*[—–:-]\s/,
  ];
  for (const re of patterns) {
    const m = re.exec(sentence);
    if (m?.[1]) {
      const n = cleanName(m[1]);
      if (n) return n;
    }
  }
  // "business: Ridge Roast small-batch coffee…" with no usable separator:
  // take the leading run of capitalised words after the colon.
  const lead = /\bbusiness\s*:\s*["“]?((?:[A-Z0-9][\w'’&.]*\s*){1,4})/.exec(sentence);
  if (lead?.[1]) {
    const words = lead[1].trim().split(/\s+/).filter((w) => /^[A-Z0-9]/.test(w));
    const n = cleanName(words.join(" "));
    if (n) return n;
  }
  return null;
}

const KIND_RULES: [RegExp, OfferKind][] = [
  [/\b(subscription|subscribe|monthly|per month|membership|weekly box|box a month|retainer|plan)\b/i, "subscription"],
  [/\b(session|class|lesson|appointment|booking|tasting|tour|consult|consultation|reservation|walk|call|workshop|cupping|massage|haircut|cut|braids?|fills?|lash(?:es)?|nails?|manicure|pedicure|facial|wax(?:ing)?|tattoo|piercing|trim|groom(?:ing)?|fitting|visit)\b/i, "booking"],
  [/\b(pdf|ebook|e-book|guide|download|template|preset|course|recipe|playlist|gift card|voucher)\b/i, "digital"],
  [/\b(design|cleaning|repair|editing|coverage|build|audit|service|delivery|catering|install)\b/i, "service"],
];

export function inferKind(title: string, fallback: OfferKind = "product"): OfferKind {
  for (const [re, kind] of KIND_RULES) if (re.test(title)) return kind;
  return fallback;
}

const BOUNDARY = new Set([
  "in", "from", "at", "on", "near", "selling", "sell", "sells", "sold", "offer", "offers", "offering", "with", "and", "plus",
  "called", "named", "do", "doing", "run", "running", "make", "making", "bake", "baking", "ship", "shipping", "also", "or", "then",
  "a", "an", "the", "some", "our", "my", "to", "that", "who", "which", "i", "we", "business", "start", "open",
]);

function describe(title: string, kind: OfferKind): string {
  const t = title.toLowerCase();
  switch (kind) {
    case "booking":
      return `Book a ${t}; the owner confirms the time with you.`;
    case "subscription":
      return `${title}, first period. Renewals are separate payments.`;
    case "digital":
      return `${title}, delivered digitally after purchase.`;
    case "service":
      return `${title}, done by the owner.`;
    default:
      return `${title}, ordered directly from the owner.`;
  }
}

/** Keep the words after the last boundary word: "in lisbon selling sourdough loaves" → "sourdough loaves". */
function offerPhrase(raw: string, fromEnd: boolean): string {
  const words = raw
    .replace(/[^\w\s'’&-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (fromEnd) {
    let start = 0;
    words.forEach((w, i) => {
      if (BOUNDARY.has(w.toLowerCase())) start = i + 1;
    });
    return words.slice(start).slice(-5).join(" ");
  }
  // "$9 and pastry boxes", "$40 in Atlanta": the price belongs to what came before.
  if (!words.length || BOUNDARY.has(words[0]!.toLowerCase()) || /^(per|each|for)$/i.test(words[0]!)) return "";
  const out: string[] = [];
  for (const w of words) {
    if (BOUNDARY.has(w.toLowerCase())) {
      if (out.length) break;
      continue;
    }
    out.push(w);
    if (out.length >= 5) break;
  }
  return out.join(" ");
}

/** "$5 tasting session", "tasting sessions for $5", "$30 monthly subscription box" */
export function detectPricedOffers(sentence: string): DraftOffer[] {
  const found: DraftOffer[] = [];
  const seen = new Set<string>();
  const push = (price: string, phrase: string) => {
    const title = titleCase(phrase);
    const priceUsd = Number(price);
    if (!title || title.length < 3 || !(priceUsd > 0) || priceUsd > 10000) return;
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const kind = inferKind(title);
    found.push({ title, description: describe(title, kind), priceUsd: Math.round(priceUsd * 100) / 100, kind });
  };
  const after = /\$\s?(\d{1,5}(?:\.\d{1,2})?)\s*(?:usd|usdc)?\s+((?:[a-zA-Z][\w'’&-]*\s?){1,6})/gi;
  for (const m of sentence.matchAll(after)) push(m[1]!, offerPhrase(m[2]!, false));
  const before = /((?:[a-zA-Z][\w'’&-]*\s){1,8}?)(?:for|at)\s+\$\s?(\d{1,5}(?:\.\d{1,2})?)/gi;
  for (const m of sentence.matchAll(before)) push(m[2]!, offerPhrase(m[1]!, true));
  return found.slice(0, 3);
}

export type UnitPrice = { priceUsd: number; unit: string; phrase: string };

/** "$20 per walk", "$40 an hour", "soy candles, $18 each" */
export function detectUnitPrices(sentence: string): UnitPrice[] {
  const re = /((?:[a-zA-Z][\w'’&-]*[,:]?\s){0,6}?)[,:(–—-]?\s*\$\s?(\d{1,5}(?:\.\d{1,2})?)\s*(each|apiece|per\s+([a-z]+)|an?\s+([a-z]+))\b/gi;
  const out: UnitPrice[] = [];
  for (const m of sentence.matchAll(re)) {
    const unit = (m[4] ?? m[5] ?? m[3] ?? "").toLowerCase();
    const priceUsd = Number(m[2]);
    if (!(priceUsd > 0) || priceUsd > 10000) continue;
    out.push({ priceUsd: Math.round(priceUsd * 100) / 100, unit, phrase: offerPhrase(m[1] ?? "", true) });
  }
  return out.slice(0, 3);
}

/** Significant word stems, for "is this default offer already covered?" */
function stems(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 4 && !BOUNDARY.has(w))
      .map((w) => w.replace(/(es|s)$/, "")),
  );
}

function article(s: string): string {
  return /^[aeiou]/i.test(s) ? "an" : "a";
}

export function templateDraft(input: DraftInput): BusinessDraft {
  const sentence = input.sentence.trim();
  const cat = detectCategory(sentence);
  const city = detectCity(sentence);
  const detected = detectName(sentence);
  const ownerFirst = input.ownerName?.trim().split(/\s+/)[0];
  const name =
    detected ??
    (city ? `${city} ${cat.nameNoun}` : ownerFirst ? `${ownerFirst}'s ${cat.nameNoun}` : `Corner ${cat.nameNoun}`).replace(/\s+/g, " ");

  const seed = `${name}|${sentence}`;
  const palette = cat.palettes[stableIndex(seed, cat.palettes.length)]!;
  const tagline = cat.taglines[stableIndex(seed + "t", cat.taglines.length)]!.replace("{in}", city ? ` in ${city}` : "");

  const priced = detectPricedOffers(sentence);
  const offers: DraftOffer[] = [...priced];
  // Unit prices adjust the matching default ("$20 per walk" → Dog walk $20) or become an offer.
  const defaults = cat.offers.map((o) => ({ ...o }));
  for (const u of detectUnitPrices(sentence)) {
    if (offers.some((o) => Math.abs(o.priceUsd - u.priceUsd) < 0.005)) continue;
    const want = new Set([...stems(u.unit), ...stems(u.phrase)]);
    const match = defaults.find((o) => [...stems(o.title)].some((w) => want.has(w)));
    if (match) {
      match.priceUsd = u.priceUsd;
      offers.push(match);
      defaults.splice(defaults.indexOf(match), 1);
    } else if (u.phrase && u.phrase.toLowerCase() !== (city ?? "").toLowerCase()) {
      const title = titleCase(u.phrase);
      const kind = /^(each|apiece)$/.test(u.unit) ? "product" : inferKind(`${title} ${u.unit}`, "service");
      offers.push({ title, description: describe(title, kind), priceUsd: u.priceUsd, kind });
    }
  }
  for (const o of defaults) {
    if (offers.length >= 4) break;
    const os = stems(o.title);
    const clash =
      offers.some((p) => p.kind === o.kind && p.kind !== "product") ||
      offers.some((p) => p.title.toLowerCase() === o.title.toLowerCase() || [...stems(p.title)].some((w) => os.has(w)));
    if (!clash) offers.push({ ...o });
  }
  while (offers.length < 3) {
    const extra = GENERAL.offers[offers.length % GENERAL.offers.length]!;
    if (!offers.some((o) => o.title === extra.title)) offers.push({ ...extra });
    else offers.push({ ...extra, title: `${extra.title} (${offers.length + 1})` });
  }

  const descriptor = cat.descriptor.replace(/^an? /, "");
  const description = [
    `${name} is ${article(descriptor)} ${descriptor}${city ? ` in ${city}` : ""}.`,
    cat.craft,
    "Order here or through any AI agent; payments go straight to the owner in USDC.",
  ].join(" ");

  return { name, tagline, description, category: cat.label, city, palette, offers: offers.slice(0, 5) };
}
