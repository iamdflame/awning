# Awning PayBox plugin

Status: matches `plugin/` on `main` as of 2026-10-17. MCP server name `awning`, version `1.0.0`, protocol `2026-07-28`, built from PayBox starter 1.0.2.

## Hosted configuration

Set these in the PayBox developer portal (**Test & configure**, **Variables & Secrets**).

| Setting | Value |
|---|---|
| Network host | `api.awning.sh`, the only host the plugin calls |
| Brokered secret | host `api.awning.sh`, header `x-awning-plugin-key`, value = the server's `AWNING_PLUGIN_KEY` |
| Environment variable (optional) | `AWNING_API_URL`, default `https://api.awning.sh`; must be a plain `https://` URL |

The plugin never reads the plugin key and never sets that header; PayBox adds it at egress. x402 payment requests carry no custom headers, and Awning's x402 endpoints do not need the key.

## Behaviour common to every tool

- No network access at startup or during tool discovery.
- Each API request: 4 s timeout (8 s for `awning_plan`), `redirect: "error"`, JSON only, responses over 1,000,000 characters refused.
- Failures return `isError: true` with one sentence that says what to do next, quoting the API's human `message` when there is one (at most 200 characters). No headers, tokens or raw upstream bodies are returned in errors.
- Policy answers have their own wording: `policy_blocked` tells the agent to tell the user plainly and not to rephrase the request to get around the policy; `business_suspended` and `business_unavailable` say the business is paused for review and nothing was charged; `rate_limited` passes the limit on.
- Money is decimal strings and `BigInt` atomic USDC, never floating point. Prices are returned as `priceUsd: "19.99"` together with `priceAtomicUsdc: "19990000"`.
- Input and output schemas are strict (`additionalProperties: false`), including nested objects.
- API responses are read with lenient schemas (unknown fields dropped), then mapped to the strict output.

## Tools

| Tool | Title | readOnly | destructive | idempotent | openWorld | Money |
|---|---|:-:|:-:|:-:|:-:|---|
| `awning_about` | About Awning | true | false | true | false | none |
| `awning_plan` | Plan a business from one sentence | false | false | false | true | none |
| `awning_open_free` | Open a planned business for free | false | false | false | true | none |
| `awning_open` | Open a business with a custom domain (paid) | false | false | false | true | x402 proposal, payTo = Awning treasury |
| `awning_find` | Find Awning businesses | true | false | true | true | none |
| `awning_business` | Read an Awning business | true | false | true | true | none |
| `awning_buy` | Buy from an Awning business (paid) | false | false | false | true | x402 proposal, payTo = the owner's wallet |
| `awning_add_offer` | Add an offer to your business | false | false | false | true | none |
| `awning_orders` | List your business's orders | true | false | true | true | none |

### `awning_about`

- **Use when** the agent is unsure how to start a business or buy from one. Static: no network.
- **Input** `{}`
- **Output** `{name: "Awning", version, summary, apiHost: "api.awning.sh", payments: {chain: "eip155:8453", asset, symbol: "USDC"}, tools: [{name, use, cost}], flows: {open: [...], buy: [...], manage: [...]}}`
- This is the conformance sample call.

### `awning_plan`

- **Use when** the user wants to start a business. Call once per idea; every call creates a new draft.
- **Input**

| Field | Type | Rules |
|---|---|---|
| `sentence` | string | trimmed, 8–600 characters: what it sells, to whom, where |
| `ownerWallet` | string | `0x` + 40 hex; the Base wallet that receives every sale |
| `ownerName` | string? | 1–100 |
| `ownerEmail` | string? | email, at most 254 |
| `country` | string? | 2–56, e.g. `"GH"` |

- **Calls** `POST /v1/plan` (8 s timeout).
- **Output** `{planId, expiresAt, previewUrl, business: {slug, name, tagline, description, category, city, palette, offers: [offer]}, domains: [{domain, available, domainPriceUsd, openPriceUsd}], packages: [{id, label, includes, priceUsd}]}` where `offer` = `{sku, title, description, priceUsd, priceAtomicUsdc, kind}`.
- `openPriceUsd` is the total to pass to `awning_open`: Awning's per-domain `totalUsd`, or Pro package + domain price if the API does not give one; `null` for unavailable domains.
- **Money:** none. Nothing is registered; the draft is neither listed nor buyable.

### `awning_open_free`

