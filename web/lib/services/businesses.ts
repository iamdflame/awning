import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import type { BusinessRow, OfferKind, OfferRow } from "../db/schema";
import { newId } from "../ids";

export const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "live", "directory", "docs", "status", "mail", "email", "s", "v1", "x402",
  "blog", "help", "support", "dashboard", "owner", "owners", "static", "assets", "cdn", "awning", "paybox",
  "login", "signup", "account", "billing", "pricing", "terms", "privacy", "about", "new", "test", "dev",
]);

/** "Ridge Roast" → "ridge-roast" (a valid DNS label, ≤ 40 chars). */
export function slugify(s: string): string {
  const base = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "shop";
}

export async function slugTaken(slug: string): Promise<boolean> {
  const d = await db();
  const [row] = await d.select({ id: schema.businesses.id }).from(schema.businesses).where(eq(schema.businesses.slug, slug)).limit(1);
  return !!row;
}

/** First free slug among name, name-city, name-2…name-99. */
export async function allocateSlug(name: string, city: string | null): Promise<string> {
  const base = slugify(name);
  const candidates = [base];
  if (city) candidates.push(`${base}-${slugify(city)}`.slice(0, 50));
  for (let i = 2; i < 100; i++) candidates.push(`${base}-${i}`);
  for (const c of candidates) {
    if (RESERVED_SLUGS.has(c)) continue;
    if (!(await slugTaken(c))) return c;
  }
  return `${base}-${newId("x", 4).slice(2)}`;
}

export async function getBusinessBySlug(slug: string): Promise<BusinessRow | null> {
  const d = await db();
  const [row] = await d.select().from(schema.businesses).where(eq(schema.businesses.slug, slug.toLowerCase())).limit(1);
  return row ?? null;
}

export async function getBusinessById(id: string): Promise<BusinessRow | null> {
  const d = await db();
  const [row] = await d.select().from(schema.businesses).where(eq(schema.businesses.id, id)).limit(1);
  return row ?? null;
}

/** Custom-domain lookup (apex or www). Only live pro businesses answer on their domain. */
export async function getBusinessByDomain(host: string): Promise<BusinessRow | null> {
  const domain = host.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "");
  const d = await db();
  const [row] = await d
    .select()
    .from(schema.businesses)
    .where(and(eq(schema.businesses.domain, domain), eq(schema.businesses.package, "pro")))
    .limit(1);
  return row ?? null;
}

export async function offersFor(businessId: string, activeOnly = true): Promise<OfferRow[]> {
  const d = await db();
  return d
    .select()
    .from(schema.offers)
    .where(activeOnly ? and(eq(schema.offers.businessId, businessId), eq(schema.offers.active, true)) : eq(schema.offers.businessId, businessId))
    .orderBy(asc(schema.offers.position), asc(schema.offers.createdAt));
}

export async function offersForMany(businessIds: string[]): Promise<Map<string, OfferRow[]>> {
  const out = new Map<string, OfferRow[]>();
  if (!businessIds.length) return out;
  const d = await db();
  const rows = await d
    .select()
    .from(schema.offers)
    .where(and(inArray(schema.offers.businessId, businessIds), eq(schema.offers.active, true)))
    .orderBy(asc(schema.offers.position), asc(schema.offers.createdAt));
  for (const r of rows) {
    const list = out.get(r.businessId) ?? [];
    list.push(r);
    out.set(r.businessId, list);
  }
  return out;
}

export async function getOffer(businessId: string, sku: string): Promise<OfferRow | null> {
  const d = await db();
  const [row] = await d
    .select()
    .from(schema.offers)
    .where(and(eq(schema.offers.businessId, businessId), eq(schema.offers.sku, sku.toLowerCase())))
    .limit(1);
  return row ?? null;
}

export async function listLiveBusinesses(opts: { q?: string; category?: string; limit?: number }) {
  const d = await db();
  const conds = [eq(schema.businesses.status, "live")];
  if (opts.q && opts.q.trim()) {
    const words = opts.q.trim().split(/\s+/).slice(0, 6);
    for (const w of words) {
      const like = `%${w.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      conds.push(
        or(
          ilike(schema.businesses.name, like),
          ilike(schema.businesses.tagline, like),
          ilike(schema.businesses.description, like),
          ilike(schema.businesses.category, like),
          ilike(schema.businesses.city, like),
          sql`exists (select 1 from ${schema.offers} o where o.business_id = ${schema.businesses.id} and o.active and (o.title ilike ${like} or o.description ilike ${like}))`,
        )!,
      );
    }
  }
  if (opts.category && opts.category.trim()) conds.push(ilike(schema.businesses.category, `%${opts.category.trim()}%`));
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  return d
    .select()
    .from(schema.businesses)
    .where(and(...conds))
    .orderBy(desc(schema.businesses.openedAt))
    .limit(limit);
}

export async function stats() {
  const d = await db();
  const [b] = await d.select({ n: sql<number>`count(*)::int` }).from(schema.businesses).where(eq(schema.businesses.status, "live"));
  const [o] = await d
    .select({ n: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${schema.orders.totalAtomic}), 0)::text` })
    .from(schema.orders)
    .where(eq(schema.orders.status, "paid"));
  return { businesses: Number(b?.n ?? 0), orders: Number(o?.n ?? 0), toOwnersAtomic: BigInt(o?.total ?? "0") };
}

export function skuFrom(title: string, taken: Set<string>): string {
  const base = slugify(title).slice(0, 32).replace(/-+$/g, "") || "item";
  let sku = base;
  for (let i = 2; taken.has(sku); i++) sku = `${base}-${i}`;
  taken.add(sku);
  return sku;
}

export async function addOffer(business: BusinessRow, input: { title: string; description: string; priceAtomic: bigint; kind: OfferKind }) {
  const d = await db();
  const existing = await offersFor(business.id, false);
  const sku = skuFrom(input.title, new Set(existing.map((o) => o.sku)));
  const position = existing.reduce((m, o) => Math.max(m, o.position), -1) + 1;
  const [row] = await d
    .insert(schema.offers)
    .values({ id: newId("off"), businessId: business.id, sku, title: input.title, description: input.description, kind: input.kind, priceAtomic: input.priceAtomic, position })
    .returning();
  return row!;
}
