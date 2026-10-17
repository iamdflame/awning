#!/usr/bin/env node
// x402 buyer for testing Awning endpoints end to end (what PayBox does for a user).
//
//   node scripts/pay.mjs <url> [json-body] [--yes] [--max 25] [--ephemeral]
//
// Without --yes it only prints the 402 quote. With --yes it signs an EIP-3009
// USDC authorization for exactly the quoted amount (refusing anything above
// --max USD), retries the request with PAYMENT-SIGNATURE and prints the result.
// Key: BUYER_PRIVATE_KEY env, or --ephemeral for a throwaway key (only useful
// against a server running AWNING_FACILITATOR_URL=mock — real settlement needs funds).
import { x402Client } from "@x402/core/client";
import { decodePaymentResponseHeader, x402HTTPClient } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--max"));
const [url, bodyArg] = positional;
if (!url) {
  console.error("usage: node scripts/pay.mjs <url> [json-body] [--yes] [--max 25] [--ephemeral]");
  process.exit(2);
}
const body = bodyArg ?? "{}";
const maxUsd = Number(opt("--max", "25"));

const post = (headers = {}) => fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

async function main() {
const first = await post();
const firstText = await first.text();
if (first.status !== 402) {
  console.log(`HTTP ${first.status} (no payment needed)\n${firstText}`);
  return first.ok ? 0 : 1;
}
const http = new x402HTTPClient(new x402Client());
let required;
try {
  required = http.getPaymentRequiredResponse((h) => first.headers.get(h), JSON.parse(firstText || "{}"));
} catch (err) {
  console.error("402 without a valid PAYMENT-REQUIRED header:", err.message);
  return 1;
}
const a = required.accepts[0];
const usd = Number(a.amount ?? a.maxAmountRequired) / 1e6;
console.log(`402 quote: ${usd.toFixed(6)} USDC on ${a.network} → payTo ${a.payTo} (asset ${a.asset})`);
if (!flag("--yes")) {
  console.log("dry run: pass --yes to sign and pay");
  return 0;
}
if (usd > maxUsd) {
  console.error(`refusing: ${usd} USDC is above --max ${maxUsd}`);
  return 1;
}
const pk = flag("--ephemeral") ? generatePrivateKey() : process.env.BUYER_PRIVATE_KEY;
if (!pk) {
  console.error("set BUYER_PRIVATE_KEY or pass --ephemeral");
  return 2;
}
const account = privateKeyToAccount(pk);
const client = new x402HTTPClient(
  x402Client.fromConfig({
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
    spendControls: { maxAmountPerPayment: `$${maxUsd}` },
  }),
);
const payload = await client.createPaymentPayload(required);
const t0 = Date.now();
const paid = await post(client.encodePaymentSignatureHeader(payload));
const text = await paid.text();
console.log(`paid request by ${account.address}: HTTP ${paid.status} in ${Date.now() - t0} ms`);
const pr = paid.headers.get("PAYMENT-RESPONSE");
if (pr) console.log("PAYMENT-RESPONSE:", JSON.stringify(decodePaymentResponseHeader(pr)));
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
return paid.ok ? 0 : 1;
}

// exitCode instead of process.exit(): avoids a libuv assertion on Windows with open sockets.
process.exitCode = await main();
