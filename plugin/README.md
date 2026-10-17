# Awning PayBox plugin

Awning turns one sentence into a real small business (a generated storefront, priced offers, optionally a custom domain and a phone line answered by an AI receptionist) and lets any AI agent with PayBox buy from Awning businesses in USDC on Base, paid straight to the owner's wallet.

This folder is the PayBox sandbox plugin: a standard MCP server (`@modelcontextprotocol/server` 2.0.0, protocol `2026-07-28`, server name `awning`, version `1.0.0`) bundled into one file, `dist/plugin.mjs`. It is built from PayBox starter 1.0.2. The tooling files are byte-identical to the starter; only `package.json` `name` changed.

## Hosted configuration (PayBox developer portal)

| Setting | Value |
|---|---|
| Network host | `api.awning.sh` (the only host the plugin calls) |
| Brokered secret | Host `api.awning.sh`, header `x-awning-plugin-key`, value = the Awning plugin key |
| Environment variable (optional) | `AWNING_API_URL`, default `https://api.awning.sh`. Must be a plain `https://` URL. |

The plugin never reads the plugin key from `process.env` and never sets that header. PayBox adds it when the request leaves the sandbox. x402 payment requests carry no custom headers, so the x402 endpoints work without it.

## How it behaves

- Every API call has a 4 second timeout (`AbortSignal.timeout(4000)`) and `redirect: "error"`. No network access happens at startup or during tool discovery.
- When something fails, the tool returns `isError: true` with one short sentence that says what to do next. It never returns headers, tokens or raw upstream payloads.
- Money is handled as decimal strings and atomic USDC (6 decimals, `BigInt`), never floating point. Every tool output gives prices as `priceUsd: "19.99"` together with `priceAtomicUsdc: "19990000"`.
- The two paid tools (`awning_open`, `awning_buy`) never pay. Each returns one `io.paybox/transactionProposal` of kind `x402` built by the starter's `proposeX402`:
  - chain `eip155:8453`; asset USDC `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`
  - `POST` to `https://api.awning.sh/x402/...` with a small JSON body (under 64 KiB, no secrets)
  - `maxAmount` is the exact quoted amount in atomic USDC
  - `expiresAt` is a whole-second UTC time at most 4 minutes away. If the plan's own quote expires sooner, `expiresAt` is set to that time instead. If less than a minute would be left for approval, the tool refuses.
- Before proposing, the paid tools make two reads in parallel: Awning's stored data (the plan or the business) and the unpaid 402 challenge for the same request. An unpaid request is only a quote and has no side effects (Awning's API contract). If the two prices disagree, the tool returns an error instead of a proposal. If the challenge can't be read, the stored price is used, and PayBox still checks the live 402 against `maxAmount` before the user approves.
- After approval, the paid response comes back through the PayBox request. The agent should poll that request and must not call the tool again. For `awning_buy`, a second approved proposal is a second order.

## Tools

| Tool | Kind | Annotations (readOnly / destructive / idempotent / openWorld) | API call |
|---|---|---|---|
| `awning_about` | static | true / false / true / false | none |
| `awning_plan` | creates a private draft, no money | false / false / false / true | `POST /v1/plan` |
| `awning_open_free` | opens on the free subdomain | false / false / false / true | `POST /v1/open-free` |
| `awning_open` | x402 proposal | false / false / false / true | `GET /v1/plans/:planId`, unpaid `POST /x402/open/:planId` (quote) |
| `awning_find` | read | true / false / true / true | `GET /v1/businesses?q=&category=&limit=` |
| `awning_business` | read | true / false / true / true | `GET /v1/businesses/:slug` |
| `awning_buy` | x402 proposal | false / false / false / true | `GET /v1/businesses/:slug`, unpaid `POST /x402/b/:slug/:sku` (quote) |
| `awning_add_offer` | write, needs owner token | false / false / false / true | `POST /v1/businesses/:slug/offers` |
| `awning_orders` | read, needs owner token | true / false / true / true | `GET /v1/orders?slug=` |

All input schemas are strict (`additionalProperties: false`), and so are all output schemas, including nested objects.

### `awning_about`
- **Input** `{}`
- **Output** `{name, version, summary, apiHost, payments: {chain, asset, symbol}, tools: [{name, use, cost}], flows: {open[], buy[], manage[]}}`
- This is the conformance sample call (`paybox-plugin.json`).

### `awning_plan`
- **Input** `{sentence (8-600 chars), ownerWallet (0x + 40 hex), ownerName?, ownerEmail?, country?}`
- **Output** `{planId, expiresAt, previewUrl, business: {slug, name, tagline, description, category, city, palette, offers[]}, domains: [{domain, available, domainPriceUsd, openPriceUsd}], packages: [{id, label, includes[], priceUsd}]}`
- `openPriceUsd` is the total USDC to open on that domain with `awning_open`. If Awning gives a per-domain `totalUsd`, that value is used. Otherwise the total is the Pro package price plus the domain price. It is `null` for domains that aren't available.

