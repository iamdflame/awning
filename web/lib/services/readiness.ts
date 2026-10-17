import { adapters } from "../adapters";
import { facilitator } from "../x402/facilitator";

// The refunder is part of Pro: a paid open that fails after settlement must be able to give the money back.
const PRO_PROVIDERS = ["registrar", "hosting", "telephony", "receptionist", "refunder"] as const;

export type ProReadiness = {
  /** Pro can be sold right now. */
  available: boolean;
  /** Provider adapters running as mocks. */
  missing: string[];
  /** Payments are simulated (mock facilitator): mocks are fine because no money moves. */
  simulated: boolean;
};

/**
 * Real money never buys simulated provisioning: with a real facilitator, Pro
 * (domain + hosting + phone + receptionist) is only offered when every one of
 * those providers is real. With the mock facilitator (dev/test) mocks are fine.
 */
export function proReadiness(): ProReadiness {
  const a = adapters();
  const missing = PRO_PROVIDERS.filter((k) => a[k].mock);
  let simulated = false;
  try {
    simulated = facilitator().mock;
  } catch {
    simulated = false;
  }
  return { available: simulated || missing.length === 0, missing: [...missing], simulated };
}