- **Use when** the user agreed to open on the free `awning.sh` subdomain.
- **Input** `{planId}` (1–128 characters, letters, digits, `_`, `-`)
- **Calls** `POST /v1/open-free`.
- **Output** `{business: {slug, name, url, status}, ownerToken}`. The text output also shows the owner token so the agent can hand it to the user.
- **Money:** none.

### `awning_open` (paid)

- **Use when** the user chose a custom domain from the plan and agreed to its price.
- **Input**

| Field | Type | Rules |
|---|---|---|
| `planId` | string | as above |
| `domain` | string | lowercased; one of the plan's domains with `available: true` |
| `priceUsd` | string or number | the `openPriceUsd` the user agreed to, e.g. `"20.08"` |

- **Calls**, in parallel: `GET /v1/plans/:planId` and the unpaid `POST /x402/open/:planId` with `{domain, package: "pro"}` (a quote with no side effects).
- **Refuses** (no proposal) when the plan is unknown, expired or not a draft; the domain is not in the plan or not available; the plan has no Pro package; the 402 offers no USDC-on-Base `exact` requirement; `priceUsd` differs from the quote (the error names the right price); or less than 60 s would be left to approve.
- **Output** one x402 proposal:

```json
{
  "io.paybox/transactionProposal": {
    "version": "1",
    "kind": "x402",
    "expiresAt": "2026-10-17T15:06:00Z",
    "chain": "eip155:8453",
    "request": {
      "url": "https://api.awning.sh/x402/open/<planId>",
      "method": "POST",
      "body": { "domain": "ridgeroast.com", "package": "pro" }
    },
    "payment": { "asset": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "maxAmount": "20080000" }
  }
}
```

- **Money:** the user approves `maxAmount` in PayBox; payTo is the Awning treasury. `expiresAt` is a whole-second UTC time at most 4 minutes away, or the plan's expiry if sooner. If the 402 could not be read, the stored plan price is used and PayBox still checks the live 402 before approval.
- **After approval** the paid response arrives through the PayBox request: `{business: {slug, name, url, domain, phone, status: "live", package: "pro"}, ownerToken, receipts, steps}`, or `{refunded: true, refundTx, reason}`, or `{error: "provisioning_failed", charged: false, …}`. Poll the request; do not call `awning_open` again.

### `awning_find`

- **Use when** the user wants to buy something or browse.
- **Input** `{query? (≤120), category? (1–40), limit? (1–25, default 10)}`
- **Calls** `GET /v1/businesses?q=&category=&limit=`.
- **Output** `{count, businesses: [business]}` where `business` = `{slug, name, tagline, description, category, city, url, phone, domain, status, openedAt, salesCount, offers: [offer]}`.
- **Money:** none.

### `awning_business`

- **Use when** confirming exactly what the user is buying.
- **Input** `{slug}` (1–63, lowercase letters, digits, hyphens)
- **Calls** `GET /v1/businesses/:slug`.
- **Output** `{business}` (same shape as one `awning_find` entry).
- **Money:** none.

### `awning_buy` (paid)

- **Use when** the user confirmed the item, quantity and total.
- **Input**

| Field | Type | Rules |
|---|---|---|
| `slug` | string | as above |
| `sku` | string | 1–64; letters, digits, `.`, `_`, `-` |
| `qty` | integer? | 1–100, default 1 |
| `buyerNote` | string? | 1–500, shared with the owner |
| `buyerContact` | string? | 3–200, only if the user agreed to share it |

- **Calls**, in parallel: `GET /v1/businesses/:slug` and the unpaid `POST /x402/b/:slug/:sku` with the same body.
- **Refuses** when the business is not `live`, the sku does not exist, the offer is free, the 402 offers no USDC-on-Base requirement, or the live checkout amount differs from price × qty.
- **Output** one x402 proposal: `POST https://api.awning.sh/x402/b/<slug>/<sku>` with body `{qty, buyerNote?, buyerContact?}`, `maxAmount` = price × qty in atomic USDC, expiry at most 4 minutes.
- **Money:** payTo is the owner's wallet; the text names it when the 402 was read. Each approved proposal is a separate order, so never call `awning_buy` again to check on one.
- **After approval** the paid response arrives through the PayBox request: `{order: {id, slug, sku, qty, totalUsd, status: "paid"}, receipt: {tx, payer, payTo, network, settlement}, fulfillment: {kind, message, code, url}}`.

### `awning_add_offer`

