# Awning web — API, x402 seller, opening orchestrator, storefronts

One Next.js 15 app (App Router, TypeScript strict) serves everything:

- **API** under `/v1/*` and **x402 endpoints** under `/x402/*` on every host (`api.awning.sh` maps to the same project).
- **Storefronts** for every business: `<slug>.awning.sh`, the owner's custom domain, or `localhost:3000/?b=<slug>` in development.
- **Root pages** on `awning.sh`: `/` (landing placeholder), `/live` (event feed, polls every 3 s), `/directory`.

The PayBox plugin (`plugin/`) talks to this API. PayBox pays the x402 endpoints for the user.

## Quick start

```bash
cd web
npx pnpm@11.11.0 install
cp ../.env.example ../.env       # fill AWNING_* (see below); everything else may stay empty
npx pnpm@11.11.0 dev             # http://localhost:3000
npx pnpm@11.11.0 test            # vitest (in-memory PGlite, mock providers, local facilitator)
npx pnpm@11.11.0 build
```

Requirements: Node 24, pnpm 11.11.0. Secrets live in the **repo-root** `.env`, which `next.config.ts` loads
(values already in the environment win). With no `DATABASE_URL`, an embedded Postgres (PGlite) lives in
`web/.data/pglite` and migrates itself.

Try it:

```bash
KEY=...   # your AWNING_PLUGIN_KEY
curl -s -X POST localhost:3000/v1/plan -H "x-awning-plugin-key: $KEY" -H 'content-type: application/json' \
  -d '{"sentence":"Start a business: Ridge Roast - small-batch coffee from Accra, sell a $5 tasting session","ownerWallet":"0x52908400098527886E0F7030069857D2E4169EE7"}'
open "http://localhost:3000/?b=ridge-roast"                       # draft storefront ("Preview — not open yet")
curl -si -X POST localhost:3000/x402/open/<planId> -d '{"domain":"ridgeroast.com","package":"pro"}'   # 402 quote
```

## Environment

Full list with comments: [`../.env.example`](../.env.example). Every provider is optional — a missing key selects a
**mock** adapter and the server logs `MOCK <adapter>: <why>` once. `GET /v1/health` shows which adapters are real.

| Variable | Purpose | Missing → |
|---|---|---|
| `AWNING_API_URL` | Public API origin used in x402 resource URLs and buy links | `https://api.awning.sh` |
| `AWNING_TREASURY_ADDRESS` | payTo for Pro openings | `/x402/open` answers 503 |
| `AWNING_TREASURY_PRIVATE_KEY` | Refunds (post-settlement failures); Porkbun USDC payments | refunds simulated |
| `AWNING_PLUGIN_KEY` | Required `x-awning-plugin-key` header on plugin endpoints | auth disabled (dev only; 503 in production) |
| `AWNING_OWNER_TOKEN_SECRET` | HMAC key for owner tokens | dev-only fallback secret (refused in production) |
| `AWNING_ROOT_DOMAIN` | Free storefront domain | `awning.sh` |
| `AWNING_FACILITATOR_URL` | x402 `/verify` + `/settle` | PayAI `https://facilitator.payai.network`; `mock` = local signature check, no settlement (dev/test only) |
| `BASE_RPC_URL` | Refund transfers, on-chain `authorizationState` checks | `https://mainnet.base.org` |
| `DATABASE_URL` | Neon/Postgres (`@neondatabase/serverless`, drizzle) | PGlite in `web/.data/` |
| `ANTHROPIC_API_KEY`, `AWNING_LLM_MODEL`, `AWNING_LLM_TIMEOUT_MS` | Business drafts (`claude-sonnet-5-5`, forced tool call → strict JSON, validated and normalised); domain checks run in parallel; over budget (default 4500 ms; the whole plan stays under ~6.5 s because the plugin waits 8 s) or on error → template | deterministic template drafter |
| `PORKBUN_API_KEY`, `PORKBUN_SECRET_KEY`, `PORKBUN_PAY_WITH` | Availability/price, registration, DNS (`credit` or `usdc` over x402) | deterministic mock registrar with snapshot prices |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Attach custom domains to the project | mock hosting |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Buy local numbers, TwiML receptionist, owner SMS | fictional `+1 202 555 01xx` numbers, logged notifications |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Conversational AI receptionist on the Twilio number | TwiML receptionist (`/v1/voice/:slug`) answers |
| `AWNING_PLAN_TTL_SECONDS` | Quote lifetime | 1800 |
| `AWNING_OPEN_DEADLINE_MS` | Provisioning budget before settlement | 14000 |
| `AWNING_FORCE_MOCKS=1` | Force every adapter to its mock | — |

