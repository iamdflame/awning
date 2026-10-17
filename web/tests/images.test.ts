import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayImager, MockImager, parseImageResponse, type GeneratedImage, type Imager } from "@/lib/adapters/imager";
import { ProviderError } from "@/lib/adapters/http";
import { photoPrompts, colorWords } from "@/lib/plan/photos";
import { backfillBusinessImages, generateBusinessImages, imagesFor, scheduleBusinessImages } from "@/lib/services/images";
import { getBusinessBySlug } from "@/lib/services/businesses";
import { GET as imgGET } from "@/app/img/[id]/route";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { createPlan, freshWorld, rows } from "./helpers";

// Capture after() callbacks so a test can run them "after the response".
const { scheduled } = vi.hoisted(() => ({ scheduled: [] as (() => unknown)[] }));
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return { ...mod, after: (fn: () => unknown) => void scheduled.push(fn) };
});

async function png(w = 64, h = 48): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 60, b: 30 } } }).png().toBuffer();
}

class FakeImager implements Imager {
  readonly name = "fake";
  readonly mock = false;
  prompts: string[] = [];
  constructor(private readonly fail = false) {}
  async generate(prompt: string): Promise<GeneratedImage> {
    this.prompts.push(prompt);
    if (this.fail) throw new Error("provider down");
    return { bytes: await png(), model: "test/fake-model" };
  }
}

function img(id: string, headers: Record<string, string> = {}) {
  return imgGET(new Request(`https://awning.sh/img/${id}`, { headers }), { params: Promise.resolve({ id }) });
}

afterEach(() => {
  delete process.env.AWNING_IMAGE_MAX_PER_HOUR;
  vi.unstubAllGlobals();
});

