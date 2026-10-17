# Awning: submission form answers

Awning is a PayBox plugin that turns one sentence into a real business that people and AI agents can buy from the minute it opens.

How to use this file:

- **Draft** fields are ready to paste once you have checked them against the live product.
- **Your words** fields must be written by you. The event terms exclude AI-generated submissions presented as your own work "without meaningful human contribution". Those fields give you the facts as bullets and a suggested order, not finished prose.
- Every claim below is limited to what is live today. The phone line is built but switched off until telephony is connected, so no field promises it.

## 1. Project name (Draft)

Awning

## 2. Tagline, at most 80 characters (Draft)

**One sentence opens a real business that people and AI agents can buy from.** (74 characters)

Alternatives:
- Tell your agent what you sell. Awning opens the shop, and agents can buy. (73)
- Open a real business in one sentence. Every sale pays your own wallet. (70)

## 3. Short description, at most 280 characters (Draft)

> Awning is a PayBox plugin that turns one sentence into a live business: Claude drafts it, Awning opens the storefront (free, or on a real domain after one PayBox approval), and any agent with PayBox can buy from it in USDC on Base, paid to the owner's wallet.

(259 characters)

## 4. Long description (Your words)

Suggested order: one-liner, three facts, the person and the moment, what it does, how it is built, one hard problem, what's real, limits, next. Keep each part to two or three sentences; the detail lives in the linked docs.

**One-liner** (you may keep this sentence as is): Awning is a PayBox plugin that turns one sentence into a real business that people and AI agents can buy from the minute it opens.

**Three facts**
- The plugin never pays. `awning_open` and `awning_buy` return a PayBox x402 proposal for exactly the quoted amount, after checking it against Awning's live 402. A person approves each payment in PayBox.
- A Pro opening is settled only after the work succeeded: payment verified, domain registered and attached, DNS set. A failure after settlement is refunded from Awning's treasury.
- Sales go straight to the owner's wallet (`payTo` = owner). Awning takes no fee on sales and never holds sales money.

