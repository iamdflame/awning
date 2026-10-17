/** Contract constants: USDC on Base, x402 "exact" scheme. */
export const BASE_NETWORK = "eip155:8453" as const;
/** x402 v1 network name for Base mainnet. */
export const BASE_NETWORK_V1 = "base" as const;
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
/** EIP-712 domain of USDC on Base (needed by clients to sign EIP-3009). */
export const USDC_EIP712 = { name: "USD Coin", version: "2" } as const;
export const SCHEME = "exact" as const;
/**
 * How long a signed authorization may take to reach us (seconds). 15 minutes: a wallet's
 * signing step can include a first-time agent verification (seen live with PayBox), and a
 * 5-minute window expired before people finished it. The authorization can only pay our
 * payTo, and money still settles only after the work succeeds.
 */
export const MAX_TIMEOUT_SECONDS = 900;