describe("imager", () => {
  it("the mock makes no image, so nothing is stored and the storefront keeps its drawn art", async () => {
    expect(await new MockImager().generate()).toBeNull();
    await freshWorld(); // AWNING_FORCE_MOCKS=1 → MockImager
    const p = await createPlan();
    scheduleBusinessImages(p.business.slug);
    expect(await generateBusinessImages(p.business.slug)).toEqual({ created: [], skipped: "mock" });
    expect(await rows("business_images")).toHaveLength(0);
  });

  it("POST /v1/plan schedules generation with after(), outside the plan response", async () => {
    await freshWorld({ imager: new FakeImager() });
    scheduled.length = 0;
    const p = await createPlan();
    expect(scheduled).toHaveLength(1);
    expect(await rows("business_images")).toHaveLength(0); // nothing generated during the request
    await scheduled[0]!();
    const b = (await getBusinessBySlug(p.business.slug))!;
    expect(Object.keys(await imagesFor(b.id)).sort()).toEqual(["detail", "hero"]);
  });

  it("stores a hero and a detail photo as 1024x768 WebP, once per role", async () => {
    const imager = new FakeImager();
    await freshWorld({ imager });
    const p = await createPlan();
    const r = await generateBusinessImages(p.business.slug);
    expect(r.created.sort()).toEqual(["detail", "hero"]);
    expect(imager.prompts).toHaveLength(2);
    for (const prompt of imager.prompts) {
      expect(prompt).toMatch(/no text anywhere/i);
      expect(prompt).toMatch(/no people's faces/i);
      expect(prompt).not.toContain("Accra"); // never the city: no stereotypes
    }
    const b = (await getBusinessBySlug(p.business.slug))!;
    const imgs = await imagesFor(b.id);
    expect(imgs.hero?.width).toBe(1024);
    expect(imgs.hero?.height).toBe(768);
    expect(imgs.hero?.url).toMatch(/^\/img\/img_/);
    // A second run (e.g. a retried plan) generates nothing new.
    expect(await generateBusinessImages(p.business.slug)).toEqual({ created: [], skipped: "exists" });
    expect(imager.prompts).toHaveLength(2);
  });

  it("respects AWNING_IMAGE_MAX_PER_HOUR and skips over the cap", async () => {
    process.env.AWNING_IMAGE_MAX_PER_HOUR = "1";
    const imager = new FakeImager();
    await freshWorld({ imager });
    const p = await createPlan();
    expect(await generateBusinessImages(p.business.slug)).toEqual({ created: [], skipped: "cap" });
    expect(imager.prompts).toHaveLength(0);
  });

  it("never throws when the provider fails, and skips suspended businesses", async () => {
    await freshWorld({ imager: new FakeImager(true) });
    const p = await createPlan();
    expect(await generateBusinessImages(p.business.slug)).toEqual({ created: [] });
    const d = await db();
    await d.update(schema.businesses).set({ status: "suspended" }).where(eq(schema.businesses.slug, p.business.slug));
    expect((await generateBusinessImages(p.business.slug)).skipped).toBe("suspended");
  });

  it("generates one photo at a time and retries once when the provider rate-limits", async () => {
    let calls = 0;
    const limited: Imager = {
      name: "limited",
      mock: false,
      async generate() {
        calls++;
        if (calls === 1) throw new ProviderError("ai-gateway", 'image generation failed (429): {"error":{"message":"Rate limit exceeded. Retry after 0s."}}', 429);
        return { bytes: await png(), model: "test/fake-model" };
      },
    };
    await freshWorld({ imager: limited });
    const p = await createPlan();
    expect((await generateBusinessImages(p.business.slug)).created).toEqual(["hero", "detail"]);
    expect(calls).toBe(3);
  });

  it("a storefront missing photos asks for them again, at most once per 10 minutes", async () => {
    await freshWorld({ imager: new FakeImager() });
    const p = await createPlan(); // the plan itself scheduled generation
    scheduled.length = 0;
    backfillBusinessImages(p.business.slug, true);
    expect(scheduled).toHaveLength(0); // just attempted by the plan
    backfillBusinessImages("some-other-shop", true);
    expect(scheduled).toHaveLength(1);
    backfillBusinessImages("some-other-shop", true);
    backfillBusinessImages("complete-shop", false);
    expect(scheduled).toHaveLength(1);
  });

  it("parses the gateway's images response and sends the documented request", async () => {
    const b64 = (await png()).toString("base64");
    expect(parseImageResponse({ data: [{ b64_json: b64 }] }).subarray(1, 4).toString()).toBe("PNG");
    expect(() => parseImageResponse({ data: [] })).toThrow(ProviderError);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await new GatewayImager("bfl/flux-2-klein-4b", async () => "tok_test").generate("a coffee roastery");
    expect(out.model).toBe("bfl/flux-2-klein-4b");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai-gateway.vercel.sh/v1/images/generations");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok_test");
    expect(JSON.parse(String(init.body))).toEqual({ model: "bfl/flux-2-klein-4b", prompt: "a coffee roastery", n: 1, size: "1024x768" });
  });

  it("writes prompts from the category and the palette", () => {
    const pr = photoPrompts({ name: "Spoke & Chain", category: "Home Services", tagline: "Bike repair", palette: { primary: "#0B6E4F", accent: "#F2C14E", ink: "#0A2219", paper: "#F5F8F4" } });
    expect(pr.hero).toMatch(/bicycle workshop/);
    expect(pr.detail).toMatch(/bicycle chain/);
    expect(pr.hero).toMatch(/green/);
    expect(colorWords("#6B3E26")).toBe("warm brown");
  });
});

describe("/img/:id", () => {
  it("serves WebP with immutable caching, 304 on a matching etag, 404 otherwise", async () => {
    await freshWorld({ imager: new FakeImager() });
    const p = await createPlan();
    await generateBusinessImages(p.business.slug);
    const b = (await getBusinessBySlug(p.business.slug))!;
    const hero = (await imagesFor(b.id)).hero!;

    const res = await img(hero.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("immutable");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 4).toString()).toBe("RIFF");
    expect(body.subarray(8, 12).toString()).toBe("WEBP");
    expect(Number(res.headers.get("content-length"))).toBe(body.length);

    expect((await img(`${hero.id}.webp`)).status).toBe(200);
    const again = await img(hero.id, { "if-none-match": res.headers.get("etag")! });
    expect(again.status).toBe(304);

    expect((await img("img_doesnotexist000")).status).toBe(404);
    expect((await img("../etc/passwd")).status).toBe(404);

    // A business under review stops serving its photos.
    const d = await db();
    await d.update(schema.businesses).set({ status: "suspended" }).where(eq(schema.businesses.id, b.id));
    expect((await img(hero.id)).status).toBe(404);
  });
});
