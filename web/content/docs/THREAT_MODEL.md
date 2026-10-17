# Awning threat model

Status: reviewed against the code on `main` as of 2026-10-17 (through commit `fdfb2ac`). "In code" means the mitigation exists on `main` and the file is named. "Planned" means it does not exist on `main` yet. Known gaps found during this review are listed at the end; they are bugs to fix, not accepted risks, unless marked accepted.

## Scope

The PayBox plugin (`plugin/`), the web app (`web/`: API, x402 seller, opening orchestrator, storefront hosting, voice webhook) and its use of providers (Porkbun, Vercel, Twilio, ElevenLabs, Anthropic, the x402 facilitator, Base). PayBox itself (sandbox, wallets, approvals, signing) is out of scope except where Awning relies on its guarantees.

## Assets

| Asset | Why it matters |
|---|---|
| Treasury private key (`AWNING_TREASURY_PRIVATE_KEY`) | Controls the wallet that receives Pro fees, sends refunds, and pays Porkbun in USDC when `PORKBUN_PAY_WITH=usdc` |
| Buyers' and owners' USDC | Moves only through signed EIP-3009 authorizations; must move exactly once, for exactly the quoted amount, to the right `payTo` |
| Owner tokens and `AWNING_OWNER_TOKEN_SECRET` | The token is the only proof of ownership; the secret derives every token |
| Plugin key (`AWNING_PLUGIN_KEY`) | Gates planning and opening; one shared value for all PayBox users of the plugin |
| Operator key (`AWNING_ADMIN_KEY`) | Suspends and restores any business |
| Cron secret (`CRON_SECRET`) | Triggers the payment reconciler, which can send treasury refunds (only for payments the chain shows were taken) |
| Provider credentials | Porkbun (registers and pays for domains), Vercel (attaches domains to the project), Twilio (buys numbers, sends SMS), ElevenLabs (agents), Anthropic |
| Payment idempotency records (`payments` table) | Prevent double charges and double provisioning |
| Registered domains and phone numbers | Real, paid, publicly reachable resources in Awning's provider accounts |
| Personal data | Owner name, email, phone, sentence; buyer notes and contacts; caller numbers and call content |
| Public trust in listings | Every listing is a real domain, phone line and checkout; abuse harms buyers and callers |

## Actors

Owner, buyer, caller, visitor (all may be malicious); a malicious business owner; an attacker with no account; a compromised or prompt-injected agent; a provider outage; the operator.

## Trust boundaries

```mermaid
flowchart LR
  subgraph U["Untrusted"]
    AG["Agents and their hosts"]
    CL["Callers"]
    WEBV["Browsers"]
  end
  subgraph P["PayBox (trusted for signing and approval)"]
    PBX["PayBox + sandbox"]
  end
  subgraph A["Awning (trusted)"]
    API["API + x402 seller"]
    DB[("DB")]
    SEC["Secrets in env"]
  end
  subgraph X["Third parties"]
    FAC["Facilitator"]
    CH["Base / USDC"]
    PROV["Porkbun, Vercel, Twilio, ElevenLabs, Anthropic"]
  end
  AG -- "B1: MCP" --> PBX
  PBX -- "B2: plugin calls + brokered key" --> API
  PBX -- "B3: x402 payments" --> API
  API -- "B4" --> FAC
  API -- "B4" --> CH
  API -- "B5: provider credentials" --> PROV
  WEBV -- "B6: Host header, public GETs" --> API
  CL -- "B7: phone" --> PROV
  PROV -- "B7: webhook, agent prompt" --> API
  API --- DB
  API --- SEC
```

## STRIDE by boundary

