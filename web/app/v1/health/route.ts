import { after } from "next/server";
import { reconcilePayments } from "@/lib/x402/reconcile";
import { handler, json } from "@/lib/api";
import { healthReport } from "@/lib/health";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Asserts outcomes, not just liveness: DB answers, money config present, last open/order times. */
export const GET = handler(async () => {
  const report = await healthReport();
  if (report.checks.db?.startsWith("ok")) {
    // Health is polled by monitors: a cheap moment to settle the truth for stale payments.
    try {
      after(() => reconcilePayments({ limit: 10 }).then(() => undefined, (err) => log.error("reconcile after health failed", { error: String(err) })));
    } catch {
      // outside a request scope (tests)
    }
  }
  return json(report, { status: report.ok ? 200 : 503, headers: { "access-control-allow-origin": "*" } });
});
