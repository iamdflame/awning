# Awning: hard questions and short answers

Awning is a PayBox plugin that turns one sentence into a real business that people and AI agents can buy from the minute it opens.

Twenty-five questions a PayBox engineer might ask, with answers that are true of the code on `main` today. Paths are relative to the repository root. If an answer and the code disagree, the code wins and the answer needs fixing.

## Money and the plugin

**1. Can the plugin move money by itself?**
No. `awning_open` and `awning_buy` return one `io.paybox/transactionProposal` of kind `x402` (`proposeOpen`, `proposeBuy` in `plugin/src/awning.ts`). The sandbox call ends there; PayBox asks the user to approve and sends the paid request itself.

**2. What stops a proposal for more than the quoted price?**
Before proposing, the paid tools read Awning's stored price and the unpaid 402 quote in parallel and refuse if they differ (`plugin/src/plugin.ts`). PayBox then checks the live 402 against `maxAmount` before approval, and the server's `matchPayment` (`web/lib/x402/seller.ts`) requires the amount and `payTo` to match inside the signed authorization.

**3. Could a buyer's payment be redirected to someone other than the owner?**
`payTo` for a sale is the owner's wallet from the database (`businesses.owner_wallet`), and `matchPayment` refuses any authorization whose `to` differs from it. The wallet is public in `GET /v1/businesses/:slug` and in every 402, and the plugin's proposal text names it.

**4. Why x402 and not an EVM transfer proposal?**
An x402 authorization is verified before any work and settled only after the work succeeded, so a failed opening never moves money. A transfer proposal would move money first and need a refund for every failure. x402 also lets each offer carry its own `payTo`, so sales go straight to owners.

**5. When exactly is a Pro opening charged?**
Verify, claim the payment key, run the saga, then settle, then commit (`handlePaidRequest` in `web/lib/x402/flow.ts`). If any provisioning step fails, the authorization is never settled and the answer is `502 provisioning_failed` with `charged: false`.

## Idempotency and retries

**6. What if PayBox sends the same paid request twice?**
The idempotency key is the signed authorization itself, `network:asset:payer:nonce`. A key with a stored response replays it byte for byte; a key still in flight gets `409 payment_in_progress`; a unique insert decides races (`replayIfSeen` in `web/lib/x402/flow.ts`, tested in `web/tests/idempotency.test.ts`).

**7. What about two different payments for the same plan?**
The plan is claimed with a conditional update (`openPro` in `web/lib/services/open.ts`). A second payment for an opened plan gets `alreadyOpen: true, charged: false` and is never settled; a concurrent one gets `409 open_in_progress` and its key is released.

**8. Can a provider step run twice on a retry?**
Porkbun registration carries `Idempotency-Key: awning-open-<planId>-<domain>`, DNS records carry their own keys, and Vercel's "already attached" counts as success (`web/lib/services/open.ts`). The owner token is derived from the business id, so a retried opening returns the same token.

**9. Does a repeated `awning_buy` create two orders?**
Yes, if the user approves two proposals: each approved proposal is a separate order. The tool text tells the agent to poll the PayBox request and never call `awning_buy` again to check on one (`plugin/src/plugin.ts`).

## Failures and refunds

**10. What happens if domain registration fails halfway through the saga?**
Completed steps are undone in reverse order, each with its own timeout, and nothing is settled (`runSaga` in `web/lib/orchestrator/machine.ts`; `web/tests/failures.test.ts`). Registration runs last among the costly steps because it cannot be undone.

**11. What if something fails after the money settled?**
The work is undone and the treasury sends the same amount of USDC back to the authorization's signer, answering `refunded: true` with `refundTx` (`web/lib/adapters/refunder.ts`). If the refund transfer itself fails, the answer is `refunded: false`, the payment stays `settled` and the operator is alerted.

**12. Could a refund ever be simulated while real money moved?**
No. The real refunder is used only when the treasury key controls the treasury address (`treasuryRefundProblem`); otherwise refunds report failure, never success. Pro is not sold at all without a working refunder (`web/lib/services/readiness.ts`, tested in `web/tests/hardening.test.ts` and `web/tests/readiness.test.ts`).

**13. What if the Vercel function is killed mid-request?**
The reconciler (`web/lib/x402/reconcile.ts`) picks up payments stuck for over 3 minutes and asks USDC's `authorizationState(payer, nonce)` on Base. Not paid: marked failed and the plan released. Paid opening: refunded. Paid sale: recorded as settled and flagged to the operator. It runs after health checks, from a daily Vercel cron and from a GitHub workflow every 10 minutes.

