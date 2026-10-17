import type { HealthReport } from "./health";

/**
 * GET /v1/health in plain words, for /status. Pure: everything here is derived from
 * the health report itself, so the page can never be greener than the API.
 *
 *   ok    working, for real
 *   warn  working with a caveat (simulated payments, Pro without its phone line)
 *   down  reported unavailable, missing or failing
 *   off   a provider that is not configured (a stand-in runs, nothing real happens)
 */
export type Tone = "ok" | "warn" | "down" | "off";

export type StatusRow = { key: string; label: string; tone: Tone; state: string; detail: string };

export type StatusView = {
  tone: Exclude<Tone, "off">;
  sign: string;
  /** A paper note tied under the sign, when the sign alone would say too little. */
  note: string | null;
  headline: string;
  summary: string;
  core: StatusRow[];
  pro: StatusRow & { includes: string[] };
  providers: StatusRow[];
  lastOpenAt: string | null;
  lastOrderAt: string | null;
  version: string;
};

const DB_KIND: Record<string, string> = {
  postgres: "Postgres",
  pglite: "PGlite on this machine",
  "pglite-memory": "an in-memory test database",
};

const PRO_PART: Record<string, string> = {
  registrar: "domain registration",
  hosting: "custom-domain hosting",
  refunder: "refunds",
  telephony: "phone numbers",
  receptionist: "the AI receptionist",
};

type Provider = { label: string; real: string; off: string };
const PROVIDERS: Record<string, Provider> = {
  drafter: { label: "Business drafts", real: "An AI model drafts each business", off: "Drafts come from templates, not an AI model" },
  registrar: { label: "Domain registration", real: "Real domain availability, prices and registration", off: "Domain prices are snapshots and nothing is registered" },
  hosting: { label: "Custom domains", real: "Custom domains are attached to their storefronts", off: "Custom domains are not attached" },
  telephony: { label: "Phone numbers", real: "Real phone numbers are bought for Pro businesses", off: "No real numbers are bought" },
  receptionist: { label: "AI receptionist", real: "An AI voice agent answers each business's calls", off: "No AI voice agent; calls get a spoken greeting" },
  imager: { label: "Storefront photos", real: "Each storefront gets generated photos", off: "Storefronts use their drawn poster art" },
  notifier: { label: "Owner text messages", real: "Owners get a text message for each order", off: "Order notifications are logged, not sent" },
  refunder: { label: "Refund wallet", real: "Refunds are sent in USDC from the treasury", off: "No refund wallet; refunds are unavailable" },
};

const PROVIDER_NAME: Record<string, string> = {
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  "ai-gateway": "Vercel AI Gateway",
  porkbun: "Porkbun",
  vercel: "Vercel",
  twilio: "Twilio",
  elevenlabs: "ElevenLabs",
  "twilio-sms": "Twilio",
  "viem-usdc": "USDC on Base",
};

