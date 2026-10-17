import { createPublicClient, createWalletClient, erc20Abi, getAddress, http as viemHttp } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { env } from "../env";
import { log } from "../log";
import { sha256Hex } from "../ids";
import { USDC_BASE } from "../x402/constants";
import type { Refunder } from "./types";

/**
 * USDC refunds from the treasury on Base (viem). Used only for failures that
 * are discovered after a payment settled; failures before settlement never
 * move money in the first place. The private key is read per call and never logged.
 */
export class ViemRefunder implements Refunder {
  readonly name = "viem-usdc";
  readonly mock = false;
  constructor(
    private readonly privateKey: `0x${string}`,
    private readonly rpcUrl: string,
  ) {}

  async refund(input: { to: string; amountAtomic: bigint; reason: string }) {
    if (input.amountAtomic <= 0n) throw new Error("refund amount must be positive");
    const account = privateKeyToAccount(this.privateKey);
    const transport = viemHttp(this.rpcUrl, { timeout: 10000 });
    const wallet = createWalletClient({ account, chain: base, transport });
    const pub = createPublicClient({ chain: base, transport });
    const hash = await wallet.writeContract({
      address: USDC_BASE,
      abi: erc20Abi,
      functionName: "transfer",
      args: [getAddress(input.to), input.amountAtomic],
    });
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 20000 });
    if (receipt.status !== "success") throw new Error(`refund transfer reverted: ${hash}`);
    log.info("refund sent", { to: input.to, amountAtomic: input.amountAtomic, tx: hash, reason: input.reason });
    return { tx: hash };
  }
}

export class MockRefunder implements Refunder {
  readonly name = "mock-refunder";
  readonly mock = true;
  readonly refunds: { to: string; amountAtomic: bigint; reason: string; tx: string }[] = [];
  async refund(input: { to: string; amountAtomic: bigint; reason: string }) {
    const tx = `0x${sha256Hex(`refund:${input.to}:${input.amountAtomic}:${this.refunds.length}:${input.reason}`)}`;
    this.refunds.push({ ...input, tx });
    log.warn("MOCK refund (no money moved)", { to: input.to, amountAtomic: input.amountAtomic, reason: input.reason });
    return { tx };
  }
}

/**
 * Real payments with no usable treasury key: refunds are impossible, and we
 * must never claim one happened. Every call fails, so the paid flow reports
 * `refunded: false` and logs the case for the operator.
 */
export class UnavailableRefunder implements Refunder {
  readonly name = "unavailable";
  readonly mock = true;
  constructor(readonly why: string) {}
  async refund(): Promise<{ tx: string }> {
    throw new Error(`refunds are unavailable on this server: ${this.why}`);
  }
}

/** Why a configured treasury cannot refund, or null when it can. */
export function treasuryRefundProblem(): string | null {
  const pk = env.treasuryPrivateKey();
  if (!pk) return "AWNING_TREASURY_PRIVATE_KEY is not set";
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) return "AWNING_TREASURY_PRIVATE_KEY is not a 32-byte hex key";
  const address = env.treasuryAddress();
  if (!address) return "AWNING_TREASURY_ADDRESS is not set";
  if (privateKeyToAccount(pk as `0x${string}`).address.toLowerCase() !== address.toLowerCase()) {
    return "AWNING_TREASURY_PRIVATE_KEY does not control AWNING_TREASURY_ADDRESS";
  }
  return null;
}

/** Real refunder when the treasury key is valid and matches the address; otherwise refunds are unavailable (never simulated). */
export function makeRefunder(): Refunder {
  const problem = treasuryRefundProblem();
  if (problem) return new UnavailableRefunder(problem);
  return new ViemRefunder(env.treasuryPrivateKey() as `0x${string}`, env.baseRpcUrl());
}
