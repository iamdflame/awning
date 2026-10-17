import { eq } from "drizzle-orm";
import { getAddress, isAddress, zeroAddress } from "viem";
import { z } from "zod";
import { adapters } from "../adapters";
import { finalizeDraft } from "../adapters/drafter";
import { templateDraft } from "../plan/template";
import type { DomainCheck } from "../adapters/types";
import { db, schema } from "../db/client";
import type { PlanDomain, PlanRow, PreparedPlan } from "../db/schema";
import { env, subdomainUrl } from "../env";
import { newId } from "../ids";
import { errorMessage, log } from "../log";
import { centsToAtomic, parseOfferPrice, proTotalAtomic } from "../money";
import { receptionistName, receptionistPrompt } from "../plan/receptionist";
import { allocateSlug, getBusinessById, offersFor, releaseOwnDraft, skuFrom, slugify } from "./businesses";
import { planView } from "./views";
import { PolicyError, assertPlanQuota, screenBusiness, screenText } from "../policy";

export const planInputSchema = z.object({
  sentence: z.string().trim().min(3, "sentence is too short").max(600, "sentence must be at most 600 characters"),
  ownerWallet: z
    .string()
    .trim()
    .refine((v) => isAddress(v, { strict: false }), "ownerWallet must be an EVM address (0x…)")
    .transform((v) => getAddress(v))
    .refine((v) => v !== zeroAddress, "ownerWallet cannot be the zero address"),
  ownerName: z.string().trim().min(1).max(80).optional(),
  ownerEmail: z.string().trim().email().max(200).optional(),
  ownerPhone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "ownerPhone must be E.164, e.g. +15551234567")
    .optional(),
  country: z.string().trim().min(2).max(56).optional(),
});
export type PlanInput = z.infer<typeof planInputSchema>;

const PRIMARY_TLDS = ["com", "co", "shop", "store"] as const;

function countryCode(country?: string): string {
  if (country && /^[A-Za-z]{2}$/.test(country)) return country.toUpperCase();
  return "US";
}

export function domainCandidates(slug: string, city: string | null): { primary: string[]; variants: string[]; label: string } {
  let label = slug.replace(/-/g, "").slice(0, 50);
  if (label.length < 3) label = `${label}shop`;
  const primary = PRIMARY_TLDS.map((t) => `${label}.${t}`);
  const variants = [`get${label}.com`, `${label}hq.com`];
  if (city) {
    const c = slugify(city).replace(/-/g, "");
    if (c && !label.includes(c)) variants.push(`${label}${c}.com`.slice(0, 63 + 4));
  }
  return { primary, variants, label };
}

/** Exactly three suggestions: available names first (TLD preference order), honest about taken ones. */
export function pickDomains(checks: DomainCheck[], primary: string[], variants: string[]): DomainCheck[] {
  const by = new Map(checks.map((c) => [c.domain, c]));
  const order = [...primary, ...variants];
  const available = order.map((d) => by.get(d)).filter((c): c is DomainCheck => !!c && c.available);
  const picked: DomainCheck[] = available.slice(0, 3);
  for (const d of primary) {
    if (picked.length >= 3) break;
    const c = by.get(d);
    if (c && !picked.includes(c)) picked.push(c);
    else if (!c) picked.push({ domain: d, available: false, priceUsd: "0", cents: 0, premium: false, unresolved: true });
  }
  return picked.slice(0, 3);
}

function toPlanDomain(c: DomainCheck): PlanDomain {
  if (!c.available || c.cents <= 0) return { domain: c.domain, available: false, priceAtomic: "0", registrarCents: 0, totalAtomic: "0", premium: c.premium };
  const priceAtomic = centsToAtomic(c.cents);
  return { domain: c.domain, available: true, priceAtomic: priceAtomic.toString(), registrarCents: c.cents, totalAtomic: proTotalAtomic(priceAtomic).toString() };
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(new Error(`timeout after ${ms}ms`)), ms);
  try {
    return await p(ctl.signal);
  } finally {
    clearTimeout(t);
  }
}

/**
 * POST /v1/plan. Drafts the business, prices domains, pre-computes everything
 * the paid open needs, and stores a *draft* business. No money moves and no
 * external resource is created (registrar/phone calls here are read-only).
 */
