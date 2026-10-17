import { apiError, handler, publicJson } from "@/lib/api";
import { getBusinessBySlug, offersFor } from "@/lib/services/businesses";
import { publicBusinessView } from "@/lib/services/views";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const b = await getBusinessBySlug(slug);
  if (!b) return apiError(404, "business_not_found", `No business ${slug}`);
  return publicJson({ business: publicBusinessView(b, await offersFor(b.id)) });
});