### B1. Agent ↔ PayBox ↔ plugin sandbox

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| Spoofing | A tool claims to be something it is not | PayBox treats tool text as an untrusted label and builds its own payment plan from the proposal bytes ([developer guide](https://docs.paybox.sh)) | PayBox |
| Tampering | A proposal for more than the quote | The plugin proposes exactly the quoted amount and refuses mismatches (`plugin/src/plugin.ts`, `awning_open`, `awning_buy`); PayBox checks the live 402 against `maxAmount` before approval | In code + PayBox |
| Repudiation | "I never approved that" | Every money tool needs the user's approval in PayBox; Awning keeps the payer address and tx per payment (`payments`, `orders`) | In code + PayBox |
| Information disclosure | The plugin leaks secrets in output | The plugin never holds the plugin key; errors are fixed sentences (`guard` in `plugin/src/plugin.ts`); PayBox withholds output containing a brokered value | In code + PayBox |
| Information disclosure | The owner token passes through the agent host | `awning_open_free` puts the token in the tool text so the agent can hand it over; it then lives in the host's conversation history | Accepted for now; wallet-signature auth planned |
| Denial of service | A slow API stalls the sandbox | 4 s per request, 8 s for `awning_plan`, inside the 10 s budget (`plugin/src/awning.ts`) | In code |
| Elevation | The plugin pays on its own | It cannot: it returns proposals only; signing is PayBox's | By design |

### B2. Plugin ↔ API (plugin key)

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| Spoofing | Calling plugin endpoints without PayBox | `x-awning-plugin-key` compared in constant time; missing key in production → 503 (`requirePluginKey`, `web/lib/api.ts`) | In code |
| Spoofing | Anyone with the leaked key | The key authenticates the channel, not a user. Owner actions also need the owner token. Rotation: change it in the PayBox portal and the server env; the server accepts one key at a time, so rotation has a short window of 401s | In code; dual-key rotation planned |
| Tampering | Changing another business | Owner endpoints require the HMAC owner token for that business (`verifyOwnerToken`) | In code |
| Information disclosure | Enumerating businesses through `/v1/orders` | Unknown slug and wrong token give the same answer | In code |
| Denial of service / cost | Flooding `POST /v1/plan` (each call can hit the LLM, Porkbun and Twilio, writes rows and schedules two image generations) | Per-wallet quotas (12 plans an hour, 3 free openings a day) and global caps (300 plans and 60 free openings an hour) in `web/lib/policy/safety.ts`; images capped at 30 an hour per deployment (`web/lib/services/images.ts`). The wallet is any address the caller types, so a caller can rotate addresses up to the global caps | In code; proof of wallet control planned |
| Spoofing | Calling the reconciler | `Authorization: Bearer <CRON_SECRET>` compared in constant time; disabled when unset (`web/app/v1/cron/reconcile/route.ts`). The reconciler only acts on the chain's answer, so a caller can make it run early but cannot change outcomes | In code |

### B3. PayBox x402 client ↔ x402 endpoints

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| Spoofing | A forged payment | The facilitator verifies the EIP-3009 signature against the server's own requirements (`handlePaidRequest`, `web/lib/x402/flow.ts`); tested in `web/tests/idempotency.test.ts` | In code |
| Tampering | Lower amount, or `payTo` changed to the attacker | `matchPayment` (`web/lib/x402/seller.ts`) requires scheme, network, asset, amount and payTo to match in the declared v2 terms and inside the signed authorization (`to`, `value`) | In code |
| Tampering | Price changed between quote and payment | The amount is fixed in the plan; preflight fails on a registrar price change before settlement | In code |
| Repudiation | A disputed charge | Settlement tx hash, payer, amount and the full response are stored per payment key | In code |
| Replay | The same payment sent twice | Key = `network:asset:payer:nonce`; seen → stored response; in flight → 409; unique insert decides races (`web/tests/idempotency.test.ts`). USDC itself settles an authorization at most once | In code |
| Replay | A second, different payment for an open plan | Plan claim is conditional; an open plan answers `alreadyOpen`, not settled (`openPro`) | In code |
| Replay | An authorization for one resource presented at another with the same amount and `payTo` | `exact` authorizations do not name the resource. The key is global, so a used authorization only replays its first response. Exploiting this needs the victim's signed authorization before it reaches Awning, which requires breaking TLS | Accepted |
| Information disclosure | Replaying a captured payment header to read the response (it contains the owner token) | Only the payer and PayBox hold the header; it travels over HTTPS | Accepted |
| Denial of service | Paid requests that hold the plan in `opening`, or a killed function that leaves a payment `working` | A claim older than 3 minutes can be taken over; concurrent payments get 409 and their key released; the reconciler gives every stale payment a definitive stored answer from the chain (`web/lib/x402/reconcile.ts`) | In code |
| Elevation | Simulated provisioning, or a simulated refund, for real money | With a real facilitator, Pro is offered only if the registrar, hosting, telephony and receptionist are real and the refunder works (`web/lib/services/readiness.ts`). Without a treasury key that controls `AWNING_TREASURY_ADDRESS`, refunds are `UnavailableRefunder`: the answer is `refunded: false` and the operator is alerted, never a fake success (`web/lib/adapters/refunder.ts`) | In code, tested (`web/tests/hardening.test.ts`, `web/tests/readiness.test.ts`) |
| Tampering | Browser buyers and CORS | Every x402 response carries `access-control-allow-origin: *`; `OPTIONS` preflights allow only `content-type`, `payment-signature` and `x-payment` (`web/app/x402/**/route.ts`, `web/lib/x402/flow.ts`). Payments carry no cookies or credentials, so open CORS grants nothing | In code |

### B4. API ↔ facilitator and chain

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| Spoofing / tampering | A facilitator that reports false settlement | When the facilitator's answer is unclear, USDC's `authorizationState(payer, nonce)` on Base decides (`settleWithTruth`). A clean "success" from the facilitator is trusted | In code; full on-chain confirmation planned |
| Denial of service | Facilitator down | Verify fails → 402, nothing provisioned. Settle unknown and chain unreadable → treated as paid, status `unconfirmed`; the reconciler later marks it `settled` if the chain shows the transfer, or `failed` and flags the operator if it never settles. A business or order delivered without settlement stays delivered | In code |
| Elevation | Mock facilitator in production | `facilitator()` refuses `mock` when `VERCEL_ENV` or `AWNING_ENV` is `production` (`web/lib/x402/facilitator.ts`) | In code |

### B5. API ↔ providers

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| Information disclosure | Credentials in logs | The logger is never passed secrets (`web/lib/log.ts`); provider errors are excerpted to 300 characters | In code |
| Information disclosure | Twilio credentials shared with ElevenLabs | Importing a Twilio number into ElevenLabs sends the Twilio account SID and auth token to ElevenLabs (`web/lib/adapters/receptionist.ts`), as that integration requires | Accepted; a Twilio subaccount or API key with limited scope is planned |
| Information disclosure | Provider error text returned to payers | `provisioning_failed` names only the failed step; post-settlement answers use a fixed public `reason`; provider text goes to logs and `payments.error` (`web/lib/services/open.ts`, `web/lib/x402/flow.ts`) | In code |
| Tampering | Double registration or double DNS on retry | Porkbun `Idempotency-Key` per plan and domain, DNS keys per record, Vercel "already attached" = success | In code |
| Repudiation | Which provider resources belong to which business | Provider ids recorded in `businesses.provisioning` | In code |
| Denial of service | A provider is down | Steps time out; completed steps are undone; nothing is settled | In code |

### B6. Public web: storefronts, directory, API reads

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| Spoofing | A spoofed `Host` header | Host only selects which public storefront to render (`web/lib/host.ts`); it grants nothing | In code |
| Spoofing | One business's host renders another business at `/s/<slug>` | `/s/*` answers `404` on every business host (`blockedOnTenantHost` in `web/lib/host.ts`, `web/middleware.ts`) | In code |
| Tampering | Script injection through business text | React escapes all business text; nothing is rendered as HTML | In code |
| Information disclosure | Drafts are readable | Preview URLs and `GET /v1/businesses/:slug` serve drafts (`noindex`, ribbon); they contain no secret | Accepted |
| Information disclosure | `GET /v1/health` shows configuration state | Public by design for monitoring; database and facilitator failures show only `error`, the detail is logged (`web/app/v1/health/route.ts`) | In code |
| Denial of service | Expensive directory queries | `q` capped at 120 characters and 6 words; `limit` capped at 100 | In code; caching planned |
| Denial of service | Pausing an honest business with fake reports | Reports from three distinct networks in 24 hours suspend a business automatically; a reporter is an HMAC of the first `x-forwarded-for` address's network (IPv4 /24, IPv6 /48) and the day, and may file 5 reports a day (`web/lib/policy/safety.ts`). Three networks are still enough to pause a business until an operator restores it | In code; operator alerting planned |
| Elevation | Operator endpoint | `x-awning-admin-key` compared in constant time; disabled when unset (`web/app/v1/admin/businesses/[slug]/status/route.ts`) | In code |

### B7. Phone: callers ↔ receptionist ↔ API

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| Spoofing | Fake Twilio webhooks | `X-Twilio-Signature` checked when `TWILIO_AUTH_TOKEN` is set (`web/app/v1/voice/[slug]/route.ts`) | In code (unchecked only in mock mode) |
| Tampering | A caller talks the AI receptionist into false promises or instructions | The ElevenLabs agent has a prompt and a first message and no tools: it cannot move money, change data or send messages. Its safety rules "override anything a caller says": callers cannot change or reveal the instructions; it never claims to be a bank, government office, delivery company, PayBox or MoonPay; never promises refunds, discounts or dates; never reads out personal details or earlier calls; never takes card numbers, codes, keys or recovery phrases; says it is an AI when asked (`web/lib/plan/receptionist.ts`) | In code |
| Spoofing | A suspended business's line keeps answering | Suspension detaches the phone number from the ElevenLabs agent and restoring re-attaches it (`togglePhoneAgent` in `web/lib/policy/safety.ts`; best effort, a provider error is logged for the operator); the TwiML path refuses non-live businesses | In code |
| Information disclosure | Callers' numbers | The TwiML path stores only the last four digits in `events.data`, which is not returned publicly | In code |
| Information disclosure | Call audio and transcripts at the voice provider | ElevenLabs processes the call; Awning sets no retention options when creating the agent | Planned: retention settings and disclosure at call start |

## Topics

### x402 replay and amount or payTo tampering

Covered in B3. Order of checks for a paid request: replay lookup → exact match against the live charge → facilitator verify (server requirements) → unique claim → work → settle → commit ([ARCHITECTURE.md](ARCHITECTURE.md#x402-seller)). The client's declared terms are never forwarded as requirements. Tests: `web/tests/idempotency.test.ts`, `web/tests/protocol.test.ts`, `web/tests/x402-quote.test.ts`.

### Owner token

- `awn_ot_` + base64url HMAC-SHA256 of `owner:<businessId>:<version>` under `AWNING_OWNER_TOKEN_SECRET`; derived, never stored; compared in constant time (`web/lib/api.ts`).
- Production refuses to run without the secret; development uses a fixed fallback.
- Sent only in the `x-awning-owner-token` header, never in URLs. The plugin never echoes it in owner-tool output.
- Revocation: bumping `owner_token_version` revokes one business's tokens; rotating the secret revokes all. No endpoint does either yet.
- Re-issue: `/x402/open` returns the token again only to the original payer (proven by their signature). `POST /v1/open-free` returns it again only to a retry within 10 minutes of a free opening (`FREE_OPEN_RETRY_WINDOW_MS` in `web/lib/services/open.ts`); after that, and always for Pro businesses, it answers `ownerToken: null`. Within those 10 minutes, anyone holding the `planId` and the plugin key can still read the token; accepted as the cost of idempotent retries.

### Plugin key

One value for all PayBox users, injected by PayBox at egress, never visible to plugin code. It proves a request came through the Awning plugin on PayBox, not who the user is. Every per-user permission rests on the owner token or on a signed payment.

### Treasury key

- Read from the environment per use, never logged (`web/lib/adapters/refunder.ts`, `web/lib/x402/buyer.ts`).
- Refunds: the amount is the charge, the recipient is the authorization's signer, and at most one refund runs per payment key.
- Porkbun payments in USDC sign only USDC on Base for exactly the expected amount, capped at $100 per payment (`payX402Challenge`).
- The key must control `AWNING_TREASURY_ADDRESS`, or refunds are unavailable and Pro is not sold (`treasuryRefundProblem` in `web/lib/adapters/refunder.ts`); `GET /v1/health` shows `checks.refunds`.
- Planned: keep the hot balance low and sweep fees to cold storage; alert on refunds.

### Refund abuse

Only an opening can be refunded by Awning: when the final commit fails after settlement, or when the reconciler finds that an interrupted open took the payment. A payer cannot ask for a refund; the trigger is a server-side failure confirmed by the chain, and the amount and recipient are fixed. The reconciler claims each payment with an optimistic update before acting, so concurrent runs cannot refund twice. Sales are never refunded by Awning (they settle to the owner's wallet), so there is no refund path to abuse for orders.

### Provider credentials

All in environment variables, sent only to their own APIs, with the ElevenLabs exception above. Porkbun keys travel in the JSON body as Porkbun's API requires. Porkbun keys can be scoped by IP range, domain and permission, and Porkbun's agent spend limit defaults to $100 a month ([Porkbun API v3](https://porkbun.com/api/json/v3/documentation)); planned: use both.

### Prompt injection

| Path | Who controls the text | What the text reaches | Mitigation | Status |
|---|---|---|---|---|
| Owner sentence → drafter LLM | Owner | A forced tool call; output validated by zod and `finalizeDraft` (lengths, enum category, prices clamped, palette contrast) and rendered as escaped text | The model has no tools beyond returning the draft; the output is data | In code |
| Business text → receptionist prompt | Owner | The ElevenLabs system prompt | The text was screened at plan time; the receptionist speaks for the owner and has no tools; the safety rules come after the business text | In code |
| Caller speech → receptionist | Caller | The voice agent only | No tools; safety rules that override the caller | In code |
| Business and offer text → buyer agents (`awning_find`, `awning_business`) | Owner | Other users' agents | Every payment needs the buyer's approval in PayBox; the plugin computes amounts from structured fields, not text | In code + PayBox |
| `buyerNote`, `buyerContact` → owner's agent (`awning_orders`) and owner SMS | Buyer | The owner's agent context and phone | Length caps (500 / 200); stored as one plain line, control characters and line breaks replaced (`plainText` in `web/lib/services/orders.ts`). The text itself is still untrusted | In code |

### Phishing and brand-impersonation businesses

Awning registers real domains and real phone numbers from a sentence, so a business named after a bank or a wallet ("… wallet recovery support") would get a matching domain, a phone line and a listing. In code ([`web/lib/policy/screen.ts`](../web/lib/policy/screen.ts), tests in `web/tests/policy.test.ts`):

- The sentence is screened before anything is drafted, the draft before anything is stored, and owner-added offers before they are saved. Categories: weapons, drugs, adult, gambling, financial schemes, counterfeit, hacking, phishing (passwords, one-time codes, wallet keys, recovery phrases, "verify/unlock your wallet"), government impersonation, tobacco. A block is `422 policy_blocked` and nothing is stored.
- Names are screened for brands: about 70 strong brands (PayPal, MoonPay, PayBox, Coinbase, banks, carriers, tax agencies, …) block on a whole token, a glued form (`paypalsupport`) or a homoglyph (`m00npay`); dictionary-word brands (Apple, Amazon, Square, Stripe, Visa, …) block only next to a lure word. Domain options are built from the screened name.
- The reserved slug list (`www`, `api`, `awning`, `paybox`, …) in `web/lib/services/businesses.ts` still applies.
- Reports and operator takedown suspend a business: checkout, opening and new offers are refused and it leaves the directory.

Limits: the rules are English keywords and fixed lists, so other languages, misspellings outside the homoglyph map and brands not on the list pass (see gaps).

### Spam openings

Each plan costs provider calls and two image generations; each free opening is a public listing and subdomain. In code: 12 plans per owner wallet per hour and 3 free openings per owner wallet per day, keyed on the wallet because PayBox traffic shares egress IPs; global caps of 300 plans and 60 free openings an hour across all wallets; and a deployment-wide cap of 30 generated images an hour. The wallet is not proven: any well-formed address is accepted, so a script that rotates addresses is stopped only by the global caps (which then also slow honest users). Planned: require a signature from the wallet for repeated free openings.

### Personal data

| Data | Stored in | Shared with | Public |
|---|---|---|---|
| Owner wallet | `plans`, `businesses` | the chain (as `payTo`) | yes: `payTo` in `GET /v1/businesses/:slug` and every 402 |
| Owner name, email, phone, country, sentence | `plans` (name and phone also in `businesses`) | the drafting model: Anthropic, or the Vercel AI Gateway and its model provider (sentence, name, country); Twilio (phone, for SMS) | no |
| Reports | `events` (`report`): reason, details, optional contact, reporter id = HMAC of the IP's network and the day | — | no |
| Business name, description, city, phone number | `businesses` | everyone | yes |
| Buyer wallet, note, contact | `orders`, `payments` | the owner (orders, SMS); the chain (wallet) | no (wallet is on chain) |
| Caller number | Twilio, ElevenLabs; last four digits in `events.data` | — | no |
| Call audio and transcripts | ElevenLabs (when an agent is attached) | — | no |

There is no deletion endpoint and no retention job on `main`. In mock mode, the log notifier writes the order message, including buyer contact and note, to the server log. See [legal/privacy.md](legal/privacy.md).

## Mitigations: in code vs planned

| Mitigation | Status | Where |
|---|---|---|
| Proposals only; exact quoted amount; refusal on mismatch | In code | `plugin/src/plugin.ts` |
| Strict input schemas; bounded requests; no redirects | In code | `plugin/src/schemas.ts`, `plugin/src/awning.ts` |
| Plugin key, constant-time | In code | `web/lib/api.ts` |
| HMAC owner tokens, constant-time, versioned | In code | `web/lib/api.ts` |
| Unpaid x402 requests have no side effects | In code, tested | `web/lib/x402/seller.ts`, `web/tests/x402-quote.test.ts` |
| Replay by authorization key; unique claim | In code, tested | `web/lib/x402/flow.ts` |
| Exact match of amount and `payTo` in terms and signature | In code | `web/lib/x402/seller.ts` |
| Settle only after work; compensation; refunds after settlement | In code, tested | `web/lib/x402/flow.ts`, `web/lib/orchestrator/machine.ts`, `web/tests/failures.test.ts` |
| On-chain `authorizationState` when settlement is unclear | In code | `web/lib/x402/facilitator.ts` |
| Reconciler for interrupted and unconfirmed payments; optimistic claim; definitive stored answers | In code, tested | `web/lib/x402/reconcile.ts`, `web/app/v1/cron/reconcile/route.ts`, `web/app/v1/health/route.ts`, `web/vercel.json`, `.github/workflows/reconcile.yml`, `web/tests/hardening.test.ts` |
| No simulated Pro for real money; Pro requires a working refunder | In code, tested | `web/lib/services/readiness.ts` |
| Refunds never simulated with real payments; treasury key must control the treasury address | In code, tested | `web/lib/adapters/refunder.ts`, `web/lib/adapters/index.ts`, `web/tests/hardening.test.ts` |
| Owner token re-issued by `open-free` only within 10 minutes of a free opening | In code, tested | `web/lib/services/open.ts` |
| `/s/*` blocked on business hosts | In code, tested | `web/lib/host.ts`, `web/middleware.ts` |
| No internal error text in payer answers or the health check | In code | `web/lib/services/open.ts`, `web/lib/x402/flow.ts`, `web/app/v1/health/route.ts` |
| Buyer note and contact stored as one plain line | In code, tested | `web/lib/services/orders.ts`, `web/tests/hardening.test.ts` |
| CORS preflight and allow-origin on every x402 response | In code, tested | `web/app/x402/open/[planId]/route.ts`, `web/app/x402/b/[slug]/[sku]/route.ts`, `web/lib/x402/flow.ts`, `web/lib/x402/seller.ts` |
| Paid-request budget inside the function limit (saga 14 s, `maxDuration` 90 s) | In code | `web/lib/env.ts`, `web/app/x402/**/route.ts` |
| Mock facilitator refused in production | In code | `web/lib/x402/facilitator.ts` |
| Twilio webhook signatures | In code | `web/app/v1/voice/[slug]/route.ts` |
| Non-custodial sales (`payTo` = owner wallet) | In code | `web/lib/services/orders.ts` |
| Acceptable-use and brand screening, per-wallet quotas and global caps, reports counted per network, takedown | In code, tested | `web/lib/policy/*`, `web/tests/policy.test.ts` |
| Receptionist guardrails | In code | `web/lib/plan/receptionist.ts` |
| Phone number detached from the receptionist on suspension, re-attached on restore; suspended offers `410` | In code | `web/lib/policy/safety.ts`, `web/app/v1/businesses/[slug]/offers/route.ts` |
| Call disclosure at the start of the call, transcript retention | Planned | `web/lib/adapters/receptionist.ts` |
| Suspended storefront view | Planned (in progress) | `web/app/s/[slug]/page.tsx` |
| Proof of wallet control for quotas | Planned | — |
| Automatic cleanup of provider resources after an interrupted open | Planned | — |
| Email notifications to owners | Planned | — |
| Owner auth by wallet signature instead of a bearer token | Planned | — |
| Owner token rotation endpoint | Planned | — |
| Data deletion and retention | Planned | — |
| Rate limits per IP for public reads | Planned | — |

## Known gaps

1. **Quotas trust the typed wallet.** Plan and free-opening quotas are per `ownerWallet`, which is not proven; rotating addresses bypasses them up to the global hourly caps, which then slow everyone. There is no per-IP limit on public reads.
2. **Photos after suspension.** `/img/:id` stops serving a suspended business's photos, but copies already cached by the CDN (one-year immutable caching) stay reachable.
3. **Provider cleanup after an interrupted open is operator-assisted.** When a function dies mid-saga, the reconciler settles the money truthfully and releases the plan, but the phone number, receptionist agent and hosting entries created before the interruption are only logged (`OPERATOR: interrupted paid open`) for the operator to remove.
4. **No email notifications.** `ownerEmail` is stored but unused; owners hear about orders only by SMS (when they gave `ownerPhone` and Twilio is configured) or through `awning_orders`.
5. **Storefront page for suspended businesses.** At `fdfb2ac`, `web/app/s/[slug]/page.tsx` still renders a suspended business as a preview with its buy prompts; checkout itself is refused. A closed-for-review view is being built.
6. **Delivered without settlement.** When the facilitator's answer was unclear and the authorization never settles, the reconciler marks the payment `failed` and alerts the operator, but the business stays open or the order stays recorded; reversing it is manual.
7. **Order settled but not recorded.** If a sale settles to the owner and the order cannot be recorded, the buyer is told to contact the seller and the operator is alerted; Awning cannot refund it.
8. **Report griefing (narrowed).** Reports from three distinct networks still hold a *new or barely used* business (open < 14 days or < 3 sales) until an operator reviews it. Established businesses are never held by reports alone; the operator is paged instead (`isEstablished` in `web/lib/policy/safety.ts`).
9. **Screening coverage.** English keyword rules and a fixed brand list; other languages and unlisted brands pass.
10. **Owner-token retry window.** For 10 minutes after a free opening, anyone with the `planId` and the plugin key can read the owner token from `/v1/open-free`.
11. **Operator paging depends on configuration.** `alertOperator` (`web/lib/ops/alert.ts`) logs every alert and also posts it to `AWNING_OPS_WEBHOOK_URL` (Slack/Discord-compatible) and texts `AWNING_OPERATOR_PHONE` when those are set; with neither set, alerts are log lines only.
