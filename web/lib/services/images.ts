import { after } from "next/server";
import { eq, gt, sql } from "drizzle-orm";
import { adapters } from "../adapters";
import { gatewayEnv } from "../adapters/gateway";
import { db, schema } from "../db/client";
import { businessImages, type ImageRole } from "../db/images";
import { newId } from "../ids";
import { errorMessage, log } from "../log";
import { photoPrompts } from "../plan/photos";
import { getBusinessBySlug, offersFor } from "./businesses";

export const IMAGE_ROLES: ImageRole[] = ["hero", "detail"];
export const IMAGE_WIDTH = 1024;
export const IMAGE_HEIGHT = 768;
const ID = /^img_[0-9a-z]{8,40}$/;

export type StoreImage = { id: string; role: ImageRole; width: number; height: number; url: string };

export function imageUrl(id: string): string {
  return `/img/${id}`;
}

/** Generated photos of one business, by role (metadata only). */
export async function imagesFor(businessId: string): Promise<Partial<Record<ImageRole, StoreImage>>> {
  const d = await db();
  const rows = await d
    .select({ id: businessImages.id, role: businessImages.role, width: businessImages.width, height: businessImages.height })
    .from(businessImages)
    .where(eq(businessImages.businessId, businessId));
  const out: Partial<Record<ImageRole, StoreImage>> = {};
  for (const r of rows) out[r.role] = { ...r, url: imageUrl(r.id) };
  return out;
}

/** The encoded bytes for `/img/:id`; null for unknown ids and for businesses under review. */
export async function imageData(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!ID.test(id)) return null;
  const d = await db();
  const [row] = await d
    .select({ dataB64: businessImages.dataB64, mime: businessImages.mime, businessId: businessImages.businessId })
    .from(businessImages)
    .where(eq(businessImages.id, id))
    .limit(1);
  if (!row) return null;
  const [b] = await d.select({ status: schema.businesses.status }).from(schema.businesses).where(eq(schema.businesses.id, row.businessId)).limit(1);
  if (b?.status === "suspended") return null;
  return { bytes: Buffer.from(row.dataB64, "base64"), mime: row.mime };
}

const g = globalThis as unknown as { __awningImagesInflight?: number };

async function generatedInLastHour(): Promise<number> {
  const d = await db();
  const [row] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(businessImages)
    .where(gt(businessImages.createdAt, new Date(Date.now() - 3600_000)));
  return Number(row?.n ?? 0);
}

/** Resize to the storefront's 4:3 frame and encode as WebP. */
export async function encodeWebp(bytes: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(bytes).rotate().resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover", position: "attention" }).webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export type GenerateResult = { created: ImageRole[]; skipped?: "mock" | "missing" | "suspended" | "exists" | "cap" };

/**
 * Generates a business's hero and detail photos (only the missing ones), within
 * the deployment-wide hourly cap. Never throws: failures are logged and the
 * storefront keeps its drawn art.
 */
export async function generateBusinessImages(slug: string): Promise<GenerateResult> {
  const imager = adapters().imager;
  if (imager.mock) return { created: [], skipped: "mock" };
  const business = await getBusinessBySlug(slug);
  if (!business) return { created: [], skipped: "missing" };
  if (business.status === "suspended") return { created: [], skipped: "suspended" };
  const have = await imagesFor(business.id);
  const roles = IMAGE_ROLES.filter((r) => !have[r]);
  if (!roles.length) return { created: [], skipped: "exists" };

  const cap = gatewayEnv.imageMaxPerHour();
  const inflight = g.__awningImagesInflight ?? 0;
  const used = (await generatedInLastHour()) + inflight;
  if (used + roles.length > cap) {
    log.warn("image generation skipped: hourly cap reached", { slug, cap, used });
    return { created: [], skipped: "cap" };
  }
  g.__awningImagesInflight = inflight + roles.length;
  try {
    const prompts = photoPrompts({ ...business, offers: await offersFor(business.id) });
    const d = await db();
    const created: ImageRole[] = [];
    // One at a time: the gateway's image models are rate limited per minute.
    for (const role of roles) {
      try {
        const t0 = Date.now();
        const img = await withRateLimitRetry(() => imager.generate(prompts[role]));
        if (!img) continue;
        const webp = await encodeWebp(img.bytes);
        await d
          .insert(businessImages)
          .values({
            id: newId("img"),
            businessId: business.id,
            role,
            prompt: prompts[role],
            model: img.model,
            mime: "image/webp",
            width: webp.width,
            height: webp.height,
            bytes: webp.data.length,
            dataB64: webp.data.toString("base64"),
          })
          .onConflictDoNothing();
        created.push(role);
        log.info("image generated", { slug, role, ms: Date.now() - t0, kb: Math.round(webp.data.length / 1024) });
      } catch (err) {
        log.warn("image generation failed", { slug, role, error: errorMessage(err) });
      }
    }
    return { created };
  } finally {
    g.__awningImagesInflight = Math.max(0, (g.__awningImagesInflight ?? 0) - roles.length);
  }
}

/** Retries once when the provider says how long to wait (HTTP 429, "Retry after Ns"), up to 20 s. */
async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = errorMessage(err);
    const wait = /\(429\)/.test(msg) ? Number(/retry after (\d+)\s*s/i.exec(msg)?.[1] ?? 10) : NaN;
    if (!Number.isFinite(wait) || wait > 20) throw err;
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
    return fn();
  }
}

/**
 * Runs photo generation after the response has been sent (`after()`), so it never
 * counts against the plan's latency budget. With the mock imager, or outside a
 * request (scripts), it does nothing.
 */
export function scheduleBusinessImages(slug: string): void {
  if (adapters().imager.mock) return;
  lastAttempt.set(slug, Date.now());
  try {
    after(() =>
      generateBusinessImages(slug).catch((err) => {
        log.warn("image generation failed", { slug, error: errorMessage(err) });
      }),
    );
  } catch (err) {
    log.warn("image generation not scheduled", { slug, error: errorMessage(err) });
  }
}

const lastAttempt: Map<string, number> = ((globalThis as unknown as { __awningImageAttempts?: Map<string, number> }).__awningImageAttempts ??= new Map());

/**
 * A storefront without its photos (a rate limit, an outage, a business opened
 * before photography existed) asks for them again after it renders, at most
 * once every 10 minutes per business; the hourly cap still applies.
 */
export function backfillBusinessImages(slug: string, missing: boolean): void {
  if (!missing || adapters().imager.mock) return;
  const last = lastAttempt.get(slug) ?? 0;
  if (Date.now() - last < 10 * 60_000) return;
  scheduleBusinessImages(slug);
}