/** "unavailable (registrar, hosting)" → ["registrar", "hosting"] */
function listIn(s: string, after: string): string[] {
  const i = s.indexOf(after);
  if (i < 0) return [];
  const m = /\(([^)]*)\)/.exec(s.slice(i + after.length));
  return (m?.[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

function words(list: string[]): string {
  const named = list.map((k) => PRO_PART[k] ?? k);
  return named.length <= 1 ? (named[0] ?? "") : `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`;
}

export function describeHealth(h: HealthReport): StatusView {
  const c = h.checks;
  const dbOk = c.db?.startsWith("ok") ?? false;
  const kind = /^ok \((.+)\)$/.exec(c.db ?? "")?.[1] ?? "";
  const simulated = h.facilitator.startsWith("mock");
  const payLive = !simulated && /^https?:\/\//.test(h.facilitator);
  let facilitatorHost = h.facilitator;
  try {
    facilitatorHost = new URL(h.facilitator).host;
  } catch {
    // not a URL (mock, error, unknown)
  }

  const core: StatusRow[] = [
    dbOk
      ? { key: "db", label: "Database", tone: "ok", state: "Answering", detail: `Businesses, offers and orders are stored in ${DB_KIND[kind] ?? kind}.` }
      : { key: "db", label: "Database", tone: "down", state: "Not answering", detail: "Shops can't open and orders can't be recorded until it answers again." },
    payLive
      ? { key: "payments", label: "Payments", tone: "ok", state: "Live", detail: `x402 checkouts in USDC on Base, verified and settled through ${facilitatorHost}.` }
      : simulated
        ? { key: "payments", label: "Payments", tone: "warn", state: "Simulated", detail: "This server runs the test facilitator: payments are checked but never settle, and no money moves." }
        : { key: "payments", label: "Payments", tone: "down", state: "Unavailable", detail: "The payment facilitator is not configured correctly, so checkouts can't settle." },
    c.refunds === "ok"
      ? { key: "refunds", label: "Refunds", tone: "ok", state: "Available", detail: "If a paid opening fails after the payment settled, the same amount goes back from the treasury." }
      : { key: "refunds", label: "Refunds", tone: "down", state: "Unavailable", detail: "Pro is not sold without refunds. Free openings and sales don't depend on them." },
    c.treasury === "ok"
      ? { key: "treasury", label: "Treasury wallet", tone: "ok", state: "Set", detail: "Pro openings pay Awning's treasury. Sales never touch it: they go to each owner's wallet." }
      : { key: "treasury", label: "Treasury wallet", tone: "down", state: "Missing", detail: "Pro openings can't be paid until the treasury address is set." },
    c.pluginKey === "ok"
      ? { key: "plugin", label: "PayBox plugin access", tone: "ok", state: "Set", detail: "The plugin's plan, open and owner calls are accepted." }
      : { key: "plugin", label: "PayBox plugin access", tone: "down", state: "Missing", detail: "The plugin's plan, open and owner calls are refused until the plugin key is set." },
  ];

  const proText = c.pro ?? "unavailable";
  const proAvailable = proText.startsWith("available");
  const proPhone = proAvailable && !proText.includes("without phone line");
  const proSimulated = proText.includes("(simulated payments)");
  const includes = ["Everything in Free", "A custom domain, registered for its first year", "The storefront hosted on that domain"];
  if (proPhone) includes.push("A phone number with an AI receptionist for the first month");
  const pro: StatusView["pro"] = !proAvailable
    ? {
        key: "pro",
        label: "Pro",
        tone: "down",
        state: "Not on sale",
        detail: `Pro is sold only when every part of it is real. Missing: ${words(listIn(proText, "unavailable")) || "a required provider"}. Free openings still work.`,
        includes,
      }
    : {
        key: "pro",
        label: "Pro",
        tone: proSimulated ? "warn" : "ok",
        state: proSimulated ? "On sale, test payments" : "On sale",
        detail: proPhone
          ? "Domain, hosting and the phone line are all real, so Pro includes all three."
          : `Sold without the phone line: ${words(listIn(proText, "without phone line"))} ${listIn(proText, "without phone line").length > 1 ? "are" : "is"} not configured. The line is added when telephony is real.`,
        includes,
      };

  const providers: StatusRow[] = Object.entries(PROVIDERS).map(([key, p]) => {
    const mode = h.adapters[key] ?? "missing";
    const mock = mode.startsWith("mock") || mode === "missing";
    if (!mock) return { key, label: p.label, tone: "ok", state: PROVIDER_NAME[mode] ?? mode, detail: p.real };
    if (key === "refunder" && mode.includes("mock-refunder"))
      return { key, label: p.label, tone: "warn", state: "Simulated", detail: "Refunds are simulated because payments are simulated." };
    return { key, label: p.label, tone: "off", state: "Not configured", detail: p.off };
  });

  const downs = core.filter((r) => r.tone === "down");
  let tone: StatusView["tone"];
  let sign: string;
  let note: string | null = null;
  let headline: string;
  let summary: string;
  if (!dbOk) {
    tone = "down";
    sign = "CLOSED";
    headline = "Closed right now.";
    summary = "The database isn't answering, so shops can't open and orders can't be recorded. No payment settles for work that didn't happen.";
  } else if (!h.ok || core.some((r) => r.key !== "refunds" && r.tone === "down")) {
    tone = "down";
    sign = "CLOSED";
    note = "Back soon";
    headline = "Partly closed.";
    summary = `${downs.map((r) => r.label).join(", ")} ${downs.length > 1 ? "need" : "needs"} attention. Each line below says what that stops.`;
  } else if (simulated) {
    tone = "warn";
    sign = "TEST";
    note = "No money moves";
    headline = "Open in test mode.";
    summary = "This server simulates payments: nothing settles and no money moves. Everything else below is what it really runs.";
  } else if (!proAvailable || c.refunds !== "ok") {
    tone = "warn";
    sign = "OPEN";
    note = "Pro paused";
    headline = "Open. Pro is paused.";
    summary = "Free openings, storefronts and sales work, paid straight to owners' wallets. Pro goes back on sale when every part of it is real.";
  } else {
    tone = "ok";
    sign = "OPEN";
    headline = "Open for business.";
    summary = `The database answers, checkouts settle in USDC on Base, refunds are ready and Pro is on sale${proPhone ? "" : " (for now without the phone line)"}.`;
  }

  return { tone, sign, note, headline, summary, core, pro, providers, lastOpenAt: h.lastOpenAt, lastOrderAt: h.lastOrderAt, version: h.version };
}
