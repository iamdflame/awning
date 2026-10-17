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
  return null;
}

const KIND_RULES: [RegExp, OfferKind][] = [
  [/\b(subscription|subscribe|monthly|per month|membership|weekly box|box a month|retainer|plan)\b/i, "subscription"],
  [/\b(session|class|lesson|appointment|booking|tasting|tour|consult|consultation|reservation|walk|call|workshop|cupping|massage|haircut|cut|braids?)\b/i, "booking"],
  [/\b(pdf|ebook|e-book|guide|download|template|preset|course|recipe|playlist|gift card|voucher)\b/i, "digital"],
  [/\b(design|cleaning|repair|editing|coverage|build|audit|service|delivery|catering|install)\b/i, "service"],
];

export function inferKind(title: string, fallback: OfferKind = "product"): OfferKind {
  for (const [re, kind] of KIND_RULES) if (re.test(title)) return kind;
  return fallback;
}

/** "$5 tasting session", "tasting sessions for $5", "$30 monthly subscription box" */
export function detectPricedOffers(sentence: string): DraftOffer[] {
  const found: DraftOffer[] = [];
  const seen = new Set<string>();
  const push = (price: string, phrase: string) => {
    const words = phrase
      .replace(/\b(a|an|the|some|our|my)\b/gi, " ")
      .replace(/[^\w\s'’&-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 6);
    const title = titleCase(words.join(" "));
    const priceUsd = Number(price);
    if (!title || title.length < 3 || !(priceUsd > 0) || priceUsd > 10000) return;
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ title, description: `${title}, as offered by the owner.`, priceUsd: Math.round(priceUsd * 100) / 100, kind: inferKind(title) });
  };
  const after = /\$\s?(\d{1,5}(?:\.\d{1,2})?)\s*(?:usd|usdc)?\s+(?!(?:and|or|for|with|per|each|a\s+month|an?\s+hour)\b)((?:[a-zA-Z][\w'’&-]*\s?){1,6}?)(?=\s*(?:[,.;!?)]|\band\b|\bor\b|\bwith\b|\bfor\b|$))/gi;
  for (const m of sentence.matchAll(after)) push(m[1]!, m[2]!);
  const before = /\b((?:[a-zA-Z][\w'’&-]*\s){1,5}?)(?:for|at)\s+\$\s?(\d{1,5}(?:\.\d{1,2})?)/gi;
  for (const m of sentence.matchAll(before)) {
    const phrase = m[1]!.replace(/^(?:sell|selling|offer|offering|and|with|do|doing|run|running)\s+/i, "");
    push(m[2]!, phrase);
  }
  return found.slice(0, 3);
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
  for (const o of cat.offers) {
    if (offers.length >= 4) break;
    const clash = offers.some((p) => p.kind === o.kind && p.kind !== "product") || offers.some((p) => p.title.toLowerCase() === o.title.toLowerCase());
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
