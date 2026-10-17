import { env, forceMocks } from "../env";
import { announceMock } from "../log";
import { MockRegistrar, makeRegistrar } from "./registrar";
import { MockHosting, makeHosting } from "./hosting";
import { MockTelephony, makeTelephony } from "./telephony";
import { MockReceptionist, makeReceptionist } from "./receptionist";
import { TemplateDrafter, makeDrafter } from "./drafter";
import { LogNotifier, makeNotifier } from "./notifier";
import { MockImager, makeImager } from "./imager";
import { MockRefunder, makeRefunder } from "./refunder";
import type { Adapters } from "./types";

export type { Adapters } from "./types";

type Cache = { adapters?: Adapters; overrides: Partial<Adapters> };
const g = globalThis as unknown as { __awningAdapters?: Cache };
const cache: Cache = (g.__awningAdapters ??= { overrides: {} });

const WHY: Record<keyof Adapters, string> = {
  registrar: "PORKBUN_API_KEY/PORKBUN_SECRET_KEY not set — deterministic availability + snapshot prices",
  hosting: "VERCEL_TOKEN/VERCEL_PROJECT_ID not set — custom domains are not attached",
  telephony: "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set — fictional 555-01xx numbers",
  receptionist: "ELEVENLABS_API_KEY not set — phone answers with the TwiML receptionist",
  drafter: "no ANTHROPIC_API_KEY, OPENROUTER_API_KEY or AI Gateway credentials — deterministic template drafts",
  imager: "no AI Gateway credentials (AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN) — storefronts use their drawn poster art",
  notifier: "Twilio not configured — owner notifications are logged",
  refunder: "treasury key missing or not matching AWNING_TREASURY_ADDRESS — refunds unavailable (never simulated with real payments)",
};

function build(): Adapters {
  const a: Adapters = forceMocks()
    ? {
        registrar: new MockRegistrar(),
        hosting: new MockHosting(),
        telephony: new MockTelephony(),
        receptionist: new MockReceptionist(),
        drafter: new TemplateDrafter(),
        notifier: new LogNotifier(),
        // Even with mocks forced, a real facilitator means real money: never simulate a refund.
        refunder: env.facilitatorUrl() === "mock" ? new MockRefunder() : makeRefunder(),
        imager: new MockImager(),
      }
    : {
        registrar: makeRegistrar(),
        hosting: makeHosting(),
        telephony: makeTelephony(),
        receptionist: makeReceptionist(),
        drafter: makeDrafter(),
        notifier: makeNotifier(),
        // Simulated payments must never trigger real refunds.
        refunder: env.facilitatorUrl() === "mock" ? new MockRefunder() : makeRefunder(),
        imager: makeImager(),
      };
  for (const [k, v] of Object.entries(a) as [keyof Adapters, Adapters[keyof Adapters]][]) {
    if (v.mock) announceMock(k, forceMocks() ? "AWNING_FORCE_MOCKS=1" : WHY[k]);
  }
  return a;
}

/** Process-wide adapters (mock instances keep state, e.g. registered domains). */
export function adapters(): Adapters {
  cache.adapters ??= build();
  return { ...cache.adapters, ...cache.overrides };
}

export function adapterModes(): Record<keyof Adapters, string> {
  const a = adapters();
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.mock ? `mock (${v.name})` : v.name])) as Record<keyof Adapters, string>;
}

/** Tests: replace some adapters; `reset` rebuilds everything from env. */
export function setAdapterOverrides(o: Partial<Adapters>) {
  cache.overrides = { ...o };
}
export function resetAdapters() {
  cache.adapters = undefined;
  cache.overrides = {};
}
