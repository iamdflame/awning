# Awning roadmap

Last updated 2026-10-17. "Now" is what exists on `main`. "Next" is the work required before Awning can be sold widely. "Later" is direction, not commitment.

## Now (on `main`)

- **Plugin**: nine tools (`awning_about`, `awning_plan`, `awning_open_free`, `awning_open`, `awning_find`, `awning_business`, `awning_buy`, `awning_add_offer`, `awning_orders`); x402 proposals for the two paid tools, checked against the live 402; deterministic build; conformance and unit checks in CI.
- **Planning**: LLM draft with a deterministic template fallback, three priced domains, receptionist prompt, DNS records and phone candidates prepared in advance.
- **Free opening**: storefront on `<slug>.awning.sh`, directory listing, x402 checkout to the owner's wallet.
- **Pro opening**: phone number, ElevenLabs receptionist, Vercel hosting, Porkbun registration and DNS, run as a compensating saga inside the paid request; settled only after success; treasury refund for failures after settlement.
- **x402 seller**: v2 and v1, PayAI facilitator by default, replay by authorization, exact matching of amount and `payTo`, on-chain check when settlement is unclear.
- **Storefronts** by Host header, `/live` feed, `/directory`, TwiML receptionist fallback, owner SMS on orders.
- **Trust and safety**: acceptable-use and brand-impersonation screening of sentences, drafts and offers; per-wallet quotas; public reports (`/report`) with automatic hold after three distinct reporters; operator suspend and restore; receptionist safety rules.
- **Drafting through the Vercel AI Gateway** when there is no Anthropic key, and **storefront photography** (two illustrative photos per business, generated after the plan response and served at `/img/:id`).
- **Payment hardening**: refunds never simulated with real payments (the treasury key must control the treasury address, and Pro needs a working refunder); a reconciler that settles the truth for interrupted payments from the chain (after health checks, daily Vercel cron, 10-minute GitHub workflow); owner tokens re-issued by `open-free` only to a retry within 10 minutes; `/s/*` blocked on business hosts; no internal error text in public answers; buyer notes stored as one plain line; CORS on every x402 response; budgets that fit (first domain check 5 s, saga 14 s, x402 functions 90 s).
- **Mocks** for every provider, and a rule that real money never buys simulated Pro.

Known gaps on `main` are listed in [THREAT_MODEL.md](THREAT_MODEL.md#known-gaps).

## Next

Safety and correctness first:

1. **Finish suspension**: show suspended businesses as unavailable on the storefront page; alert the operator on every automatic hold; prove wallet control before quotas count it.
2. **Owner token rotation**: an endpoint that bumps `owner_token_version`.
3. **Automatic cleanup** of provider resources left by an interrupted paid open (today the reconciler logs them for the operator).
4. **Operator alerts**: route `OPERATOR:` log lines (refund required, order not recorded, delivered without settlement) to a pager.
5. **Plugin/API alignment**: match `awning_add_offer` limits to the API (60-character titles, 200-character descriptions, whole cents, $10,000), handle a Pro package that is unavailable or has no price, pass `ownerPhone` so owners get SMS, allow Free → Pro upgrades in `awning_open`.

Then the business:

6. **Renewals**: monthly phone and receptionist renewal and yearly domain renewal, each as an x402 proposal the owner approves; a clear notice before anything lapses.
7. **Usage metering** of receptionist minutes per business, with an included allowance.
8. **Email notifications** using the stored `ownerEmail`.
9. **Offer management**: deactivate and edit offers (the `active` flag exists).
10. **Call transcripts** for owners, with a recording disclosure at the start of each call and a retention setting.
11. **Data deletion** on request, and a retention schedule.
12. **Owner photos**: let owners replace the illustrative photos with their own (generated photos are shown today, captioned as illustrative).

## Later

- An owner view of orders and calls outside the agent (the agent remains the main interface).
- Owner authentication by wallet signature instead of a bearer token.
- Escrowed, refundable checkout for buyers when PayBox can pay x402 schemes beyond `exact` (the x402 `auth-capture` scheme supports capture, void and refund).
- Solana as a second payment rail (PayBox supports USDC on Solana for x402).
- Domain transfer-out to the owner on request.
- Caching and rate limits for the public directory.