- **Use when** the owner wants to sell something new.
- **Input** `{slug, ownerToken (8–512 printable), title (2–80), description (2–500), priceUsd (> 0, at most 6 decimals), kind}`. The server accepts at most 60 characters of title, 200 of description, whole cents and $10,000; inputs beyond that come back as `400` (a known mismatch).
- **Calls** `POST /v1/businesses/:slug/offers` with the owner token in `x-awning-owner-token` only.
- **Output** `{slug, added, offers}`. The token is never echoed.
- **Money:** none. Each call adds another offer.

### `awning_orders`

- **Use when** the owner asks about sales.
- **Input** `{slug, ownerToken}`
- **Calls** `GET /v1/orders?slug=` with the owner token header.
- **Output** `{slug, count, totalUsd, orders: [{id, sku, qty, totalUsd, status, createdAt, tx, payer, buyerNote, buyerContact}]}`. `totalUsd` is the sum of the listed orders in every status.
- **Money:** none.

## Conformance sample

`plugin/paybox-plugin.json`:

```json
{ "tool": "awning_about", "arguments": {} }
```

`awning_about` makes no network call, so the hosted check does not depend on the API being up.

## Build and check

Requirements: Node.js 24 (CI uses 24.21.0) and pnpm 11.11.0.

```bash
cd plugin
pnpm install --frozen-lockfile
pnpm test               # macOS/Linux/WSL2: type-check, two builds with identical bytes, conformance
node scripts/unit.mjs   # after a build: Awning unit checks over MCP stdio, no network
```

`pnpm test` prints one JSON report with `status: "passed"`, `artifact.sha256`, `discoveredToolCount` and the sample call result. The starter harness supports macOS and Linux only. On native Windows:

```bash
npx pnpm@11.11.0 run typecheck
npx pnpm@11.11.0 run build && sha256sum dist/plugin.mjs   # twice; the hashes must match
node scripts/conformance.mjs                              # needs a local, uncommitted copy of scripts/report.mjs that allows "win32"
node scripts/unit.mjs
```

`scripts/unit.mjs` replaces `fetch` with an in-memory Awning API (`scripts/fixtures/mock-fetch.mjs`) and starts `dist/plugin.mjs` in a fresh process per call. It checks amount math, the proposal envelope (host, method, body, asset, expiry, size), price-mismatch refusals, expiring plans, owner-token handling, upstream failures and timeouts, strict inputs, and that every result validates against its declared output schema.

Upload only `dist/plugin.mjs` to the portal. CI builds it on Linux and uploads it as an artifact.

## Worked transcript

Two different PayBox users, two different agents. Values are illustrative: ids, hashes and addresses are shortened, the draft text and any price the owner did not state differ per run, and domain totals use Porkbun's list prices of 2026-10-17. Tool calls go through PayBox's `use_plugin` with the identifiers returned by `discover_plugins` / `get_plugin`.

### 1. An owner opens a business

> **Owner:** Start a business: Ridge Roast, small-batch coffee from Accra. Ship bags and sell a $5 tasting session. Sales go to my PayBox wallet.

The agent calls `awning_plan`:

```json
{ "sentence": "Ridge Roast, small-batch coffee from Accra. Ship bags and sell a $5 tasting session.",
  "ownerWallet": "0x5290…9EE7", "country": "GH" }
```

Text result:

```
Drafted "Ridge Roast": Small-batch coffee from Accra
Preview (draft, not live): https://ridge-roast.awning.sh
Offers:
  - Tasting session: 5.00 USDC (booking, sku tasting-session)
  - Coffee beans, 250 g: 14.00 USDC (product, sku coffee-beans-250-g)
  - Monthly bag: 25.00 USDC (subscription, sku monthly-bag)
Open with a custom domain, phone line and AI receptionist (awning_open, planId pln_0k3v9…):
  - ridgeroast.com: 20.08 USDC
  - ridgeroast.co: 24.76 USDC
  - ridgeroast.shop: 11.06 USDC
Or open free on the subdomain with awning_open_free (planId pln_0k3v9…).
Ask the user which option they want before opening. Plan expires at 2026-10-17T15:30:00.000Z.
```

> **Agent:** Here's the draft: [preview]. Open free on ridge-roast.awning.sh, or with ridgeroast.com, a phone line and an AI receptionist for 20.08 USDC?
>
> **Owner:** ridgeroast.com.

The agent calls `awning_open` with `{"planId": "pln_0k3v9…", "domain": "ridgeroast.com", "priceUsd": "20.08"}`. The result's structured content is the proposal shown under [`awning_open`](#awning_open-paid); the text says:

