import { sql } from "drizzle-orm";
import { adapterModes } from "@/lib/adapters";
import { handler, json } from "@/lib/api";
import { db, dbKind } from "@/lib/db/client";
import { VERSION, env } from "@/lib/env";
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
    checks.db = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  checks.treasury = env.treasuryAddress() ? "ok" : "missing AWNING_TREASURY_ADDRESS";
  if (!env.treasuryAddress()) ok = false;
  checks.pluginKey = env.pluginKey() ? "ok" : "missing AWNING_PLUGIN_KEY";
  let facilitatorName = "unknown";
  try {
    const f = facilitator();
    facilitatorName = f.mock ? "mock (no settlement)" : f.name;
  } catch (err) {
    ok = false;
    facilitatorName = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  const dbOk = checks.db?.startsWith("ok") ?? false;
  const [lastOpenAt, lastOrderAt] = dbOk ? await Promise.all([lastEventAt("opened"), lastEventAt("order")]) : [null, null];
  return json(
    { ok, version: VERSION, lastOpenAt, lastOrderAt, checks, facilitator: facilitatorName, adapters: adapterModes() },
    { status: ok ? 200 : 503, headers: { "access-control-allow-origin": "*" } },
  );
});
