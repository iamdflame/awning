import { sql } from "drizzle-orm";
import { after } from "next/server";
import { reconcilePayments } from "@/lib/x402/reconcile";
import { adapterModes } from "@/lib/adapters";
import { handler, json } from "@/lib/api";
import { db, dbKind } from "@/lib/db/client";
import { VERSION, env, isProduction } from "@/lib/env";
import { log } from "@/lib/log";
import { treasuryRefundProblem } from "@/lib/adapters/refunder";
import { proReadiness } from "@/lib/services/readiness";
import { facilitator } from "@/lib/x402/facilitator";
import { lastEventAt } from "@/lib/services/events";

export const dynamic = "force-dynamic";

/** Asserts outcomes, not just liveness: DB answers, money config present, last open/order times. */
export const GET = handler(async () => {
  const checks: Record<string, string> = {};
  let ok = true;
  try {
    const d = await db();
    await d.execute(sql`select 1`);
    checks.db = `ok (${dbKind()})`;
  } catch (err) {
    ok = false;
    log.error("health: database check failed", { error: err instanceof Error ? err.message : String(err) });
    checks.db = "error";
  }
  checks.treasury = env.treasuryAddress() ? "ok" : "missing AWNING_TREASURY_ADDRESS";
  if (!env.treasuryAddress()) ok = false;
  checks.pluginKey = env.pluginKey() ? "ok" : "missing AWNING_PLUGIN_KEY";
  if (!env.pluginKey() && isProduction()) ok = false;
  // Refunds: a real treasury key that controls the treasury address (else Pro is not sold).
  checks.refunds = treasuryRefundProblem() ? "unavailable" : "ok";
  const pro = proReadiness();
  checks.pro = pro.available ? (pro.simulated ? "available (simulated payments)" : "available") : `unavailable (${pro.missing.join(", ")})`;
  let facilitatorName = "unknown";
  try {
    const f = facilitator();
    facilitatorName = f.mock ? "mock (no settlement)" : f.name;
  } catch (err) {
    ok = false;
    log.error("health: facilitator misconfigured", { error: err instanceof Error ? err.message : String(err) });
    facilitatorName = "error";
  }
  const dbOk = checks.db?.startsWith("ok") ?? false;
  const [lastOpenAt, lastOrderAt] = dbOk ? await Promise.all([lastEventAt("opened"), lastEventAt("order")]) : [null, null];
  if (dbOk) {
    // Health is polled by monitors: a cheap moment to settle the truth for stale payments.
    try {
      after(() => reconcilePayments({ limit: 10 }).then(() => undefined, (err) => log.error("reconcile after health failed", { error: String(err) })));
    } catch {
      // outside a request scope (tests)
    }
  }
  return json(
    { ok, version: VERSION, lastOpenAt, lastOrderAt, checks, facilitator: facilitatorName, adapters: adapterModes() },
    { status: ok ? 200 : 503, headers: { "access-control-allow-origin": "*" } },
  );
});
