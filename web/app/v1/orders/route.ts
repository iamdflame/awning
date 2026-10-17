import { apiError, handler, json, requirePluginKey, verifyOwnerToken } from "@/lib/api";
import { getBusinessBySlug } from "@/lib/services/businesses";
import { ordersForBusiness } from "@/lib/services/orders";

export const dynamic = "force-dynamic";

/** Owner's orders: plugin key + x-awning-owner-token for that business. */
export const GET = handler(async (req: Request) => {
  const denied = requirePluginKey(req);
  if (denied) return denied;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return apiError(400, "invalid_request", "slug query parameter is required");
  const b = await getBusinessBySlug(slug);
  const token = req.headers.get("x-awning-owner-token");
  // Same answer for an unknown business and a wrong token: no existence oracle.
  if (!b || !verifyOwnerToken(token, b)) {
    return apiError(token ? 403 : 401, token ? "forbidden" : "unauthorized", "Missing or invalid x-awning-owner-token for this business");
  }
  return json({ orders: await ordersForBusiness(b.id) });
});