### `awning_open_free`
- **Input** `{planId}`
- **Output** `{business: {slug, name, url, status}, ownerToken}`

### `awning_open` (paid)
- **Input** `{planId, domain, priceUsd}`. `priceUsd` is the `openPriceUsd` the user agreed to, given as a string `"20.98"` or a number.
- **Output** `{"io.paybox/transactionProposal": {version: "1", kind: "x402", expiresAt, chain: "eip155:8453", request: {url: "https://api.awning.sh/x402/open/<planId>", method: "POST", body: {domain, package: "pro"}}, payment: {asset, maxAmount}}}`
- **Refuses (no proposal)** when:
  - the plan is unknown, expired or already opened
  - the domain isn't in the plan or is no longer available
  - `priceUsd` differs from Awning's quote. The error names the correct price.
- **Paid response** (through PayBox) `{business: {slug, name, url, domain, phone, status: "live"}, ownerToken, receipts, steps}`, or `{refunded: true, refundTx, reason}`.

### `awning_find`
- **Input** `{query?, category?, limit? (1-25, default 10)}`
- **Output** `{count, businesses: [{slug, name, tagline, description, category, city, url, phone, domain, status, openedAt, salesCount, offers: [{sku, title, description, priceUsd, priceAtomicUsdc, kind}]}]}`

### `awning_business`
- **Input** `{slug}`
- **Output** `{business: {...same shape as one awning_find entry}}`

### `awning_buy` (paid)
- **Input** `{slug, sku, qty? (1-100, default 1), buyerNote?, buyerContact?}`
- **Output** an x402 proposal: `POST https://api.awning.sh/x402/b/<slug>/<sku>` with body `{qty, buyerNote?, buyerContact?}`, and `maxAmount = price x qty` in atomic USDC.
- **Refuses** when the business isn't live, the sku doesn't exist, or the live checkout price differs from the listed price.
- **Paid response** (through PayBox) `{order: {id, slug, sku, qty, totalUsd, status: "paid"}, receipt: {tx, payer, payTo}, fulfillment: {kind, message, code?, url?}}`.

### `awning_add_offer`
- **Input** `{slug, ownerToken, title, description, priceUsd, kind: product|service|booking|digital|subscription}`
- **Output** `{slug, added, offers[]}`
- The owner token is sent only in the `x-awning-owner-token` request header. It is never echoed back.

### `awning_orders`
- **Input** `{slug, ownerToken}`
- **Output** `{slug, count, totalUsd, orders: [{id, sku, qty, totalUsd, status, createdAt, tx, payer, buyerNote, buyerContact}]}`

## Build and check

Requirements: Node.js 24 and pnpm 11.11.0.

```bash
cd plugin
pnpm install --frozen-lockfile      # or: npx pnpm@11.11.0 install --frozen-lockfile
pnpm test                           # macOS/Linux/WSL2: type-check, two builds with identical bytes, conformance
node scripts/unit.mjs               # after a build: Awning unit checks (no network)
```

`pnpm test` runs the starter's own harness, which supports only macOS and Linux. On native Windows, run the steps directly:

```bash
npx pnpm@11.11.0 run typecheck
npx pnpm@11.11.0 run build && sha256sum dist/plugin.mjs   # run twice; the hashes must match
node scripts/conformance.mjs                              # needs a local, uncommitted copy of scripts/report.mjs that also allows "win32"
node scripts/unit.mjs
```

`scripts/unit.mjs` loads the pure helpers in `src/awning.ts` through tsx. It also starts the built `dist/plugin.mjs` over MCP stdio, in a fresh process for each call. `fetch` is replaced by an in-memory Awning API (`scripts/fixtures/mock-fetch.mjs`), so the checks use no network. They cover:

- the amount math (price x qty, decimal strings, no floats)
- the proposal envelope: host `api.awning.sh`, `POST`, exact body, USDC on Base, whole-second expiry within 5 minutes, body under 64 KiB
- price-mismatch refusals and expiring plans
- owner-token handling
- upstream failures and timeouts
- strict input validation
- output validation of every result against its declared schema

Upload only `dist/plugin.mjs` to the PayBox developer portal.

## Source layout

| File | Purpose |
|---|---|
| `src/plugin.ts` | MCP server and the nine tools |
| `src/awning.ts` | API client (timeouts, error mapping), USDC math, live-quote reader, proposal builders |
| `src/schemas.ts` | Lenient readers for API responses, and the strict input and output schemas |
| `src/paybox.ts` | Starter 1.0.2 proposal helpers (unchanged) |
| `scripts/unit.mjs`, `scripts/fixtures/mock-fetch.mjs` | Awning unit checks |
| `scripts/conformance.mjs`, `process.mjs`, `report.mjs`, `schema.mjs`, `test.mjs` | Starter 1.0.2 tooling (unchanged) |
