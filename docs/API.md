# Awning API reference

Status: matches the code on `main` as of 2026-10-17 (`web/app/v1/**`, `web/app/x402/**`). Version string: `1.0.0` (`web/lib/env.ts`).

## Basics

- **Base URL:** `https://api.awning.sh` (`AWNING_API_URL`). Every path below is also served on every storefront host.
- **Format:** JSON in, JSON out, UTF-8. Request bodies are limited to 64 KiB; an empty body is treated as `{}`.
- **Money:** JSON endpoints give USD amounts as JSON numbers (`priceUsd: 11.08`), computed exactly from atomic USDC. Where an exact integer is needed, the field is a string of atomic USDC (6 decimals): `totalAtomic: "20080000"` = 20.08 USDC. x402 amounts are always atomic strings.
- **Chain and asset:** USDC on Base, `eip155:8453`, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, scheme `exact`.
- **Caching:** JSON responses are `cache-control: no-store`.

### Authentication

| Header | Who sends it | Required on |
|---|---|---|
| `x-awning-plugin-key: <secret>` | PayBox, as a brokered header for `api.awning.sh` | `POST /v1/plan`, `GET /v1/plans/:planId`, `POST /v1/open-free`, `POST /v1/businesses/:slug/offers`, `GET /v1/orders` |
| `x-awning-owner-token: awn_ot_…` | the owner's agent | `POST /v1/businesses/:slug/offers`, `GET /v1/orders` |
| `PAYMENT-SIGNATURE` or `X-PAYMENT` | PayBox, on the paid retry | the paid request to `/x402/*` |

x402 endpoints take no custom headers (PayBox does not send them on payment requests). If `AWNING_PLUGIN_KEY` is unset, plugin-key checks are skipped in development and answer `503 misconfigured` in production.

### Errors

Every error is JSON:

```json
{ "error": "plan_not_found", "message": "No plan pln_…" }
```

Some errors add fields (named per endpoint below). Common ones:

| Status | `error` | When |
|---|---|---|
| 400 | `invalid_json` | the body is not JSON |
| 400 | `invalid_request` | a field fails validation; `message` names the first failing field |
| 401 | `unauthorized` | missing or wrong `x-awning-plugin-key`; or no owner token |
| 403 | `forbidden` | an owner token was sent but is not valid for that business (also returned when the business does not exist) |
| 403 | `business_suspended` | the business is paused after reports or by an operator; nothing was charged |
| 410 | `business_unavailable` | `GET /v1/businesses/:slug` for a suspended business |
| 413 | `body_too_large` | body over 64 KiB |
| 422 | `policy_blocked` | the business or offer breaks the [acceptable use policy](legal/terms.md#6-acceptable-use); adds `category` |
| 429 | `rate_limited` | a per-wallet or per-reporter limit; `retry-after` header in seconds |
| 500 | `internal_error` | unexpected error; `message` contains an id like `err_m1x2y3` for the logs |
| 503 | `misconfigured` | a required server secret is missing |

Limits are per owner wallet (12 plans per hour, 3 free openings per day; `AWNING_PLAN_LIMIT_PER_HOUR`, `AWNING_FREE_OPENS_PER_DAY`), across all wallets (300 plans and 60 free openings per hour; `AWNING_GLOBAL_PLANS_PER_HOUR`, `AWNING_GLOBAL_FREE_OPENS_PER_HOUR`) and per reporter network (5 reports per day). There is no per-IP rate limiting of reads.

---

## `GET /v1/health`

Public. Asserts that the database answers and that money configuration is present.

```bash
curl -s https://api.awning.sh/v1/health
```

`200` when `ok`, `503` otherwise:

```json
{
  "ok": true,
  "version": "1.0.0",
  "lastOpenAt": "2026-10-17T14:02:11.000Z",
  "lastOrderAt": null,
  "checks": { "db": "ok (postgres)", "treasury": "ok", "pluginKey": "ok", "refunds": "ok", "pro": "available" },
  "facilitator": "https://facilitator.payai.network",
  "adapters": {
    "registrar": "porkbun",
    "hosting": "vercel",
    "telephony": "twilio",
    "receptionist": "elevenlabs",
    "drafter": "anthropic",
    "notifier": "twilio-sms",
    "refunder": "viem-usdc",
    "imager": "ai-gateway"
  }
}
```

A mock adapter shows as `"mock (mock-registrar)"`; refunds that cannot be made show as `"refunder": "mock (unavailable)"`. `ok` is false when the database fails, the treasury address is missing, the facilitator cannot be built, or (in production) the plugin key is missing.

| Check | Values |
|---|---|
| `db` | `ok (postgres)`, `ok (pglite)`, `ok (pglite-memory)`, or `error` (the detail is logged, not returned) |
| `treasury` | `ok` or `missing AWNING_TREASURY_ADDRESS` |
| `pluginKey` | `ok` or `missing AWNING_PLUGIN_KEY` |
| `refunds` | `ok` when the treasury key controls the treasury address, else `unavailable` |
| `pro` | `available`, `available (simulated payments)`, or `unavailable (<adapters>)` |

`facilitator` is the facilitator URL, `mock (no settlement)`, or `error`. After a health check that reached the database, the server runs the payment reconciler for up to 10 stale payments in the background.

## `POST /v1/plan`

Plugin key. Screens the sentence, drafts a business from it, screens the draft, prices three domains, prepares the Pro opening, and stores a draft business. No money moves and nothing is registered. `maxDuration` 30 s; designed to answer in under about 6.5 s. Two illustrative photos are generated after the response is sent.

Request:

| Field | Type | Rules |
|---|---|---|
| `sentence` | string | 3–600 characters |
| `ownerWallet` | string | EVM address, not the zero address; stored checksummed. Receives every sale |
| `ownerName` | string? | 1–80 |
| `ownerEmail` | string? | email, at most 200. Stored; not used for notifications yet |
| `ownerPhone` | string? | E.164 (`+15551234567`). Receives order SMS when Twilio is configured |
| `country` | string? | 2–56. A two-letter code picks the phone number country; anything else uses `US` |

```bash
curl -s -X POST https://api.awning.sh/v1/plan \
  -H "x-awning-plugin-key: $AWNING_PLUGIN_KEY" -H 'content-type: application/json' \
  -d '{"sentence":"Ridge Roast - small-batch coffee from Accra, ship bags and sell a $5 tasting session","ownerWallet":"0x52908400098527886E0F7030069857D2E4169EE7","country":"GH"}'
```

`201` (example; draft text varies, prices are Porkbun list prices of 2026-10-17):

```json
{
  "planId": "pln_0k3v9…",
  "expiresAt": "2026-10-17T15:30:00.000Z",
  "status": "quoted",
  "business": {
    "slug": "ridge-roast",
    "name": "Ridge Roast",
    "tagline": "Small-batch coffee from Accra",
    "description": "…",
    "category": "Coffee & Tea",
    "city": "Accra",
    "palette": { "primary": "#7A3E1D", "accent": "#E0A458", "ink": "#1E1410", "paper": "#FBF6EF" },
    "offers": [
      { "sku": "tasting-session", "title": "Tasting session", "description": "…", "priceUsd": 5, "kind": "booking" }
    ],
    "status": "draft"
  },
  "previewUrl": "https://ridge-roast.awning.sh",
  "domains": [
    { "domain": "ridgeroast.com", "available": true, "priceUsd": 11.08, "totalUsd": 20.08, "totalAtomic": "20080000" },
    { "domain": "ridgeroast.co", "available": true, "priceUsd": 15.76, "totalUsd": 24.76, "totalAtomic": "24760000" },
    { "domain": "ridgeroast.shop", "available": true, "priceUsd": 2.06, "totalUsd": 11.06, "totalAtomic": "11060000" }
  ],
  "recommendedDomain": "ridgeroast.com",
  "packages": [
    {
      "id": "free", "label": "Free", "priceUsd": 0, "available": true,
      "includes": ["Storefront at ridge-roast.awning.sh", "Listed in the Awning directory", "x402 checkout paid straight to your wallet"]
    },
    {
      "id": "pro", "label": "Pro", "priceUsd": 20.08, "domain": "ridgeroast.com", "available": true,
      "includes": ["Custom domain ridgeroast.com (first year)", "Phone line with an AI receptionist", "Everything in Free", "$9.00 first month of phone + receptionist"]
    }
  ],
  "openUrl": "https://api.awning.sh/x402/open/pln_0k3v9…"
}
```

- `domains[].totalUsd` / `totalAtomic` is the exact amount `/x402/open` charges for that domain (registrar first-year price + $9.00). Unavailable domains have `available: false`, `priceUsd: 0`, `totalUsd: null`, `totalAtomic: null`.
- The Pro package's `priceUsd` is the recommended domain's total, or `null` when no domain is available. When Pro cannot be sold, it has `available: false` and `unavailableReason`. With the mock facilitator it also has `simulated: true`.
- The draft is served at `previewUrl` immediately, marked as a preview.

Errors: `400 invalid_request`, `401`, `413`, `422 policy_blocked` (nothing is stored), `429 rate_limited`, `503 misconfigured`.

```json
{ "error": "policy_blocked", "category": "phishing",
  "message": "Awning can't open this: collecting passwords, wallet keys or recovery phrases aren't allowed on Awning (see the acceptable use policy at https://awning.sh/terms#acceptable-use). Nothing was created or charged." }
```

## `GET /v1/plans/:planId`

Plugin key. The same shape as `POST /v1/plan`, with the current `status` (`quoted`, `opening`, `opened`) and the business's current status.

```bash
curl -s https://api.awning.sh/v1/plans/pln_0k3v9… -H "x-awning-plugin-key: $AWNING_PLUGIN_KEY"
```

Errors: `404 plan_not_found`.

## `POST /v1/open-free`

Plugin key. Opens the plan's business on its free subdomain. No domain, no phone, no money. Idempotent by plan.

Request: `{ "planId": "pln_…" }` (4–64 characters).

```bash
curl -s -X POST https://api.awning.sh/v1/open-free \
  -H "x-awning-plugin-key: $AWNING_PLUGIN_KEY" -H 'content-type: application/json' \
  -d '{"planId":"pln_0k3v9…"}'
```

`200`:

```json
{
  "business": { "slug": "ridge-roast", "name": "Ridge Roast", "url": "https://ridge-roast.awning.sh", "domain": null, "phone": null, "status": "live", "package": "free" },
  "ownerToken": "awn_ot_Qm9…",
  "steps": [{ "name": "go_live", "status": "ok", "ms": 4 }]
}
```

If the business is already live, the answer is `200` with `"alreadyOpen": true` and `"steps": []`. The owner token is returned again only to a retry within 10 minutes of a free opening. Otherwise, and always for a Pro business, `ownerToken` is `null`:

```json
{
  "business": { "slug": "ridge-roast", "…": "…" },
  "ownerToken": null,
  "alreadyOpen": true,
  "steps": [],
  "message": "Ridge Roast is already open. Its owner token was returned when it opened and is not shown again."
}
```

The plan's expiry is not checked.

Errors: `404 plan_not_found`, `403 business_suspended`, `429 rate_limited` (3 free openings per wallet per day), `409 open_in_progress` (a Pro opening is running), `409 plan_not_openable`.

## `GET /v1/businesses`

Public, CORS `*`. Live businesses, newest opening first.

| Query | Meaning |
|---|---|
| `q` | up to 120 characters; up to 6 words, each must match (case-insensitive) the name, tagline, description, category, city, or an active offer's title or description |
| `category` | substring match on the category, up to 60 characters |
| `limit` | 1–100, default 20 |

```bash
curl -s 'https://api.awning.sh/v1/businesses?q=coffee%20accra&limit=5'
```

`200`:

```json
{
  "businesses": [
    {
      "slug": "ridge-roast",
      "name": "Ridge Roast",
      "tagline": "Small-batch coffee from Accra",
      "category": "Coffee & Tea",
      "city": "Accra",
      "url": "https://ridgeroast.com",
      "phone": "+1…",
      "offers": [{ "sku": "tasting-session", "title": "Tasting session", "priceUsd": 5, "kind": "booking" }],
      "openedAt": "2026-10-17T14:02:11.000Z",
      "salesCount": 0
    }
  ]
}
```

`phone` is present only when the business has one. `url` is the custom domain for live Pro businesses, otherwise the subdomain.

## `GET /v1/businesses/:slug`

Public, CORS `*`. One business with its active offers. Drafts are returned too (with `status: "draft"`).

```bash
curl -s https://api.awning.sh/v1/businesses/ridge-roast
```

`200`:

```json
{
  "business": {
    "slug": "ridge-roast",
    "name": "Ridge Roast",
    "tagline": "Small-batch coffee from Accra",
    "description": "…",
    "category": "Coffee & Tea",
    "city": "Accra",
    "url": "https://ridgeroast.com",
    "phone": "+1…",
    "domain": "ridgeroast.com",
    "status": "live",
    "package": "pro",
    "palette": { "primary": "#7A3E1D", "accent": "#E0A458", "ink": "#1E1410", "paper": "#FBF6EF" },
    "offers": [
      { "sku": "tasting-session", "title": "Tasting session", "description": "…", "priceUsd": 5, "kind": "booking",
        "buyUrl": "https://api.awning.sh/x402/b/ridge-roast/tasting-session" }
    ],
    "payTo": "0x52908400098527886E0F7030069857D2E4169EE7",
    "openedAt": "2026-10-17T14:02:11.000Z",
    "salesCount": 0
  }
}
```

`domain` is present only for Pro businesses; `phone` only when there is one. `payTo` is the owner's wallet, the recipient of every sale.

Errors: `404 business_not_found`, `410 business_unavailable` (suspended).

## `GET /v1/businesses/:slug/offers`

Public, CORS `*`.

```bash
curl -s https://api.awning.sh/v1/businesses/ridge-roast/offers
```

`200`: `{ "offers": [{ "sku", "title", "description", "priceUsd", "kind" }] }`. Errors: `404 business_not_found`, `410 business_unavailable` (suspended).

## `POST /v1/businesses/:slug/offers`

Plugin key and owner token. Adds an offer. It is on the storefront and buyable over x402 immediately.

| Field | Type | Rules |
|---|---|---|
| `title` | string | 2–60 characters |
| `description` | string? | at most 200; defaults to the title |
| `priceUsd` | number | a JSON number, whole cents, $0.01–$10,000 |
| `kind` | string | `product`, `service`, `booking`, `digital`, `subscription` |

```bash
curl -s -X POST https://api.awning.sh/v1/businesses/ridge-roast/offers \
  -H "x-awning-plugin-key: $AWNING_PLUGIN_KEY" -H "x-awning-owner-token: $OWNER_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"title":"Monthly coffee box","description":"Two 250 g bags each month, shipped.","priceUsd":30,"kind":"subscription"}'
```

`201`:

```json
{
  "offer": { "sku": "monthly-coffee-box", "title": "Monthly coffee box", "description": "Two 250 g bags each month, shipped.", "priceUsd": 30, "kind": "subscription",
             "buyUrl": "https://api.awning.sh/x402/b/ridge-roast/monthly-coffee-box" },
  "offers": [ { "sku": "tasting-session", "…": "…" }, { "sku": "monthly-coffee-box", "…": "…" } ]
}
```

The sku is derived from the title and made unique within the business (`-2`, `-3`, …). The owner token is checked before the body is parsed.

Errors: `401 unauthorized` (no owner token), `403 forbidden` (wrong token or unknown business), `403 business_suspended`, `422 policy_blocked` (title and description are screened), `400 invalid_request` (`priceUsd: price must be whole cents`, `priceUsd: price out of range ($0.01 – $10,000)`, field lengths).

## `GET /v1/orders?slug=`

Plugin key and owner token. Up to 100 orders for the business, newest first, in every status.

```bash
curl -s 'https://api.awning.sh/v1/orders?slug=ridge-roast' \
  -H "x-awning-plugin-key: $AWNING_PLUGIN_KEY" -H "x-awning-owner-token: $OWNER_TOKEN"
```

`200`:

```json
{
  "orders": [
    {
      "id": "ord_1x9…",
      "slug": "ridge-roast",
      "sku": "tasting-session",
      "qty": 1,
      "totalUsd": 5,
      "status": "paid",
      "createdAt": "2026-10-17T14:10:02.000Z",
      "paidAt": "2026-10-17T14:10:05.000Z",
      "tx": "0x…",
      "payer": "0x…",
      "buyerNote": "Saturday morning if possible",
      "buyerContact": null,
      "fulfillment": { "kind": "booking", "code": "RID-7K2Q9M", "url": "https://ridgeroast.com", "message": "Booking RID-7K2Q9M confirmed: …" }
    }
  ]
}
```

Order `status`: `pending`, `paid`, `failed`. Errors: `400 invalid_request` (no `slug`), `401`, `403`. An unknown business answers like a wrong token, so the endpoint does not reveal which slugs exist.

## `GET /v1/live`

Public, CORS `*`. Recent events for the `/live` feed, newest first.

| Query | Meaning |
|---|---|
| `limit` | 1–200, default 50 |

```bash
curl -s 'https://api.awning.sh/v1/live?limit=10'
```

`200`:

```json
{
  "events": [
    { "type": "order", "at": "2026-10-17T14:10:05.000Z", "slug": "ridge-roast", "name": "Ridge Roast", "amountUsd": 5, "tx": "0x…" },
    { "type": "opened", "at": "2026-10-17T14:02:11.000Z", "slug": "ridge-roast", "name": "Ridge Roast", "amountUsd": 20.08, "tx": "0x…" },
    { "type": "call", "at": "2026-10-17T14:20:40.000Z", "slug": "ridge-roast", "name": "Ridge Roast" }
  ]
}
```

`type` is `opened`, `order` or `call`; report and moderation events are never returned. A Free opening has `amountUsd: 0` and no `tx`. Call events are recorded only by the TwiML receptionist.

## `POST /v1/reports`

Public, CORS `*`. Reports a business. No account needed. The reporter is identified only by an HMAC of their network (IPv4 /24, IPv6 /48) and the UTC day; the IP is not stored. Several reports from one network count as one reporter.

| Field | Type | Rules |
|---|---|---|
| `slug` | string | 1–80 |
| `reason` | string | `phishing`, `impersonation`, `scam`, `prohibited`, `other` |
| `details` | string? | at most 1000 |
| `contact` | string? | at most 200, if the reporter wants a reply |

```bash
curl -s -X POST https://api.awning.sh/v1/reports -H 'content-type: application/json' \
  -d '{"slug":"ridge-roast","reason":"impersonation","details":"Uses the name of a bank"}'
```

`201`:

```json
{ "reportId": "rpt_…", "held": false,
  "message": "Thanks. A person reviews every report; checkout pauses automatically once 3 people report the same business." }
```

When reporters from three distinct networks report the same business within 24 hours, it is suspended and `held` is `true`. Errors: `404 business_not_found`, `429 rate_limited` (5 reports per reporter per day), `400 invalid_request`.

## `POST /v1/admin/businesses/:slug/status`

Operator only: `x-awning-admin-key` must equal `AWNING_ADMIN_KEY`. Disabled (`503 misconfigured`) when the key is not set.

Request: `{ "action": "suspend" | "restore", "reason": string (3–500) }`

```bash
curl -s -X POST https://api.awning.sh/v1/admin/businesses/ridge-roast/status \
  -H "x-awning-admin-key: $AWNING_ADMIN_KEY" -H 'content-type: application/json' \
  -d '{"action":"suspend","reason":"phishing report confirmed"}'
```

`200`: `{ "slug": "ridge-roast", "status": "suspended" }`. Restoring returns the business to `live` if it had opened, otherwise to `draft`. Each action is recorded as an internal `moderation` event. Suspending detaches the business's phone number from its AI receptionist; restoring re-attaches it (best effort: a provider error is logged and does not block the action). Errors: `401 unauthorized`, `404 business_not_found`, `400 invalid_request`.

## `GET /img/:id`

Public. A generated storefront photo (`image/webp`, 1024×768), `cache-control: public, max-age=31536000, immutable`, `etag`. `404` for unknown ids and for photos of suspended businesses (CDN copies cached earlier can outlive a suspension). An optional `.webp` suffix is accepted.

## `GET /v1/cron/reconcile`

Cron only: `Authorization: Bearer <CRON_SECRET>`. Disabled (`503 misconfigured`) when `CRON_SECRET` is not set. Finishes payments that a request left in `working` or `unconfirmed` for more than 3 minutes, using the on-chain `authorizationState` ([ARCHITECTURE.md](ARCHITECTURE.md#reconciler) has the state table). Called daily by Vercel cron and every 10 minutes by the `reconcile payments` GitHub workflow. `maxDuration` 60 s.

```bash
curl -s https://api.awning.sh/v1/cron/reconcile -H "Authorization: Bearer $CRON_SECRET"
```

`200`:

```json
{ "reconciled": 1, "outcomes": [{ "key": "eip155:8453:0x8335…:0x…:0x…", "from": "working", "to": "failed", "note": "money did not move" }] }
```

Errors: `401 unauthorized`, `503 misconfigured`.

## `POST /v1/voice/:slug`

Twilio's voice webhook (form-encoded), used when no ElevenLabs agent is attached to the number. When `TWILIO_AUTH_TOKEN` is set, `X-Twilio-Signature` must match ([Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)), otherwise `403`. The response is TwiML that greets the caller with the receptionist's name, reads the tagline and up to four offers with prices, and gives the website. A business that is not live gets "this number is not in service yet". Each call records a `call` event.

---

## x402 endpoints

Both endpoints follow the same flow. PayBox drives it: it fetches the unpaid 402, compares it with the proposal, asks the user to approve, then sends the paid retry with the signed payment. `maxDuration` is 90 s.

CORS: every x402 response (402, errors, replays, paid answers) carries `access-control-allow-origin: *` and `access-control-expose-headers: PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE`. `OPTIONS` answers `204` with `access-control-allow-methods: GET, POST, OPTIONS`, `access-control-allow-headers: content-type, payment-signature, x-payment` and `access-control-max-age: 86400`.

### `POST /x402/open/:planId`

Opens the plan's business on Pro: custom domain, phone number, AI receptionist.

| | |
|---|---|
| Body | `{ "domain"?: string, "package"?: "pro" }`. `domain` defaults to the plan's `recommendedDomain`; `?domain=` also works |
| Amount | the plan's `totalAtomic` for that domain |
| `payTo` | `AWNING_TREASURY_ADDRESS` |
| `GET` | returns the same 402 (domain from `?domain=`) |

Answers before any 402 is issued:

| Status | `error` | When | Extra fields |
|---|---|---|---|
| 404 | `plan_not_found` | unknown plan | |
| 403 | `business_suspended` | the business is under review | |
| 503 | `misconfigured` | no treasury address | |
| 503 | `pro_unavailable` | a Pro provider is mocked while payments are real | `missing: ["telephony", …]` |
| 409 | `no_domain_available` | none of the plan's domains is available | |
| 400 | `domain_not_offered` | the domain is not one of the plan's | `domains: [...]` |
| 409 | `domain_unavailable` | the domain is marked unavailable | |
| 409 | `already_open` | unpaid request for a plan already open on Pro | `business: {...}` |
| 410 | `quote_expired` | unpaid request after `expiresAt` | `expiresAt` |

The 402 body's `awning` quote:

```json
{
  "planId": "pln_0k3v9…",
  "business": "Ridge Roast",
  "domain": "ridgeroast.com",
  "package": "pro",
  "totalUsd": 20.08,
  "breakdown": { "domainUsd": 11.08, "serviceUsd": 9 },
  "expiresAt": "2026-10-17T15:30:00.000Z",
  "guarantee": "You are charged only if the business opens. If anything fails, the payment is never settled."
}
```

Paid outcomes:

| Status | Body | Settled? |
|---|---|---|
| 200 | `{business: {slug, name, url, domain, phone, status: "live", package: "pro"}, ownerToken, receipts: {paidUsd, tx, payer, network, settlement: "confirmed" \| "unconfirmed"}, steps: [{name, status, ms}], simulated?: [...]}` | yes |
| 200 | `{alreadyOpen: true, charged: false, business, ownerToken?, receipts: {paidUsd, tx}, message}`; `ownerToken` only if the payer is the original payer | no |
| 402 | fresh challenge with `error` naming the mismatch or verification failure | no |
| 402 | `{error: "settlement_failed", message, charged: false, refunded: false}` with a `PAYMENT-REQUIRED` header | no |
| 409 | `{error: "open_in_progress", charged: false, refunded: false}`, `retry-after: 3`; the payment key is released | no |
| 409 | `{error: "payment_in_progress", charged: false}`, `retry-after: 3` | not by this request |
| 500 | `{error: "work_failed", charged: false, refunded: false}` | no |
| 502 | `{error: "provisioning_failed", message, failedStep, charged: false, refunded: false, steps}`; `message` names the failed step, never the provider's error | no |
| 502 | `{refunded: true, refundTx, reason, charged: true, paidUsd, tx}`; `reason` is the fixed sentence "Your payment settled but the result could not be recorded." | yes, then refunded |
| 502 | `{refunded: false, reason, charged: true, paidUsd, tx, message}`: the automatic refund could not be sent (or refunds are unavailable) and the operator has been alerted | yes; refund pending |
| 503 | `{error: "work_interrupted", charged: false, refunded: false}`: a replay after the reconciler found that an interrupted request never took the payment | no |

### `POST /x402/b/:slug/:sku`

Buys `qty` of an offer. Paid straight to the owner's wallet.

| | |
|---|---|
| Body | `{ "qty"?: 1–100, "buyerNote"?: string (≤500), "buyerContact"?: string (≤200) }`. `?qty=` also works; if both are given they must agree. Note and contact are stored as one plain line: control characters and line breaks become spaces |
| Amount | offer price × qty |
| `payTo` | the owner's wallet |
| `GET` | returns the same 402 (`?qty=` sets the quantity) |

Answers before any 402: `404 business_not_found`, `403 business_suspended`, `409 business_not_open` (draft), `404 offer_not_found` (unknown or inactive sku), `400 invalid_request` (qty).

The 402 body's `awning` quote:

```json
{
  "slug": "ridge-roast", "business": "Ridge Roast", "sku": "tasting-session", "title": "Tasting session",
  "qty": 1, "unitUsd": 5, "totalUsd": 5, "payTo": "0x52908400098527886E0F7030069857D2E4169EE7",
  "note": "Paid directly to the business owner's wallet. Charged only once the order is recorded."
}
```

Paid outcomes:

| Status | Body |
|---|---|
| 200 | `{order: {id, slug, sku, qty, totalUsd, status: "paid"}, receipt: {tx, payer, payTo, network, settlement}, fulfillment: {kind, message, code, url}}` |
| 402 | fresh challenge with the reason; or `settlement_failed` with `charged: false` |
| 409 | `payment_in_progress` |
| 500 | `work_failed`, `charged: false` |
| 502 | `{error: "delivery_failed", message, charged: true, refunded: false, tx}`: the payment settled to the owner but the order could not be recorded |
| 503 | `{error: "work_interrupted", charged: false}`: replay after the reconciler found an interrupted request never took the payment |

`fulfillment.message` depends on the offer kind (product, service, booking, digital, subscription) and includes the confirmation code, for example *"Booking RID-7K2Q9M confirmed: Tasting session. Ridge Roast will confirm the time with you. Quote RID-7K2Q9M when you arrive."* Subscriptions say renewals are separate payments and nothing is charged automatically.

### The x402 exchange, header by header

**1. Unpaid request.**

```bash
curl -si -X POST https://api.awning.sh/x402/b/ridge-roast/tasting-session \
  -H 'content-type: application/json' -d '{"qty":1}'
```

```
HTTP/2 402
content-type: application/json
cache-control: no-store, private
access-control-allow-origin: *
access-control-expose-headers: PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE
payment-required: eyJ4NDAyVmVyc2lvbiI6Mi…
```

`PAYMENT-REQUIRED` is base64 JSON (x402 v2):

```json
{
  "x402Version": 2,
  "resource": {
    "url": "https://api.awning.sh/x402/b/ridge-roast/tasting-session",
    "description": "1 × Tasting session from Ridge Roast",
    "mimeType": "application/json",
    "serviceName": "Awning"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "amount": "5000000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x52908400098527886E0F7030069857D2E4169EE7",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "USD Coin", "version": "2" }
  }]
}
```

Decode it with `… | grep -i '^payment-required:' | cut -d' ' -f2 | tr -d '\r' | base64 -d`.

The body is the same terms in x402 v1 form, plus the `awning` quote:

```json
{
  "x402Version": 1,
  "error": "payment_required",
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "5000000",
    "resource": "https://api.awning.sh/x402/b/ridge-roast/tasting-session",
    "description": "1 × Tasting session from Ridge Roast",
    "mimeType": "application/json",
    "outputSchema": {},
    "payTo": "0x52908400098527886E0F7030069857D2E4169EE7",
    "maxTimeoutSeconds": 300,
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "extra": { "name": "USD Coin", "version": "2" }
  }],
  "awning": { "…": "the quote above" }
}
```

The unpaid request writes nothing and calls no provider.

**2. Paid retry.** The same method, URL and body, plus one header:

- v2: `PAYMENT-SIGNATURE: <base64 JSON>` with `{x402Version: 2, accepted: <one entry of accepts>, payload: {signature, authorization}}`
- v1: `X-PAYMENT: <base64 JSON>` with `{x402Version: 1, scheme: "exact", network: "base", payload: {signature, authorization}}`

`authorization` is an EIP-3009 `transferWithAuthorization`: `{from, to, value, validAfter, validBefore, nonce}`, signed against the USDC-on-Base EIP-712 domain (`name: "USD Coin"`, `version: "2"`, chain 8453). `to` must equal `payTo`, `value` must equal the amount, `nonce` is 32 random bytes.

**3. Paid response.** `200` with the body above and:

```
PAYMENT-RESPONSE: <base64 JSON {success, transaction, network, payer}>
X-PAYMENT-RESPONSE: <same value>
```

Sending the same payment header again returns the stored response with the same status, body and headers.

To pay from the command line against a local server with the mock facilitator, see `web/scripts/pay.mjs` and [`web/README.md`](../web/README.md#testing-paid-flows-locally).
