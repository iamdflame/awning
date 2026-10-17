import { sql } from "drizzle-orm";
import { adapterModes } from "./adapters";
import { treasuryRefundProblem } from "./adapters/refunder";
import { db, dbKind } from "./db/client";
import { VERSION, env, isProduction } from "./env";
import { log } from "./log";
import { lastEventAt } from "./services/events";
import { proReadiness } from "./services/readiness";
import { facilitator } from "./x402/facilitator";

export type HealthReport = {
  ok: boolean;
  version: string;
  lastOpenAt: string | null;
  lastOrderAt: string | null;
  checks: Record<string, string>;
  facilitator: string;
  adapters: Record<string, string>;
};

/**
 * The body of GET /v1/health (and what /status shows): outcomes, not just liveness.
 * DB answers, money config present, Pro availability, last open/order times. No side effects.
 */
export async function healthReport(): Promise<HealthReport> {
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
  checks.pro = pro.available
    ? `${pro.simulated ? "available (simulated payments)" : "available"}${pro.phone ? "" : ` without phone line (${pro.phoneMissing.join(", ")})`}`
    : `unavailable (${pro.missing.join(", ")})`;
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
  return { ok, version: VERSION, lastOpenAt, lastOrderAt, checks, facilitator: facilitatorName, adapters: adapterModes() };
}