```
Payment proposal ready: 20.08 USDC on Base to open Ridge Roast at ridgeroast.com (custom domain, phone line, AI receptionist).
PayBox will ask the user to approve 20.08 USDC. Nothing has been paid yet; the proposal expires at 2026-10-17T15:06:00Z.
After approval PayBox sends POST https://api.awning.sh/x402/open/pln_0k3v9… with the payment. Poll the returned PayBox request until it is terminal; do not call awning_open again.
The paid response contains the live URL, phone number and ownerToken (the user must keep it for awning_add_offer and awning_orders). If it says refunded: true, provisioning failed and the USDC was returned (refundTx).
Amount checked against Awning's live x402 quote.
```

PayBox fetches the 402, finds 20080000 atomic USDC to the treasury, matching `maxAmount`, and shows the approval. The owner approves. PayBox signs the authorization and sends the paid request. Awning provisions, settles, and answers. The agent polls the PayBox request until it is terminal; the service response is:

```json
{
  "business": { "slug": "ridge-roast", "name": "Ridge Roast", "url": "https://ridgeroast.com", "domain": "ridgeroast.com",
                "phone": "+1…", "status": "live", "package": "pro" },
  "ownerToken": "awn_ot_…",
  "receipts": { "paidUsd": 20.08, "tx": "0x…", "payer": "0x5290…9EE7", "network": "eip155:8453", "settlement": "confirmed" },
  "steps": [
    { "name": "preflight", "status": "ok", "ms": "…" },
    { "name": "phone", "status": "ok", "ms": "…" },
    { "name": "receptionist", "status": "ok", "ms": "…" },
    { "name": "connect_phone", "status": "ok", "ms": "…" },
    { "name": "hosting", "status": "ok", "ms": "…" },
    { "name": "register_domain", "status": "ok", "ms": "…" },
    { "name": "dns", "status": "ok", "ms": "…" },
    { "name": "go_live", "status": "ok", "ms": "…" }
  ]
}
```

> **Agent:** Ridge Roast is live at https://ridgeroast.com, with a phone line at +1 … answered by your AI receptionist. Your owner token is `awn_ot_…`; keep it private, you need it to add offers and see orders.

### 2. Another agent buys from it

> **Buyer:** Find a coffee tasting in Accra and book one for Saturday.

The agent calls `awning_find` with `{"query": "coffee tasting Accra"}`:

```
1 Awning business:
Ridge Roast (slug ridge-roast), Accra: Small-batch coffee from Accra https://ridgeroast.com
  - Tasting session: 5.00 USDC (booking, sku tasting-session)
  - Coffee beans, 250 g: 14.00 USDC (product, sku coffee-beans-250-g)
  - Monthly bag: 25.00 USDC (subscription, sku monthly-bag)
To buy, confirm the item, quantity and total with the user, then call awning_buy with the slug and sku.
```

> **Agent:** Ridge Roast in Accra has a tasting session for 5.00 USDC. Book one?
>
> **Buyer:** Yes.

The agent calls `awning_buy` with `{"slug": "ridge-roast", "sku": "tasting-session", "qty": 1, "buyerNote": "Saturday morning if possible"}`. The proposal is `POST https://api.awning.sh/x402/b/ridge-roast/tasting-session`, body `{"qty": 1, "buyerNote": "Saturday morning if possible"}`, `maxAmount` `"5000000"`. The text says the 5.00 USDC goes directly to the owner's wallet `0x5290…9EE7`.

The buyer approves in PayBox. The service response, read from the PayBox request:

```json
{
  "order": { "id": "ord_1x9…", "slug": "ridge-roast", "sku": "tasting-session", "qty": 1, "totalUsd": 5, "status": "paid" },
  "receipt": { "tx": "0x…", "payer": "0x…", "payTo": "0x5290…9EE7", "network": "eip155:8453", "settlement": "confirmed" },
  "fulfillment": {
    "kind": "booking",
    "code": "RID-7K2Q9M",
    "url": "https://ridgeroast.com",
    "message": "Booking RID-7K2Q9M confirmed: Tasting session. Ridge Roast will confirm the time with you. Quote RID-7K2Q9M when you arrive. You can also call +1 …."
  }
}
```

### 3. The owner checks sales

The owner's agent calls `awning_orders` with `{"slug": "ridge-roast", "ownerToken": "awn_ot_…"}`:

```
1 order for ridge-roast, 5.00 USDC in total:
  - 2026-10-17T14:10:02.000Z 1 x tasting-session: 5.00 USDC, paid, tx 0x…, note: Saturday morning if possible
```
