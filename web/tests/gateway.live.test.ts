import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GatewayDrafter, finalizeDraft } from "@/lib/adapters/drafter";
import { gatewayEnv } from "@/lib/adapters/gateway";

/**
 * Real AI Gateway drafts (network, uses credit). Skipped unless AWNING_LIVE_GATEWAY=1:
 *   AWNING_LIVE_GATEWAY=1 npx vitest run tests/gateway.live.test.ts
 * Credentials: AI_GATEWAY_API_KEY, or VERCEL_OIDC_TOKEN from web/.env.local (`vercel env pull`).
 */
const LIVE = process.env.AWNING_LIVE_GATEWAY === "1";

const SENTENCES = [
  "Start a business: Ridge Roast, small-batch coffee from Accra. Ship bags and sell a $5 tasting.",
  "Open a bike repair shop in Austin called Spoke & Chain. $45 tune-ups, flats fixed while you wait.",
  "Start Barro, a ceramics studio in Lisbon. Sell glazed bowls and a Saturday wheel class.",
];

describe.skipIf(!LIVE)("AI Gateway drafter (live)", () => {
  it("drafts three businesses inside the plan's LLM budget", async () => {
    const local = path.join(process.cwd(), ".env.local");
    if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN && existsSync(local)) process.loadEnvFile(local);
    const drafter = new GatewayDrafter(gatewayEnv.llmModel());
    const times: number[] = [];
    for (const sentence of SENTENCES) {
      const t0 = performance.now();
      const raw = await drafter.draft({ sentence }, AbortSignal.timeout(15000));
      const ms = Math.round(performance.now() - t0);
      times.push(ms);
      const d = finalizeDraft(raw, { sentence });
      console.log(`[live] ${ms} ms  ${d.name} · ${d.category} · ${d.city ?? "-"} · ${d.offers.map((o) => `${o.title} $${o.priceUsd}`).join(" | ")} · ${JSON.stringify(d.palette)}`);
      expect(d.offers.length).toBeGreaterThanOrEqual(3);
    }
    console.log(`[live] model ${gatewayEnv.llmModel()} latency ms: ${times.join(", ")} (median ${[...times].sort((a, b) => a - b)[1]})`);
  }, 60000);
});
