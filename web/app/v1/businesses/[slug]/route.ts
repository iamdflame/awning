import { apiError, handler, publicJson } from "@/lib/api";
import { getBusinessBySlug, offersFor } from "@/lib/services/businesses";
import { publicBusinessView } from "@/lib/services/views";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const b = await getBusinessBySlug(slug);
  if (!b) return apiError(404, "business_not_found", `No business ${slug}`);
  if (b.status === "suspended") return apiError(410, "business_unavailable", `${b.name} is unavailable while Awning reviews a report.`);
  return publicJson({ business: publicBusinessView(b, await offersFor(b.id)) });
});
