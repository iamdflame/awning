import { z } from "zod";
import { handler, parseBody, requirePluginKey } from "@/lib/api";
import { openFree } from "@/lib/services/open";

export const dynamic = "force-dynamic";

const schema = z.object({ planId: z.string().trim().min(4).max(64) });

/** Open on the free subdomain: no domain, no phone, no money. Idempotent by planId. */
export const POST = handler(async (req: Request) => {
  const denied = requirePluginKey(req);
  if (denied) return denied;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;
  return openFree(body.data.planId);
});
