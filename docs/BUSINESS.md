# Awning: the business

Awning turns one sentence to an AI agent into a real business: a domain, a storefront, a phone line answered by an AI receptionist, and a checkout that any AI agent can pay, straight to the owner's wallet. This document covers the problem, the customer, pricing and unit economics, distribution, competition and risks. It contains no traction figures because there are none yet.

## Problem

AI agents now hold wallets and can pay, but there is little for them to buy from small sellers, and small sellers cannot take their money.

- In a September 2026 audit of 200 UK and US retailers, **38 had a live agent-checkout endpoint** (37 of them on Shopify), and 29 refused an automated browser. In the accompanying survey of 59 e-commerce leaders, 63% said an agent cannot complete their checkout. ([Blend Commerce](https://blendcommerce.com/blogs/shopify/ai-shopping-audit-2026), 2026-10-06)
- **93% of merchants** say the AI or agent provider should bear the loss on a wrong agent purchase. ([FinTech Weekly](https://www.fintechweekly.com/magazine/articles/agentic-commerce-launch-month-liability-risk-2026), 2026-10-04)
- OpenAI pulled ChatGPT Instant Checkout back in March 2026, about five months after launch; reported reasons include a 4% merchant fee, no multi-item carts and inaccurate product display. ([Forbes](https://www.forbes.com/sites/jasongoldberg/2026/03/10/why-openais-checkout-retreat-spells-trouble-for-its-commerce-strategy/), 2026-03-10)
- The agent-payment economy is real but small. Artemis and Visa's adjusted count of x402 activity, as of 2026-04-21, was about $15.0M lifetime across about 109.6M transactions, an average near $0.14, with about 5,300 lifetime sellers. ([Daniel McGlynn, quoting the Artemis report](https://www.danielmcglynn.com/the-x402-counter-has-shown-the-same-four-numbers-since-march/), 2026-09-06)

On the seller side, someone who wants to start selling today still assembles a domain, a website, a payment account and a phone line from separate providers. None of those pieces is built to be bought from by an agent.

## Customer

| Who | Job | What they pay |
|---|---|---|
| **Owner** (primary): an individual or micro-business that can describe what it sells in a sentence and already uses an AI agent with PayBox | "Get me a business that can take money today" | Free, or the Pro opening price |
| **Buyer**: any PayBox user whose agent wants to buy something | "Find it and buy it for me" | The offer price, to the owner |

The owner's agent is the interface. There is no sign-up form and no dashboard to learn.

## Why now

| Date | Fact | Source |
|---|---|---|
| 2026-03-18 | Stripe launched the Machine Payments Protocol with Tempo mainnet; Stripe says it supports both MPP and x402 | [Stripe](https://stripe.com/blog/machine-payments-protocol) |
| 2026-07-14 | The x402 Foundation began operating under the Linux Foundation; its premier members include MoonPay, Visa, Mastercard, Stripe, Shopify, Google, AWS, Cloudflare and Circle | [CoinDesk](https://www.coindesk.com/tech/2026/07/15/visa-mastercard-and-ripple-join-the-standard-letting-ai-agents-pay-in-stablecoins), 2026-07-15 |
| 2026-07-29 | MoonPay launched PayBox, a payment vault for agents on Claude and ChatGPT, using x402 for agent payments | [MoonPay](https://www.moonpay.com/newsroom/moonpay-paybox) |
| 2026-10 | PayBox sandbox plugins can return x402 payment proposals that PayBox checks, shows for approval and pays (starter 1.0.2) | [PayBox developer guide](https://docs.paybox.sh) |
| as of 2026-10-16 | Porkbun's API (v3.63) registers domains and accepts per-purchase USDC payment over x402 | [Porkbun API](https://porkbun.com/api/json/v3/documentation), read 2026-10-16 |
| as of 2026-10-17 | ElevenLabs lists agent voice minutes at $0.08 per minute; Twilio lists US local numbers at $1.15 a month | [ElevenLabs](https://elevenlabs.io/pricing/api), [Twilio](https://www.twilio.com/en-us/voice/pricing/us), fetched 2026-10-17 |

Together: agents can pay with one approval, domains can be bought by API in USDC, and a phone line with a voice agent costs about a dollar a month plus cents per minute. A business can now be assembled in one request.

## Product

One sentence → `awning_plan` drafts the business and prices three real domains → the owner opens **Free** (storefront on `<slug>.awning.sh`) or **Pro** (custom domain, phone line, AI receptionist) → the business is listed in a directory every PayBox agent can search and buy from (`awning_find`, `awning_buy`). Sales are x402 payments in USDC on Base whose `payTo` is the owner's wallet. Pro is charged only if the opening succeeds. Details: [SPEC.md](SPEC.md).

## Pricing

| | Free | Pro |
|---|---|---|
| Price | $0 | domain first-year price + $9.00 |
| Storefront, directory listing, x402 checkout to the owner's wallet | yes | yes |
| Custom domain (first year) | — | yes |
| Phone number and AI receptionist (first month) | — | yes |
| Fee on sales | 0% | 0% |

The domain is passed through at the registrar's price ([`web/lib/money.ts`](../web/lib/money.ts)). Renewals are not built yet; see risks.

## Unit economics

Provider list prices used below, all fetched 2026-10-17:

| Item | Price | Source |
|---|---|---|
| `.com` first year / renewal | $11.08 / $11.08 | [Porkbun](https://porkbun.com/products/domains) |
| `.co` first year / renewal | $15.76 / $31.20 | Porkbun |
| `.shop` first year / renewal | $2.06 / $31.41 | Porkbun |
| `.store` first year / renewal | $2.57 / $43.77 | Porkbun |
| US local number | $1.15 per month | [Twilio](https://www.twilio.com/en-us/voice/pricing/us) ("Pricing current as of August 2026") |
| Inbound minute, local number | $0.0085 | Twilio |
| ElevenLabs agent minute (additional minutes) | $0.08 | [ElevenLabs](https://elevenlabs.io/pricing/api) |

**Per Pro business, first month.** Let *D* be the domain price and *m* the receptionist minutes in the month.

- Revenue to Awning: *D* + $9.00
- Domain cost: *D* (pass-through, no margin)
- Phone number: $1.15
- Voice: *m* × ($0.0085 + $0.08) = *m* × $0.0885
- Gross profit: $9.00 − $1.15 − $0.0885 *m* = **$7.85 − $0.0885 *m***

| Minutes in month one | Cost of phone + voice | Gross profit | Margin on the $9.00 fee |
|---:|---:|---:|---:|
| 0 | $1.15 | $7.85 | 87.2% |
| 30 | $1.15 + $2.655 = $3.805 | $5.195 | 57.7% |
| 60 | $1.15 + $5.31 = $6.46 | $2.54 | 28.2% |
| 88.7 | $9.00 | $0.00 | 0% (break-even: 7.85 ÷ 0.0885) |

On a `.com` opening ($20.08 total), zero minutes means $7.85 gross profit on $20.08 of revenue, 39.1%, because the $11.08 domain is pass-through.

Not included above, because there is no cited list price or the cost is shared: the LLM call per plan (made for Free and Pro plans alike), any ElevenLabs plan subscription or LLM charge billed with agent minutes (the pricing page does not say), Twilio SMS for order notifications, facilitator fees, hosting and the database.

**Free business.** Revenue $0. Marginal cost: the planning calls (LLM draft, domain availability check, phone number search) and a share of hosting and database. No domain, number or minutes.

**Sales.** Awning takes no fee, so sales do not produce revenue for Awning today.

**After month one.** The code bills nothing after the first month: the number ($1.15 a month) and any minutes keep costing Awning with no revenue. In year two, the domains renew at the registrar's renewal price, which for `.shop` and `.store` is over 15 times the first-year price. Renewal pricing has to be built before Pro can be sold at volume.

## Go-to-market

1. **Inside PayBox.** The plugin is the product. Owners and buyers already in PayBox reach Awning from the agent hosts PayBox supports, with no new account.
2. **Each business recruits buyers.** Every storefront shows a copyable prompt ("Use Awning on PayBox to buy …"), the x402 URL of each offer, and its phone number. Owners share their storefront to get sales, and each share teaches buyers that their agent can buy.
3. **Each business recruits owners.** Every storefront carries "Opened with Awning" linking to `awning.sh`, and `awning.sh/live` and `awning.sh/directory` show openings and sales with on-chain receipts.
4. **Free first.** Free costs Awning little, so it can be given to anyone; Pro is the upgrade for owners who want their own domain and a phone line.
5. **Start with categories that sell simple things.** The template catalogue covers coffee and tea, bakeries, food and catering, beauty and hair, fitness, design, photography, tutoring, home services, pets, tech, consulting and handmade goods ([`web/lib/plan/catalog.ts`](../web/lib/plan/catalog.ts)): offers with a fixed price and a clear fulfilment path.

## Competition

| Category | Companies | What they offer | What they do not do |
|---|---|---|---|
| AI website builders | Wix, Durable | Wix: "Create your site in no time with AI" ([wix.com](https://www.wix.com/ai-website-builder)). Durable: Free, then about $22–$49 a month, custom domain with a subscription ([durable.com/pricing](https://durable.com/pricing)) | Neither page mentions agents paying, x402, USDC or a listing where agents can buy (both fetched 2026-10-17). The business is a website for people, not a seller agents can pay |
| Commerce platforms | Shopify; Google's Universal Commerce Protocol | Shopify Basic is $27 a month billed monthly with a custom domain ([shopify.com/pricing](https://www.shopify.com/pricing), fetched 2026-10-17). Shopify's agent tools let "trusted agents" complete checkouts; others are handed to the storefront ([shopify.dev/docs/agents](https://shopify.dev/docs/agents)). Google's UCP (Jan 2026) runs checkout in AI Mode and Gemini with Google Pay or PayPal, US only ([IT Brief](https://itbrief.com.au/story/google-unveils-open-ucp-standard-for-ai-driven-shopping)) | Not created from a sentence; no phone line; agent checkout depends on platform trust tiers; payments go through the platform, not straight to the owner's wallet |
| Agent-payment rails and wallets | Stripe MPP, Coinbase Payments MCP, Skyfire, Sapiom, Crossmint | Ways for agents to pay: MPP settles to a Stripe balance ([Stripe](https://stripe.com/blog/machine-payments-protocol)); Coinbase Payments MCP gives Claude, Gemini and Codex a wallet and x402 ([Coinbase](https://www.coinbase.com/developer-platform/discover/launches/payments-mcp)); Skyfire sells agent identity and checkout ([skyfire.xyz](https://skyfire.xyz)); Sapiom sells a card vault and spending rules ([sapiom.ai](https://www.sapiom.ai)); Crossmint sells wallet and payment APIs ([Crossmint](https://www.crossmint.com/announcement/crossmint-raises-23-6m-led-by-ribbit-capital)) | They move the buyer's money. None of them creates the seller: no domain, storefront, phone line or listing for a new business |

Awning sits on the seller side of the same rails: it makes new businesses that are payable by agents from the moment they open.

## Risks

| Risk | Why it is real | What we do |
|---|---|---|
| Buyers do not come | x402 commerce is small (about $15.0M adjusted lifetime volume as of 2026-04-21, above) | Every business also sells to people through its storefront and phone; the Free tier keeps the cost of waiting low |
| Abuse: phishing and impersonation businesses | Awning gives a sentence a real domain and a real phone number | Acceptable-use and brand-impersonation screening, per-wallet quotas, public reports with automatic hold, and operator takedown are in code (`web/lib/policy/`). The rules are English keyword lists and the quotas trust a typed wallet address, so this stays the largest open risk ([THREAT_MODEL.md](THREAT_MODEL.md)) |
| Renewals not built | Month two and year two costs exist with no billing; renewal prices jump for some TLDs | Build renewal proposals before scaling Pro; prefer TLDs with flat renewal prices |
| Voice minutes erase the margin | Break-even at about 89 minutes in month one | Meter minutes per business; cap or price above an included allowance |
| Platform dependency | Every new plugin version needs PayBox review; each payment needs a user approval | Keep the plugin thin and the logic server-side; owners can update hosts and secrets without a new version |
| Provider dependency | Domains, numbers and voice come from Porkbun, Twilio and ElevenLabs | Adapters behind interfaces with tested mocks; a provider outage fails before settlement, so nobody is charged |
| Phone numbers by country | Local numbers are not available everywhere | The code falls back to US numbers when none are found in the owner's country ([`web/lib/adapters/telephony.ts`](../web/lib/adapters/telephony.ts)) |
| No buyer recourse on sales | x402 `exact` "defines no refund" ([x402 exact scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact.md)); sales settle to the owner, whom Awning does not control | Charge only after the order is recorded; terms make owners responsible for fulfilment; reports and takedown planned |
| Hot treasury key | It holds Pro fees and pays refunds | Keep a low hot balance; sweep fees; alert on refunds (planned) |

## What we will not do

- Hold sales money. A sale's `payTo` is always the owner's wallet.
- Charge for an opening that did not happen. Pro payments settle only after provisioning succeeds.
- Sell simulated provisioning for real money.
- Charge anyone automatically. Every payment is a proposal the payer approves in PayBox.
- Invent facts about a business. The drafter is told never to invent awards, reviews, years in business, certifications, addresses or claims ([`web/lib/adapters/drafter.ts`](../web/lib/adapters/drafter.ts)).
- Ask for card numbers, bank details or wallet keys, on the web or by phone.
- Mark up domains.