export async function createPlan(input: PlanInput) {
  const startedAt = Date.now();
  // Acceptable use first: nothing is drafted, checked or stored for a prohibited business.
  const pre = screenText(input.sentence);
  if (!pre.ok) throw new PolicyError(pre);
  await assertPlanQuota(input.ownerWallet);
  const a = adapters();
  const draftInput = { sentence: input.sentence, ownerName: input.ownerName, country: input.country };
  const country = countryCode(input.country);

  // Latency: the template draft is instant, so domain checks and the phone
  // search start immediately, in parallel with the LLM draft. When the LLM
  // names the business differently, its own domains are checked (bounded);
  // if that cannot finish, the template draft is used so name and domains agree.
  const template = finalizeDraft(templateDraft(draftInput), draftInput);
  const checkFor = (name: string, city: string | null, ms: number) => {
    const c = domainCandidates(slugify(name), city);
    const checks = withTimeout((s) => a.registrar.check([...c.primary, ...c.variants], s), ms).catch((err) => {
      log.warn("domain check failed", { error: errorMessage(err) });
      return [] as DomainCheck[];
    });
    return { ...c, checks };
  };
  const firstCheck = checkFor(template.name, template.city, 5000);
  const phoneSearch = withTimeout((s) => a.telephony.search(country, s), 5000).catch((err) => {
    log.warn("phone search failed", { error: errorMessage(err) });
    return [] as string[];
  });
  const llmDraft = a.drafter.mock
    ? Promise.resolve(null)
    : withTimeout((s) => a.drafter.draft(draftInput, s), env.llmTimeoutMs())
        .then((raw) => finalizeDraft(raw, draftInput))
        .catch((err) => {
          log.warn("LLM draft failed; using template", { error: errorMessage(err) });
          return null;
        });

  let draft = template;
  let source: "llm" | "template" = "template";
  let domainSet = firstCheck;
  const llm = await llmDraft;
  if (llm) {
    draft = llm;
    source = "llm";
    const label = domainCandidates(slugify(llm.name), llm.city).label;
    if (label !== firstCheck.label) {
      // The plugin waits 8 s for this response; keep the whole plan under ~6.5 s.
      const second = checkFor(llm.name, llm.city, Math.max(1200, 6500 - (Date.now() - startedAt)));
      if ((await second.checks).length) domainSet = second;
      else {
        draft = template;
        source = "template";
      }
    }
  }
  // Screen exactly what will be published (name, copy, offers); catches brand impersonation in the name.
  const post = screenBusiness(draft);
  if (!post.ok) throw new PolicyError(post);
  const { primary, variants } = domainSet;
  const [checks, phoneCandidates] = await Promise.all([domainSet.checks, phoneSearch]);

  // Offers: validated prices (whole cents, in range) and unique SKUs.
  const takenSkus = new Set<string>();
  const offers = draft.offers.map((o, i) => ({
    id: newId("off"),
    sku: skuFrom(o.title, takenSkus),
    title: o.title,
    description: o.description,
    kind: o.kind,
    priceAtomic: parseOfferPrice(o.priceUsd.toFixed(2)),
    position: i,
  }));

  const d = await db();
  await releaseOwnDraft(slugify(draft.name), input.ownerWallet);
  let slug = await allocateSlug(draft.name, draft.city);
  const domains = pickDomains(checks, primary, variants).map(toPlanDomain);
  const recommended = domains.find((x) => x.available)?.domain ?? null;

  const agentName = receptionistName(draft.name);
  const businessId = newId("biz");
  const planId = newId("pln");
  const url = recommended ? `https://${recommended}` : subdomainUrl(slug);
  const prepared: PreparedPlan = {
    receptionist: {
      agentName,
      ...receptionistPrompt({ name: draft.name, agentName, city: draft.city, category: draft.category, description: draft.description, url, offers: draft.offers }),
    },
    dns: [
      { type: "A", name: "", content: env.vercelTarget() },
      { type: "CNAME", name: "www", content: env.vercelCname() },
    ],
    phone: { country, candidates: phoneCandidates.slice(0, 3) },
    draftSource: source,
  };

  for (let attempt = 0; ; attempt++) {
    try {
      await d.insert(schema.businesses).values({
        id: businessId,
        slug,
        planId,
        name: draft.name,
        tagline: draft.tagline,
        description: draft.description,
        category: draft.category,
        city: draft.city,
        palette: draft.palette,
        ownerWallet: input.ownerWallet,
        ownerName: input.ownerName ?? null,
        ownerPhone: input.ownerPhone ?? null,
        status: "draft",
        receptionistName: agentName,
      });
      break;
    } catch (err) {
      // Slug race with a concurrent plan: allocate again once.
      if (attempt >= 2 || !/unique|duplicate/i.test(errorMessage(err))) throw err;
      slug = await allocateSlug(`${draft.name} ${attempt + 2}`, null);
    }
  }
  await d.insert(schema.offers).values(offers.map((o) => ({ ...o, businessId })));
  const [plan] = await d
    .insert(schema.plans)
    .values({
      id: planId,
      businessId,
      sentence: input.sentence,
      ownerWallet: input.ownerWallet,
      ownerName: input.ownerName ?? null,
      ownerEmail: input.ownerEmail ?? null,
      ownerPhone: input.ownerPhone ?? null,
      country: input.country ?? null,
      status: "quoted",
      domains,
      recommendedDomain: recommended,
      prepared,
      expiresAt: new Date(Date.now() + env.planTtlSeconds() * 1000),
    })
    .returning();

  log.info("plan created", { planId, slug, source, domains: domains.map((x) => `${x.domain}:${x.available ? x.totalAtomic : "taken"}`) });
  return getPlanViewFromRows(plan!);
}

export async function getPlan(planId: string): Promise<PlanRow | null> {
  const d = await db();
  const [row] = await d.select().from(schema.plans).where(eq(schema.plans.id, planId)).limit(1);
  return row ?? null;
}

async function getPlanViewFromRows(plan: PlanRow) {
  const business = await getBusinessById(plan.businessId);
  if (!business) throw new Error(`plan ${plan.id} has no business`);
  const offers = await offersFor(business.id);
  return planView(plan, business, offers);
}

export async function getPlanView(planId: string) {
  const plan = await getPlan(planId);
  if (!plan) return null;
  return getPlanViewFromRows(plan);
}