**The person and the moment**
- Owner: someone who can describe what they sell in a sentence and already uses an agent with PayBox. Today they would assemble a domain, a website, a checkout and a phone line from separate providers, none built to be bought from by an agent.
- Buyer: any PayBox user whose agent wants to buy something.
- One sourced number: in a September 2026 audit of 200 UK and US retailers, 38 had a live agent-checkout endpoint ([Blend Commerce](https://blendcommerce.com/blogs/shopify/ai-shopping-audit-2026), 2026-10-06; also in `docs/BUSINESS.md`).

**What it does (the golden path)**
- `awning_plan`: Claude Haiku 5.5 drafts the name, tagline, copy, palette and 3 to 5 priced offers (measured 2.7 to 4.9 s, `docs/SPEC.md`). Awning checks three real domains and their Porkbun prices and serves a private draft storefront. No money moves.
- `awning_open_free`: live on `<slug>.awning.sh` at no cost, listed in the directory.
- `awning_open`: one x402 approval for the domain's first-year price plus $9.00 (for example `.com` totals $20.08 at Porkbun's 2026-10-17 list price; source: `docs/SPEC.md`). Awning registers the domain, attaches it to hosting, sets DNS and goes live.
- `awning_find` and `awning_buy`: any agent with PayBox finds the business and pays an offer in USDC on Base, straight to the owner.
- `awning_add_offer` and `awning_orders`: the owner adds offers and reads orders with receipts, through their agent.

**How it is built**
- Plugin: a standard MCP server from the PayBox starter 1.0.2, bundled to one `plugin.mjs`, stateless, one network host.
- Server: one Next.js app on Vercel with Postgres (Neon). It serves the JSON API, the x402 seller, storefronts by host name and the awning.sh pages.
- Signature piece: the opening saga inside one paid x402 request (verify, claim the plan, provision with per-step undo, settle only after success, commit). Replays return the stored response; a reconciler finishes interrupted payments from on-chain `authorizationState`.

**One hard problem and how it was solved**
- Problem: provisioning a real domain inside a pay-on-success HTTP request, from a plugin that must finish each call in 10 seconds and keeps no state.
- Solution: everything slow happens at plan time (draft, domain prices, DNS records), so the paid request only provisions. The plugin ends at the proposal, and PayBox carries the paid request to Awning. The server settles only after the saga succeeds. If a function dies mid-request, the reconciler reads the chain and either marks the payment failed or refunds it.

**What's real** (see section 7)

**Known limits**
- The phone line with an AI receptionist is built (Twilio and ElevenLabs) but off until telephony is connected. Pro today is custom domain, storefront and checkout.
- Abuse screening is English keyword rules plus a fixed brand list. Quotas trust the wallet address a caller types; global hourly caps bound the total.
- Awning cannot refund a sale: the money is already in the owner's wallet, and x402 `exact` has no refund.
- Renewals for domains are not billed yet; nothing is ever charged automatically.

**What's next** (from `docs/ROADMAP.md`)
- Connect telephony so Pro includes the phone line and AI receptionist.
- Renewal proposals the owner approves; owner sign-in by wallet signature; email notifications; editing offers; Solana payments.

## 5. How it uses PayBox (Draft)

Awning is built around PayBox's plugin contract rather than beside it:

- **Nine tools** through `use_plugin`: `awning_about` (static, the conformance sample call), `awning_plan`, `awning_open_free`, `awning_open` (paid), `awning_find`, `awning_business`, `awning_buy` (paid), `awning_add_offer`, `awning_orders`. Input and output schemas are strict, and every result validates against its declared output schema.
- **x402 proposals, never payments.** The two paid tools return one `io.paybox/transactionProposal` of kind `x402`: chain `eip155:8453`, USDC, `POST https://api.awning.sh/x402/...`, `maxAmount` equal to the live 402 amount, expiry at most 4 minutes away. PayBox checks the live 402 against `maxAmount` again and asks the user to approve. The agent polls the PayBox request; it never calls the paid tool twice.
- **Brokered header.** PayBox adds `x-awning-plugin-key` to requests for `api.awning.sh` at egress. The plugin never reads or returns it. x402 requests need no custom header.
- **One host.** The plugin calls only `api.awning.sh`. Everything else (Porkbun, Vercel, the facilitator, Claude) is called server side.
- **Built for the sandbox.** No network at startup or discovery; 4 s per request and 8 s for planning, inside the 10 s budget; no state kept between calls.
- **Untrusted text handled as data.** Buyer notes reaching the owner's agent are stripped of control and invisible characters, capped and labelled as untrusted.
- **Two PayBox users meet.** The owner's agent opens the business; a different user's agent buys from it, and the payment lands in the owner's wallet.

## 6. Starting points it fits (Draft)

- **Merchant tools** (primary): Awning creates the business and its checkout, so an agent can transact with it from the minute it opens. Each offer has an x402 endpoint paying the owner's wallet.
- **Creative** (secondary): the name, copy, palette, storefront and photography are commissioned from one sentence, and the paid opening is paid directly through x402.

## 7. What's live and what's planned (Draft)

| Live now | Built, switched off | Planned |
|---|---|---|
| Plugin with nine tools, passing PayBox conformance | Phone line with AI receptionist (Twilio + ElevenLabs), off until telephony is connected | Renewal billing |
| awning.sh on Vercel with Postgres | | Owner sign-in by wallet signature, owner token rotation |
| Drafting by Claude Haiku 5.5, template fallback | | Email notifications |
| Real domain prices and registration (Porkbun), custom-domain hosting (Vercel) | | Editing and removing offers |
| x402 USDC on Base via the PayAI facilitator; settle after success; treasury refunds; reconciler | | Solana payments |
| Generated storefront photography | | Data deletion and retention |
| Screening, brand-impersonation checks, quotas, reports, takedown | | Automatic cleanup after an interrupted opening |

No users, sales or traction figures are claimed.

## 8. Built versus integrated (Draft)

| Built for Awning | Integrated |
|---|---|
| The plugin's nine tools, proposal checks and untrusted-text handling | PayBox plugin starter 1.0.2 (tooling unchanged), MCP SDK |
| The x402 seller: quotes, exact matching, replay by authorization, settle-after-work | `@x402/core` and `@x402/evm`, the PayAI facilitator |
| The opening saga with per-step undo, the reconciler, treasury refunds | Porkbun API, Vercel Domains API, viem, Base |
| Drafting rules (`finalizeDraft`), storefront templates by category, the awning.sh pages | Claude Haiku 5.5 through OpenRouter, image generation through the Vercel AI Gateway |
| Trust and safety: screening, brand checks, quotas, reports, takedown | Neon Postgres, Next.js, Drizzle |

## 9. Pre-existing materials (Draft)

The terms ask entrants to disclose material pre-existing components:
- PayBox plugin starter 1.0.2: the tooling files in `plugin/` are byte-identical to the starter; `package.json` changes only `name` and `version`.
- Open-source npm dependencies under their own licenses; fonts from Google Fonts (OFL).
- Everything else (plugin tools, server, storefronts, design, docs) was written during the event.

## 10. Your story (Your words)

Answer in two or three sentences of your own:
- Why did this idea matter to you?
- Which owner do you picture using it, and where?
- What did you do yourself? Facts you can draw on: you set up the PayBox and developer accounts, bought awning.sh, provisioned the database, funded the treasury wallet on Base, connected the drafting model and recorded the demo.

## 11. Decisions you made (Your words)

Describe two or three, and only ones that were yours. Product decisions visible in the repository that you may have made:
- Sell Pro without the phone line until telephony is real, rather than simulate it.
- Pay sales straight to the owner's wallet with no fee, so Awning never holds sales money.
- Settle a Pro payment only after the domain is registered, and refund from the treasury when something fails after settlement.
- Offer a free tier on `<slug>.awning.sh` so anyone can open without funds.

## 12. Links (Draft)

- Live site: https://awning.sh
- For agent developers: https://awning.sh/for-agents
- Directory: https://awning.sh/directory
- Live openings and sales: https://awning.sh/live
- Status: https://awning.sh/status
- Docs: https://awning.sh/docs
- Repository: https://github.com/iamdflame/awning (private today: make it public before you paste this link, or leave it out)
- Demo video on X: paste the URL of your post once it is up

## Before you press Submit

- Open every link above in a logged-out browser.
- Check that nothing you paste mentions the phone line as available.
- Make sure the tagline and short description fit their limits after any edits.
