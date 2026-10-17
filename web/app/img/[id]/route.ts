import { imageData } from "@/lib/services/images";

export const dynamic = "force-dynamic";

const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

/** Generated storefront photography. Ids are random and content never changes, so caching is immutable. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = decodeURIComponent(raw).replace(/\.webp$/i, "");
  const etag = `"${id}"`;
  try {
    const img = await imageData(id);
    if (!img) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag, "cache-control": IMMUTABLE } });
    return new Response(new Uint8Array(img.bytes), {
      status: 200,
      headers: {
        "content-type": img.mime,
        "content-length": String(img.bytes.length),
        "cache-control": IMMUTABLE,
        etag,
        "x-content-type-options": "nosniff",
        "access-control-allow-origin": "*",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
}
