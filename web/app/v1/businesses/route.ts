import { handler, publicJson } from "@/lib/api";
import { listLiveBusinesses, offersForMany } from "@/lib/services/businesses";
import { directoryEntryView } from "@/lib/services/views";

export const dynamic = "force-dynamic";

/** Public directory of live businesses (what any PayBox agent can buy from). */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.slice(0, 120) ?? undefined;
  const category = url.searchParams.get("category")?.slice(0, 60) ?? undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 20;
  const rows = await listLiveBusinesses({ q, category, limit });
  const offers = await offersForMany(rows.map((r) => r.id));
  return publicJson({ businesses: rows.map((b) => directoryEntryView(b, offers.get(b.id) ?? [])) });
});
