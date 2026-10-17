import { adapters } from "../adapters";
import { facilitator } from "../x402/facilitator";

// What Pro cannot be sold without: the domain, its hosting, and a refunder (a paid open that
// fails after settlement must be able to give the money back).
const PRO_CORE = ["registrar", "hosting", "refunder"] as const;
// The phone line and its AI receptionist are part of Pro only when both providers are real.
const PRO_PHONE = ["telephony", "receptionist"] as const;

export type ProReadiness = {
  /** Pro can be sold right now. */
  available: boolean;
  /** Core provider adapters running as mocks (Pro is unavailable while any is missing). */
  missing: string[];
  /** Pro includes a phone line with an AI receptionist. */
  phone: boolean;
  /** Phone providers running as mocks (Pro is sold without a phone line while any is missing). */
  phoneMissing: string[];
  /** Payments are simulated (mock facilitator): mocks are fine because no money moves. */
  simulated: boolean;
};

/**
 * Real money never buys simulated provisioning: with a real facilitator, Pro
 * is only offered when the registrar, hosting and refunder are real, and it
 * includes a phone line only when telephony and the receptionist are real too.
 * With the mock facilitator (dev/test) mocks are fine and the phone is included.
 */
export function proReadiness(): ProReadiness {
  const a = adapters();
  let simulated = false;
  try {
    simulated = facilitator().mock;
  } catch {
    simulated = false;
  }
  const missing = PRO_CORE.filter((k) => a[k].mock);
  const phoneMissing = PRO_PHONE.filter((k) => a[k].mock);
  return {
    available: simulated || missing.length === 0,
    missing: simulated ? [] : [...missing],
    phone: simulated || phoneMissing.length === 0,
    phoneMissing: simulated ? [] : [...phoneMissing],
    simulated,
  };
}