Responses that used mocks say so: a Pro open lists `simulated: [...]`.

**Real money never buys simulated provisioning.** With a real facilitator, Pro is offered only when the registrar,
hosting, telephony and receptionist adapters are all real; otherwise the plan's `packages[pro]` says
`available: false` with the reason, and `/x402/open` answers `503 pro_unavailable {missing}` without a challenge. The free
path and sales (paid to the owner) work in every configuration. For fully mocked local runs, use the local facilitator
(`AWNING_FACILITATOR_URL=mock`), under which no money moves.

## Endpoints

Auth: plugin endpoints need `x-awning-plugin-key` (PayBox injects it as a brokered header). Owner endpoints also need
`x-awning-owner-token: awn_ot_…` for that business. x402 endpoints take no custom headers (PayBox can't send them);
the unpaid request is a quote and **never has side effects** — no DB writes, no provider calls.

### JSON

| Method & path | Auth | Returns |
|---|---|---|
| `GET /v1/health` | public | `{ok, version, lastOpenAt, lastOrderAt, checks, facilitator, adapters}`; 503 when not ok |
| `POST /v1/plan` `{sentence (≤600), ownerWallet, ownerName?, ownerEmail?, ownerPhone? (E.164, for order SMS), country?}` | plugin | `{planId, expiresAt, status, business{slug,name,tagline,description,category,city?,palette,offers[],status:"draft"}, previewUrl, domains[{domain, available, priceUsd, totalUsd, totalAtomic}], recommendedDomain, packages[{id,label,includes,priceUsd}], openUrl}` (201) |
| `GET /v1/plans/:planId` | plugin | same shape, current status |
| `POST /v1/open-free` `{planId}` | plugin | `{business{slug,name,url,domain:null,phone:null,status:"live",package:"free"}, ownerToken, steps}`; idempotent (`alreadyOpen: true`, same token) |
| `GET /v1/businesses?q=&category=&limit=` | public | `{businesses:[{slug,name,tagline,category,city,url,phone?,offers[{sku,title,priceUsd,kind}],openedAt,salesCount}]}` (live only; `q` also searches offers) |
| `GET /v1/businesses/:slug` | public | `{business:{…, offers[{…, buyUrl}], payTo, status, package}}` |
| `GET /v1/businesses/:slug/offers` | public | `{offers}` |
| `POST /v1/businesses/:slug/offers` `{title, description, priceUsd, kind}` | plugin + owner | `{offer{…, buyUrl}, offers}` (201) — live and buyable immediately |
| `GET /v1/orders?slug=` | plugin + owner | `{orders:[{id, slug, sku, qty, totalUsd, status, createdAt, paidAt, tx, payer, buyerNote, buyerContact, fulfillment}]}` |
| `GET /v1/live` | public | `{events:[{type:"opened"|"order"|"call", at, slug, name, amountUsd?, tx?}]}` |
| `POST /v1/voice/:slug` | Twilio signature | TwiML receptionist (used when no ElevenLabs agent is attached) |

`plan.domains[].totalUsd` is the exact Pro price for that domain (registrar first-year price + $9.00 first month of
phone + receptionist) and is precisely what `/x402/open` charges; `totalAtomic` is the same in USDC atomic units
(6 decimals) — use it as the PayBox proposal's `maxAmount`. Taken domains have `available: false, totalUsd: null`.

### x402 (USDC on Base `eip155:8453`, asset `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, scheme `exact`)

| Method & path | Body | Price / payTo | Paid response (200) |
|---|---|---|---|
| `POST /x402/open/:planId` | `{domain?, package?: "pro"}` (domain defaults to `recommendedDomain`; `?domain=` also works) | the plan's quoted `totalAtomic` for that domain → `AWNING_TREASURY_ADDRESS` | `{business{slug,name,url,domain,phone,status:"live",package:"pro"}, ownerToken, receipts{paidUsd, tx, payer, network, settlement}, steps[{name,status,ms}]}` |
| `POST /x402/b/:slug/:sku` | `{qty? (1–100), buyerNote?, buyerContact?}` (`?qty=` also works) | offer price × qty → **the owner's wallet** | `{order{id,slug,sku,qty,totalUsd,status:"paid"}, receipt{tx,payer,payTo,network,settlement}, fulfillment{kind,message,code,url}}` |

Both also answer `GET` with the same 402 quote for clients that probe with GET.

**Unpaid → 402.** The `PAYMENT-REQUIRED` header is base64 JSON `{x402Version: 2, resource, accepts:[{scheme:"exact",
network:"eip155:8453", amount, asset, payTo, maxTimeoutSeconds: 300, extra:{name:"USD Coin", version:"2"}}]}`. The JSON
body is the x402 **v1** form of the same terms (`x402Version: 1`, `accepts[].maxAmountRequired`, `network: "base"`) plus a
readable `awning` quote, so v1 clients can pay too.

**Paid retry.** `PAYMENT-SIGNATURE` (v2) or `X-PAYMENT` (v1), EIP-3009 `transferWithAuthorization` payloads:

1. **Replay first.** The idempotency key is the authorization itself (`network:asset:payer:nonce`); a signed authorization
   can settle at most once on chain. A key we have seen returns its stored response byte-for-byte (same order, same
   receipt). A key still in flight gets `409 payment_in_progress`.
2. **Exact match.** scheme, network, asset, amount and payTo must equal the live quote — in the declared terms *and* inside
   the signed authorization — and the authorization must be inside its validity window. Otherwise: a fresh 402 with the reason.
3. **Verify** with the facilitator (`/verify`), then claim the key (unique insert — concurrent duplicates lose).
4. **Work** (open: the provisioning saga; buy: record the order). Nothing here moves the customer's money.
5. **Settle only after the work succeeded** (`/settle`). If the facilitator's answer is not a clean success, USDC's
   on-chain `authorizationState(payer, nonce)` decides whether money moved. Then commit (business live / order paid),
   emit the `/live` event, notify the owner, respond with `PAYMENT-RESPONSE` (and `X-PAYMENT-RESPONSE`).

**Pay only on success.** If the work fails, the authorization is never settled: the response is an error with
`charged: false` (open: `502 provisioning_failed` with the step list) and the payer keeps their USDC. If settlement fails,
the work is undone and a 402 says why. If a failure is discovered *after* settlement (the final commit fails), the work
is compensated and the payer is refunded from the treasury: `502 {refunded: true, refundTx, reason}`. Order payments go
to the owner's wallet, which Awning never controls, so they are settled only after the order is recorded.

**Open is idempotent by plan.** Once a plan is open, an unpaid request gets `409 already_open` (no challenge to pay), and
any other valid payment for it is answered `alreadyOpen: true, charged: false` without settling; the original payer
(proven by their signature) gets the owner token back. A free business can be upgraded to Pro with the same plan.

**Expiry.** Unpaid requests after `expiresAt` → `410 quote_expired` (create a new plan). Paid retries get a 5-minute grace
(the PayBox proposal lifetime) so a payment signed just before expiry still completes.

## Opening orchestrator (Pro)

`lib/orchestrator/machine.ts` runs steps in order with per-step timing, a shared deadline and reverse-order
compensation. Everything slow is pre-computed at plan time (draft, domain prices, phone number candidates, receptionist
prompt, DNS records), so the paid retry only provisions.

| Step | Provider | Undo |
|---|---|---|
| `preflight` | registrar: domain still available at the quoted price | — |
| `phone` | Twilio: buy a local number (voice webhook → `/v1/voice/:slug`) | release number |
| `receptionist` | ElevenLabs: create the agent from the business's facts and offers | delete agent |
| `connect_phone` | ElevenLabs: import the Twilio number with the agent (skipped when either side is a mock) | delete import |
| `hosting` | Vercel: add `domain` + `www.domain` (308 → apex) to the project | remove domains |
| `register_domain` | Porkbun: register at exactly the quoted cents, `Idempotency-Key` per plan+domain | irreversible — ordered last |
| `dns` | Porkbun: clear parking records, `A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com` (1 retry) | — |
| `go_live` | DB: business live, plan opened, `opened` event (after settlement) | — |

## Storefronts and host routing

`middleware.ts` (pure logic in `lib/host.ts`) rewrites `/` to `/s/<slug>` for `<slug>.awning.sh` and `<slug>.localhost`,
to `/s/<domain>` for custom domains (the page looks the domain up), and for `?b=<slug>` on root hosts. `/v1/*`, `/x402/*`
and assets pass through on every host. `app/s/[slug]/page.tsx` renders a draft or live business with its palette: hero,
offers with prices, a "Buy with your AI agent" box (the prompt to give an agent with PayBox, plus the x402 URL), the
phone line, and the footer "Opened with Awning". Drafts show a "Preview — not open yet" ribbon and are `noindex`.

## Data

Drizzle schema in `lib/db/schema.ts`; migrations in `drizzle/` (committed). Tables: `plans`, `businesses`, `offers`,
`orders`, `events`, `payments` (one row per accepted authorization: the idempotency key, status
`working → settled | failed | superseded | refunded | unconfirmed`, and the stored response). Amounts are atomic USDC
(`bigint`); all money math is in `lib/money.ts` with no floating point.

- Generate a migration after a schema change: `npx pnpm@11.11.0 db:generate`
- Apply to Neon: `npx pnpm@11.11.0 db:migrate` (the app also auto-migrates on first connection unless `AWNING_AUTO_MIGRATE=0`)

## Testing paid flows locally

The test suite signs real EIP-3009 authorizations with throwaway keys and runs every route handler against an
in-memory database. It covers: quote math, the 402 amount = the quote, unpaid requests leaving no trace anywhere,
same payment twice → one order and one settlement, forged/mismatched payments, failures before settlement moving no
money (with compensation of every completed step), settlement failures, refunds for failures after settlement, owner-token
auth, host routing and the template drafter.

To click through by hand, run a second instance with the local facilitator and pay with the buyer script:

```bash
AWNING_NEXT_DIST=.next-mock AWNING_FACILITATOR_URL=mock AWNING_PGLITE_DIR=.data/pglite-mock \
AWNING_API_URL=http://localhost:3001 npx pnpm@11.11.0 dev --port 3001
node scripts/pay.mjs http://localhost:3001/x402/open/<planId> '{"domain":"ridgeroast.com","package":"pro"}' --yes --ephemeral
node scripts/pay.mjs http://localhost:3001/x402/b/<slug>/<sku> '{"qty":2}' --yes --ephemeral
```

Against the real facilitator, `BUYER_PRIVATE_KEY` (a wallet with USDC on Base) and `--max <usd>` make `pay.mjs` a real
buyer: it signs only the quoted amount and refuses anything above the cap.

## Deploying (Vercel)

- Project root `web/`, Node 24. Set the env vars above (Production). `DATABASE_URL` → Neon.
- Domains: `awning.sh`, `www.awning.sh`, `api.awning.sh`, and the wildcard `*.awning.sh` (needs Vercel nameservers).
  Custom business domains are attached by the orchestrator through the Vercel API.
- `/x402/*` and `/v1/plan` set `maxDuration = 30`.
- The mock facilitator refuses to start when `VERCEL_ENV=production`.
