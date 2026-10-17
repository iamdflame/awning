import { HTTPFacilitatorClient } from "@x402/core/server";
import { SettleError, VerifyError } from "@x402/core/types";
import type { PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse } from "@x402/core/types";
import { createPublicClient, getAddress, http as viemHttp, verifyTypedData } from "viem";
import { base } from "viem/chains";
import { env, isProduction } from "../env";
import { announceMock, errorMessage } from "../log";
import { sha256Hex } from "../ids";
import { BASE_NETWORK, USDC_BASE, USDC_EIP712 } from "./constants";
import type { Authorization } from "./seller";

export type SettleOutcome =
  | { status: "settled"; response: SettleResponse }
  | { status: "failed"; reason: string }
  /** Transport error/timeout: the transfer may or may not have happened. */
  | { status: "unknown"; reason: string };

export interface Facilitator {
  readonly name: string;
  readonly mock: boolean;
  verify(payload: Record<string, unknown>, requirements: Record<string, unknown>): Promise<VerifyResponse>;
  settle(payload: Record<string, unknown>, requirements: Record<string, unknown>): Promise<SettleOutcome>;
  /** On-chain truth: has this EIP-3009 authorization been used? */
  authorizationUsed(a: Authorization): Promise<boolean>;
}

const USDC_AUTH_ABI = [
  {
    type: "function",
    name: "authorizationState",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** PayAI (or any x402 facilitator) over HTTP via @x402/core's client. */
export class HttpFacilitator implements Facilitator {
  readonly mock = false;
  private readonly client: HTTPFacilitatorClient;
  constructor(readonly name: string) {
    this.client = new HTTPFacilitatorClient({ url: name, timeoutMs: 12000 });
  }

  async verify(payload: Record<string, unknown>, requirements: Record<string, unknown>): Promise<VerifyResponse> {
    try {
      return await this.client.verify(payload as unknown as PaymentPayload, requirements as unknown as PaymentRequirements);
    } catch (err) {
      if (err instanceof VerifyError) return { isValid: false, invalidReason: err.invalidReason ?? "invalid_payment", invalidMessage: err.invalidMessage };
      return { isValid: false, invalidReason: "facilitator_unavailable", invalidMessage: errorMessage(err) };
    }
  }

  async settle(payload: Record<string, unknown>, requirements: Record<string, unknown>): Promise<SettleOutcome> {
    try {
      const r = await this.client.settle(payload as unknown as PaymentPayload, requirements as unknown as PaymentRequirements);
      if (r.success && r.transaction) return { status: "settled", response: r };
      return { status: "failed", reason: r.errorReason ?? r.errorMessage ?? "settle_failed" };
    } catch (err) {
      // A definitive refusal still gets an on-chain double check by the caller.
      if (err instanceof SettleError) return { status: "failed", reason: err.errorReason ?? err.message };
      return { status: "unknown", reason: errorMessage(err) };
    }
  }

  async authorizationUsed(a: Authorization): Promise<boolean> {
    const client = createPublicClient({ chain: base, transport: viemHttp(env.baseRpcUrl(), { timeout: 6000 }) });
    return client.readContract({
      address: USDC_BASE,
      abi: USDC_AUTH_ABI,
      functionName: "authorizationState",
      args: [getAddress(a.from), a.nonce as `0x${string}`],
    });
  }
}

const TRANSFER_WITH_AUTHORIZATION = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * Local facilitator for development and tests: verifies the EIP-3009
 * signature exactly as USDC would (EIP-712, USDC on Base domain) but "settles"
 * in memory. No money moves. Refused in production.
 */
export class MockFacilitator implements Facilitator {
  readonly name = "mock-facilitator";
  readonly mock = true;
  readonly used = new Set<string>();
  settleCalls = 0;
  verifyCalls = 0;
  /** Tests can force outcomes. */
  failSettleWith: string | null = null;

  private auth(payload: Record<string, unknown>): Authorization & { signature: string } {
    const p = payload.payload as { signature: string; authorization: Authorization };
    return { ...p.authorization, signature: p.signature };
  }

  async verify(payload: Record<string, unknown>, requirements: Record<string, unknown>): Promise<VerifyResponse> {
    this.verifyCalls++;
    const a = this.auth(payload);
    const amount = String(requirements.amount ?? requirements.maxAmountRequired ?? "");
    if (a.to.toLowerCase() !== String(requirements.payTo).toLowerCase()) return { isValid: false, invalidReason: "invalid_exact_evm_payload_recipient_mismatch" };
    if (a.value !== amount) return { isValid: false, invalidReason: "invalid_exact_evm_payload_authorization_value" };
    if (Number(a.validBefore) < Date.now() / 1000) return { isValid: false, invalidReason: "invalid_exact_evm_payload_authorization_valid_before" };
    if (this.used.has(a.nonce.toLowerCase())) return { isValid: false, invalidReason: "invalid_exact_evm_payload_authorization_nonce_used" };
    let ok = false;
    try {
      ok = await verifyTypedData({
        address: getAddress(a.from),
        domain: { name: USDC_EIP712.name, version: USDC_EIP712.version, chainId: 8453, verifyingContract: USDC_BASE },
        types: TRANSFER_WITH_AUTHORIZATION,
        primaryType: "TransferWithAuthorization",
        message: {
          from: getAddress(a.from),
          to: getAddress(a.to),
          value: BigInt(a.value),
          validAfter: BigInt(a.validAfter),
          validBefore: BigInt(a.validBefore),
          nonce: a.nonce as `0x${string}`,
        },
        signature: a.signature as `0x${string}`,
      });
    } catch {
      ok = false;
    }
    if (!ok) return { isValid: false, invalidReason: "invalid_exact_evm_payload_signature" };
    return { isValid: true, payer: a.from };
  }

  async settle(payload: Record<string, unknown>, requirements: Record<string, unknown>): Promise<SettleOutcome> {
    this.settleCalls++;
    if (this.failSettleWith) return { status: "failed", reason: this.failSettleWith };
    const v = await this.verify(payload, requirements);
    if (!v.isValid) return { status: "failed", reason: v.invalidReason ?? "invalid" };
    const a = this.auth(payload);
    this.used.add(a.nonce.toLowerCase());
    return {
      status: "settled",
      response: { success: true, transaction: `0x${sha256Hex(`mock-settle:${a.nonce}`)}`, network: BASE_NETWORK, payer: a.from },
    };
  }

  async authorizationUsed(a: Authorization): Promise<boolean> {
    return this.used.has(a.nonce.toLowerCase());
  }
}

type Holder = { f?: Facilitator; override?: Facilitator };
const g = globalThis as unknown as { __awningFacilitator?: Holder };
const holder: Holder = (g.__awningFacilitator ??= {});

export function facilitator(): Facilitator {
  if (holder.override) return holder.override;
  if (!holder.f) {
    const url = env.facilitatorUrl();
    if (url === "mock") {
      if (isProduction()) throw new Error("mock facilitator is not allowed in production");
      announceMock("facilitator", "AWNING_FACILITATOR_URL=mock — signatures verified locally, nothing settles on chain");
      holder.f = new MockFacilitator();
    } else {
      holder.f = new HttpFacilitator(url);
    }
  }
  return holder.f;
}

export function setFacilitatorForTests(f: Facilitator | undefined) {
  holder.override = f;
  holder.f = undefined;
}
