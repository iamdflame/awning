import { timingSafeEqual } from "node:crypto";
import { apiError, handler, json } from "@/lib/api";
import { reconcilePayments } from "@/lib/x402/reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Settles the truth for payments a request left unfinished (Vercel cron and the scheduled GitHub workflow). */
export const GET = handler(async (req: Request) => {
  if (!process.env.CRON_SECRET) return apiError(503, "misconfigured", "CRON_SECRET is not configured");
  if (!authorized(req)) return apiError(401, "unauthorized", "Missing or invalid cron authorization");
  const outcomes = await reconcilePayments();
  return json({ reconciled: outcomes.length, outcomes });
});