**14. What if the facilitator times out or gives an unclear answer?**
`settleWithTruth` (`web/lib/x402/flow.ts`) reads `authorizationState` on Base: used means paid, unused gets one more attempt, a definitive refusal fails. If the chain can't be read either, the payment is `unconfirmed` and the reconciler settles the truth later.

**15. What if the domain was taken, or its price changed, between plan and payment?**
The `preflight` step re-checks the registrar and fails before anything else runs, and `register_domain` passes the quoted cents so Porkbun refuses a different price (`web/lib/services/open.ts`). The payment is not settled.

**16. Does the paid request fit PayBox's time limits?**
The plugin's own calls fit the 10 s sandbox budget: no network at startup or discovery, 4 s per request and 8 s for planning (`plugin/src/awning.ts`). The paid request runs on Awning's side under a saga deadline (`AWNING_OPEN_DEADLINE_MS`, 26 s by default in `web/lib/env.ts`) inside a 90 s function (`web/app/x402/open/[planId]/route.ts`). If PayBox stops waiting first, Awning still finishes the request and stores its answer, so a retry with the same authorization gets it; a function that is killed is finished by the reconciler.

## Trust and abuse

**17. Someone opens "MoonPay wallet recovery support". What happens?**
It is refused before anything is drafted or stored: `422 policy_blocked`. `web/lib/policy/screen.ts` blocks phishing lures (recovery phrases, one-time codes, "verify your wallet") and about 70 strong brands, including glued forms and homoglyphs like `m00npay` (`web/tests/policy.test.ts`). The rules are English keywords and a fixed list, so other languages and unlisted brands can pass; reports and takedown back them up.

**18. Can a script open thousands of free businesses?**
Per wallet: 12 plans an hour and 3 free openings a day; across all wallets: 300 plans and 60 free openings an hour; images: 30 an hour per deployment (`web/lib/policy/safety.ts`, `web/lib/services/images.ts`). The wallet is not proven, so rotating addresses runs into the global caps, which also slow honest users. Proof of wallet control is planned.

**19. Can fake reports take down an honest business?**
Reports from three distinct networks in 24 hours hold a new or barely used business for operator review. Established businesses (open at least 14 days and with at least 3 sales) are never held by reports alone; the operator is paged instead (`isEstablished` in `web/lib/policy/safety.ts`).

**20. Can buyer text inject instructions into the owner's agent?**
Buyer notes and contacts are stored as one plain line (`plainText` in `web/lib/services/orders.ts`). The plugin then strips control and invisible characters, caps the length and quotes each one under a line saying it is untrusted data (`oneLine` in `plugin/src/awning.ts`, `awning_orders` in `plugin/src/plugin.ts`). The text is still untrusted, and the owner's agent is told so.

**21. Can the owner's sentence inject anything into the drafter?**
The model's only output is a structured draft: a forced tool call or a strict JSON schema. `finalizeDraft` (`web/lib/adapters/drafter.ts`) clips lengths, forces the category from a catalogue, checks palette contrast and clamps prices. Storefronts render all business text escaped.

## Keys and secrets

**22. What does the brokered plugin key protect, and what if it leaks?**
It proves a request came through the Awning plugin on PayBox, not who the user is (`requirePluginKey` in `web/lib/api.ts`). Owner actions also need the owner token and payments need a signature, so a leaked key alone can plan and open free businesses within the quotas. Rotation is a change in the PayBox portal and the server env; dual-key rotation is planned.

**23. How does an owner prove ownership?**
With an `awn_ot_` token: an HMAC of the business id and a version under a server secret, never stored, compared in constant time, sent only in a header (`verifyOwnerToken` in `web/lib/api.ts`). It passes through the agent host's conversation when issued, which is an accepted risk today; wallet-signature sign-in is planned.

**24. What is the treasury key's blast radius?**
It receives Pro fees and pays refunds; it is read from the environment per use and never logged. When Porkbun is paid in USDC, each payment is capped at $100 and limited to USDC on Base (`payX402Challenge` in `web/lib/x402/buyer.ts`). Keeping a low hot balance and sweeping fees is planned.

## Costs and honesty

**25. What is real right now, and what does it cost you per business?**
`GET /v1/health` reports which providers are real, and any response that used a mock lists it in `simulated`; a mock facilitator refuses to start in production (`web/lib/x402/facilitator.ts`). The phone line is built but off until telephony is connected, so Pro today is the domain at the registrar's price plus a $9.00 fee for custom-domain hosting. A free business costs one drafting call, a domain check and a share of hosting. Renewals are not billed yet (`docs/BUSINESS.md`).

## Questions only you can answer

Prepare these in your own words; no draft answer is given.

- What did you decide yourself while building this, and why?
- Who is the owner you built it for, and have you shown it to one?
- What would you do with another month?
