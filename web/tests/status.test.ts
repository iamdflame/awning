import { beforeAll, describe, expect, it } from "vitest";
import { GET as healthGET } from "@/app/v1/health/route";
import { healthReport, type HealthReport } from "@/lib/health";
import { describeHealth, type StatusView } from "@/lib/status";
import { freshWorld, readJson } from "./helpers";

const REAL_ADAPTERS = {
  registrar: "porkbun",
  hosting: "vercel",
  telephony: "twilio",
  receptionist: "elevenlabs",
  drafter: "openrouter",
  notifier: "twilio-sms",
  refunder: "viem-usdc",
  imager: "ai-gateway",
};

function report(over: Partial<HealthReport> & { checks?: Partial<HealthReport["checks"]> } = {}): HealthReport {
  return {
    ok: true,
    version: "1.0.0",
    lastOpenAt: "2026-10-17T05:39:00.000Z",
    lastOrderAt: null,
    facilitator: "https://facilitator.payai.network",
    ...over,
    checks: { db: "ok (postgres)", treasury: "ok", pluginKey: "ok", refunds: "ok", pro: "available", ...over.checks } as Record<string, string>,
    adapters: { ...REAL_ADAPTERS, ...over.adapters },
  };
}

const rows = (v: StatusView) => [...v.core, v.pro, ...v.providers];
const row = (v: StatusView, key: string) => rows(v).find((r) => r.key === key)!;

describe("/status describes /v1/health honestly", () => {
  it("everything real: open, all green", () => {
    const v = describeHealth(report());
    expect(v.tone).toBe("ok");
    expect(v.sign).toBe("OPEN");
    expect(rows(v).every((r) => r.tone === "ok")).toBe(true);
    expect(v.pro.includes.join(" ")).toMatch(/phone number with an AI receptionist/);
  });

  it("Pro without a phone provider: on sale, but the phone line is never shown as included", () => {
    const v = describeHealth(
      report({ checks: { pro: "available without phone line (telephony, receptionist)" }, adapters: { telephony: "mock (mock-telephony)", receptionist: "mock (mock-receptionist)" } as never }),
    );
    expect(v.tone).toBe("ok");
    expect(v.pro.tone).toBe("ok");
    expect(v.pro.includes.join(" ")).not.toMatch(/phone/i);
    expect(v.pro.detail).toMatch(/without the phone line: phone numbers and the AI receptionist are not configured/);
    expect(row(v, "telephony").tone).toBe("off");
    expect(row(v, "receptionist").state).toBe("Not configured");
  });

  it("refunds or Pro unavailable: never green, and the page says Pro is paused", () => {
    const v = describeHealth(
      report({ checks: { refunds: "unavailable", pro: "unavailable (registrar, hosting, refunder)" }, adapters: { refunder: "mock (unavailable)", registrar: "mock (mock-registrar)", hosting: "mock (mock-hosting)" } as never }),
    );
    expect(v.tone).toBe("warn");
    expect(v.headline).toMatch(/Pro is paused/);
    expect(row(v, "refunds").tone).toBe("down");
    expect(v.pro.tone).toBe("down");
    expect(v.pro.detail).toMatch(/domain registration, custom-domain hosting and refunds/);
    expect(row(v, "refunder").tone).toBe("off");
    expect(row(v, "registrar").tone).toBe("off");
  });

  it("database down: closed", () => {
    const v = describeHealth(report({ ok: false, lastOpenAt: null, checks: { db: "error" } }));
    expect(v.tone).toBe("down");
    expect(v.sign).toBe("CLOSED");
    expect(row(v, "db").tone).toBe("down");
  });

  it("simulated payments: test mode, payments amber, not green", () => {
    const v = describeHealth(report({ facilitator: "mock (no settlement)", checks: { pro: "available (simulated payments)" }, adapters: { refunder: "mock (mock-refunder)" } as never }));
    expect(v.tone).toBe("warn");
    expect(v.sign).toBe("TEST");
    expect(row(v, "payments").tone).toBe("warn");
    expect(v.pro.tone).toBe("warn");
    expect(row(v, "refunder").tone).toBe("warn");
  });

  it("facilitator error, missing treasury or plugin key: partly closed, each row down", () => {
    const v = describeHealth(report({ ok: false, facilitator: "error", checks: { treasury: "missing AWNING_TREASURY_ADDRESS", pluginKey: "missing AWNING_PLUGIN_KEY" } }));
    expect(v.tone).toBe("down");
    for (const k of ["payments", "treasury", "plugin"]) expect(row(v, k).tone).toBe("down");
  });

  it("no check that isn't ok is ever shown green", () => {
    const variants: HealthReport[] = [
      report({ checks: { refunds: "unavailable" } }),
      report({ checks: { pro: "unavailable (refunder)" } }),
      report({ checks: { db: "error" }, ok: false }),
      report({ checks: { treasury: "missing AWNING_TREASURY_ADDRESS" }, ok: false }),
      report({ checks: { pluginKey: "missing AWNING_PLUGIN_KEY" } }),
      report({ facilitator: "unknown" }),
    ];
    const keyOf: Record<string, string> = { db: "db", refunds: "refunds", pro: "pro", treasury: "treasury", pluginKey: "plugin" };
    for (const h of variants) {
      const v = describeHealth(h);
      for (const [check, value] of Object.entries(h.checks)) {
        if (!value.startsWith("ok") && !value.startsWith("available")) expect(row(v, keyOf[check]!).tone, `${check}=${value}`).not.toBe("ok");
      }
      if (!h.facilitator.startsWith("http")) expect(row(v, "payments").tone).not.toBe("ok");
      for (const [k, mode] of Object.entries(h.adapters)) if (mode.startsWith("mock")) expect(row(v, k).tone).not.toBe("ok");
    }
  });
});

describe("healthReport() is exactly what GET /v1/health returns", () => {
  beforeAll(async () => {
    await freshWorld();
  });

  it("same body, and the status page sees the test server as test mode", async () => {
    const res = await healthGET();
    const body = await readJson(res);
    const direct = await healthReport();
    expect(body).toEqual(JSON.parse(JSON.stringify(direct)));
    expect(Object.keys(body)).toEqual(["ok", "version", "lastOpenAt", "lastOrderAt", "checks", "facilitator", "adapters"]);
    const v = describeHealth(direct);
    expect(row(v, "payments").tone).toBe("warn");
    expect(row(v, "db").tone).toBe("ok");
  });
});
