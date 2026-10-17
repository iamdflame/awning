# Awning brand

## Platform
- **For:** someone with a thing to sell (a roaster in Accra, a mechanic in Austin, a potter in Lisbon) talking to the AI agent they already use, and the *other* agents that will shop on their behalf.
- **Problem, in their words:** "I just want to be open. Not learn Shopify, Stripe, GoDaddy and Twilio first."
- **Point of view:** the agent economy has buyers and wallets but nowhere to spend. Businesses should be born agent-payable, and owning a shop should be as easy as saying what you sell.
- **Promise:** say it, tap once, you're open, and your first customer can be an AI.
- **Personality:** warm, street-level, exact (about money). Not corporate, not crypto-bro, not cute.
- **Archetype:** Everyman with a Creator streak: the corner shop that opens on your street, built with real tools.
- **Category map** (REFERENCES below): agent-payments and x402 sites are near-black dashboards, purple gradients, mono labels, terminal heroes; store builders are white SaaS with laptop screenshots. Awning is the only one that looks like a *street*: painted canopy stripes, shop windows, signs, receipts.

## Essence
- **Truth:** one sentence becomes a real, open shop, and the first customer can be a machine.
- **Feeling (first 5 s):** the bell over the door; "we're open".
- **Tension:** corner-shop warmth × machine-exact payments.
- **One word:** Open.

## Mark and logo
- Mark: a front-view awning, five stripes flaring from a rod, each ending in a scallop. Built on a 64 grid in `tools/brand-gen.mjs`; reads at 16 px. Wordmark: "awning", lowercase Archivo ExtraBold at width 125, outlined to paths.
- Files: `brand/logo*.svg`, `mark*.svg`, `wordmark*.svg`, `favicon.svg`, `favicon-32/180/512.png`, `app-icon.svg`, `social/avatar-400.png`.
- Clear space = rod height; minimum lockup 88 px wide, mark 16 px. On business colors or photos use the green tile (favicon).

## Color (tokens in `brand/palette.css`)
- Canopy green `#00683b` (oklch 0.45 0.115 158), scale 50–950. Canvas neutrals tinted warm-green, never flat grey. One accent: tomato `#eb4b35`, the OPEN sign, for primary CTAs and live signals only. Sun `#faca4b` only where money lands (receipts, tickets, gold window lettering).
- Ratio ≈ 60 canvas / 30 green / 10 tomato+sun. Dark sections are designed greens (g-800/900/950), never #0B0B0B.

## Type
- **Archivo** variable, one family across its width axis: display 800 at width 112–125, tracking −0.035em, line-height 0.96; body 400 at width 100, 17 px / 1.55.
- **Martian Mono** only where a printer or a machine would speak: receipts, tx hashes, x402 links, tool names.
- Storefronts use their own pair (see the storefront section of DIRECTION.md), never Archivo.

## Imagery
- One language: **the street**. Canopies, shop windows, hanging signs, thermal receipts, price tags and flat poster objects (a coffee bag, a wheel, a vase) drawn in each business's own palette. No stock photos, no 3D blobs, no device mockups.

## Motion
- The orchestrated moment: the hero window. Sentence lettered on glass → glass clears → storefront's awning unrolls with a small bounce (`--ease-unroll`) → OPEN sign flips → phone chip rings → an agent's purchase prints on the receipt and "+5.00" pops.
- Everything else is quiet: the canopy unrolls once on load, the street drifts at 90 s per loop (pauses on hover/focus), buttons press to .96.
- Reduced motion: the hero shows its final state, the street stands still.

## Voice
- A shopkeeper who knows the plumbing. Concrete nouns (domain, line, wallet, receipt), short sentences, sentence case.
- Headline: "Open for business in one sentence." CTA: "Open yours". Error: "ridgeroast.co was taken a minute ago. Your 19 USDC is back in your wallet. Try ridgeroast.shop?" Success: "You're open. Ridge Roast is live at ridgeroast.co and Ama is answering the phone."
- Never: unlock, seamless, revolutionize, leverage, empower, web3, "AI-powered".

## References (from the taste library, `library.mjs`)
| Reference | What it teaches |
|---|---|
| gelatolaboca.com (7.4) | one literal visual pun on a saturated ground; the object IS the headline |
| koffiracha.com (7.0) | giant type with the product cutting through it; food brand confidence |
| sowieso.wero-wallet.eu merchant (7.7) | payments can be warm and illustrated, not a dashboard |
| juice.agency (7.5) | a full-width display wordmark as architecture |
| aardvarkbookclub.com (7.6) | flat cut-out objects on bold color, playful but legible |
| savor.it (7.7), sakiproducts.com (7.0), abelfragrance.com (7.4) | what an independent shop's site feels like: one hero object, a strong wordmark, calm offer lists |
| en.manayerbamate.com (7.8) | label art spilling out of the product: brand world from one object |
| **Category default to beat** | near-black agent dashboards with budget bars and revoke buttons, purple gradients, chat-box heroes, three emoji feature cards (see `review/crowd-default.html`) |
