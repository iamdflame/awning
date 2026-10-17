import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { AuthCaptureEvmScheme } from "@x402/evm/auth-capture/client";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../env";
import { BASE_NETWORK, USDC_BASE } from "./constants";

/**
 * Pays a third-party x402 challenge (e.g. Porkbun `payWith: "usdc"`) from the
 * Awning treasury. Signs only terms that are USDC on Base for exactly
 * `expectedAtomic`; anything else is refused before a signature exists.
 * Returns the PAYMENT-SIGNATURE header value for the retried request.
 */
export async function payX402Challenge(paymentRequiredHeader: string, expectedAtomic: bigint): Promise<string> {
  const pk = env.treasuryPrivateKey();
  if (!pk) throw new Error("treasury key not configured; cannot pay x402 challenge");
  const account = privateKeyToAccount(pk as `0x${string}`);
  const required = decodePaymentRequiredHeader(paymentRequiredHeader);
  const client = x402Client.fromConfig({
    schemes: [
      { network: BASE_NETWORK, client: new ExactEvmScheme(account) },
      { network: BASE_NETWORK, client: new AuthCaptureEvmScheme(account) },
    ],
    spendControls: { maxAmountPerPayment: "$100" },
    policies: [
      (_version, reqs) =>
        reqs.filter(
          (r) =>
            r.network === BASE_NETWORK &&
            r.asset.toLowerCase() === USDC_BASE.toLowerCase() &&
            BigInt(r.amount) === expectedAtomic,
        ),
    ],
  });
  const payload = await client.createPaymentPayload(required);
  return encodePaymentSignatureHeader(payload);
}
