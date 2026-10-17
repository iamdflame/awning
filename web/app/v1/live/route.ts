import { handler, publicJson } from "@/lib/api";
import { recentEvents } from "@/lib/services/events";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  return publicJson({ events: await recentEvents(Number.isFinite(limit) ? limit : 50) });
});
