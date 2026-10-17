---
name: awning-design
description: "Awning's design system and review standard: brand, tokens, type, color, imagery, motion, components, storefront theming, voice, the tells to reject and the review format. Load it before building, changing or reviewing any Awning UI (awning.sh, /live, /directory, owner dashboard, docs, generated storefronts), brand asset, OG image, video frame or UI copy, even small tweaks."
---

# Awning design: "Opening day"

## The idea

Awning turns one sentence into a real shop, so the brand looks like a **street**, not a dashboard. awning.sh wears a striped, scalloped canopy (canopy green and canvas) over a shop window where a business opens live. Everything else (receipts, price tags, hanging signs, a street of shopfronts) comes from the same street. Generated storefronts wear *their own* awning in *their own* colors; Awning's brand appears there only as a slim ribbon.

Source of truth: `design/brand/palette.css` (tokens), `design/landing/` (awning.sh), `design/storefront/` (the business template), `design/BRAND.md`, `design/DIRECTION.md`.

## Non-negotiables

1. **The canopy crowns every Awning page**: rod bar in `--g-800` + `.canopy` stripes with scallops (copy the CSS mask from `landing.css`). Never a plain white header.
2. **First screens lead with the product working** (the shop window, a storefront, a receipt), never with a paragraph or a chat box.
3. **Money is shown as a receipt or ticket**, with Martian Mono, a dashed rule and the amount in Archivo 800 green. Never a stat tile, never a chart of fake numbers.
4. **One accent**: tomato is the OPEN sign: primary CTAs and live signals only. Sun yellow only where money lands.
5. **Storefronts never look like Awning.** They take the business palette and font pair; the only Awning mark is the 40 px ribbon at the very bottom.
6. **No fake proof.** No invented counters, logos or testimonials. Live numbers come from `GET /v1/live` or are not shown.
7. **Compose the phone on its own terms** (390 px): headline, then the window, then copy; no horizontal scroll; tap targets ≥ 44 px.

## Tokens (excerpt; full file `design/brand/palette.css`)

```css
:root {
  --g-600: oklch(0.45 0.115 158); /* #00683b canopy, the brand */
  --g-800: oklch(0.31 0.075 160); /* #003b23 rod, final CTA */
  --g-900: oklch(0.25 0.055 162); /* #002919 window frame, agents section */
  --g-950: oklch(0.19 0.04 164);  /* #00190f footer, code boards */
  --c-0: oklch(0.99 0.006 105);   /* paper */
  --c-50: oklch(0.972 0.012 105); /* canvas = --bg */
  --c-100: oklch(0.945 0.016 105);/* sunk sections */
  --c-700: oklch(0.45 0.03 150);  /* --muted */
  --c-900: oklch(0.21 0.035 160); /* --ink */
  --tomato: oklch(0.635 0.2 31);  /* #eb4b35 accent; text on canvas uses --tomato-deep */
  --sun: oklch(0.86 0.15 88);     /* #faca4b money */
  --focus: oklch(0.62 0.17 245);
  --font-display: "Archivo"; --font-text: "Archivo"; --font-receipt: "Martian Mono";
  --step-display: clamp(3rem, 1.6rem + 5.6vw, 7.25rem); --step-h1: clamp(2.5rem, 1.6rem + 3.4vw, 4.75rem);
  --step-h3: clamp(1.375rem, 1.2rem + 0.7vw, 1.75rem); --step-lead: clamp(1.125rem, 1.05rem + 0.35vw, 1.3125rem); --step-body: 1.0625rem;
  --section: clamp(72px, 10vw, 152px); --gutter: clamp(16px, 4vw, 56px); --container: 1240px;
  --r-sm: 10px; --r-md: 16px; --r-lg: 24px; --r-xl: 36px; --r-pill: 999px;
  --shadow-2: 0 1px 2px oklch(0.25 0.05 158/.06), 0 4px 8px oklch(0.25 0.05 158/.06), 0 16px 32px -8px oklch(0.25 0.08 158/.16);
  --shadow-3: 0 2px 4px oklch(0.25 0.05 158/.06), 0 12px 24px -6px oklch(0.25 0.06 158/.14), 0 40px 80px -24px oklch(0.22 0.08 158/.32);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1); --ease-unroll: cubic-bezier(0.34, 1.32, 0.64, 1);
  --dur-micro: 140ms; --dur-color: 180ms; --dur-ui: 220ms; --dur-reveal: 700ms;
}
```

## Typography

- Google Fonts: `Archivo:wdth,wght@100..125,400..900` and `Martian+Mono:wdth,wght@75..100,400..700`.
- Display (`.display`): Archivo 800, `font-stretch:118%`, tracking −0.035em, line-height 0.96, `text-wrap:balance`, max 3 lines (check at 1440 and 390).
- H3: Archivo 700 at 112%. Body: Archivo 400 at 100%, 17 px, line-height 1.55, `text-wrap:pretty`, measure ≤ 70ch. Buttons: 600 at 106%.
- Martian Mono at width 88 only for receipts, tx hashes, x402 URLs and tool names. Never for labels or eyebrows.
- Numbers that change: `font-variant-numeric: tabular-nums`. Money: "5.00 USDC", "+5.00" on receipts; prices on storefronts drop ".00".

## Color use

- Sections alternate canvas → green (`--g-600`) → canvas → `--g-900` → canvas → `--c-100` → `--g-800` → `--g-950` footer. Never two dark sections in a row unless one is the footer.
- Contrast: body text ≥ 4.5:1; tomato text on canvas uses `--tomato-deep`.

## Imagery

- **The street** is the only image language: canopies, shop windows, hanging OPEN sign, thermal receipts, tickets, price tags, flat poster objects (`design/shared/art.js`: coffee, bike, ceramics) drawn in the business's palette.
- Do: flat shapes, 2–4 colors from a palette, soft grain filter, a ground shadow ellipse. Don't: stock photos, 3D blobs, isometric illustrations, device mockups, gradient orbs, emoji.
- New categories need a new poster object in `art.js` before a storefront ships with a category fallback.

## Motion

- **Orchestrated moment (hero, ~13 s loop):** sentence typed in sun-gold on the window glass (26 ms/char) → glass clears (550 ms) → storefront awning unrolls (`--ease-unroll`, 900 ms) → OPEN sign flips (800 ms) → phone chip slides in and the icon jiggles 4× → receipt prints line by line (450 ms apart) → the agent's purchase highlights the menu row → "+5.00" pops. Loop pauses when off screen.
- Canopy unrolls once on load (1.1 s). The street drifts 90 s/loop and pauses on hover and focus.
- Buttons: press `scale(.96)`, hover deepens the tinted shadow in 180 ms. Icons nudge on hover.
- `prefers-reduced-motion`: hero shows its end state, nothing drifts, sways or pulses.

## Components (see `design/landing/landing.css`)

- **Buttons:** `.btn-primary` tomato gradient + inset highlight + tomato glow; `.btn-ghost` 1.5 px inner ring at 20% ink; `.btn-canvas` paper on green. Heights 52 (40 in the rod). Labels nowrap. Icons are drawn (storefront, phone), never "→".
- **Rod + canopy** (`.rod`, `.canopy`): `--sw` 56 px desktop, 39 px phone; mask overlap `+1px` to avoid a seam.
- **Shop window** (`.window/.glass/.sill`), **OPEN sign** (`.sign`, flips with `.is-open`), **phone chip** (`.ring`), **receipt** (`.receipt`, scalloped tear via mask), **ticket** (`.ticket`, side notches), **price tag** (`.tag` clip-path + string), **ledger** (`.ledger`), **street shopfront** (`.shop`, data-driven CSS vars `--wall --trim --sA --sB --glass --disp`).
- **Tool board** (`.board .tools`): tool name in Martian Mono sun, one-line description, a pill: `pays` (tomato tint) or `read/free/owner` (neutral).
- **Empty state:** "Nothing opened yet today. Be the first shop on the street." with a single empty lot drawn as a dashed scaffold.
- **Error:** says what happened and that the money is back: "ridgeroast.co was taken a minute ago. Your 19 USDC is back in your wallet."

## Storefront theming (every generated business)

- Input from the API: `palette {primary, accent, ink, paper}`, `category`. `themeFrom()` in `design/storefront/storefront.js` derives `ground, ink, accent, accent2, stripeA, stripeB, deep`.
- Font pair and hero variant by category: food/coffee → Alfa Slab One + Work Sans, `sign` hero; repair/tools → Big Shoulders Display 900 + Barlow, `poster` hero; craft/studio → Young Serif + Figtree, `arch` hero. Add rows, never one global font.
- Sections, in order: rod + their canopy, hero (name, tagline, status, primary "Book/Buy · price", phone), menu board of offers (on `--ink`), "Buy with your AI agent" slip (exact prompt + x402 link `https://api.awning.sh/x402/b/:slug/:sku` with copy buttons + payTo wallet), about/hours/call, footer, Awning ribbon.
- **Draft state** (`status: draft`): caution-tape bar "Preview, not open yet…", awning rolled up, kraft paper over the art with an "Opening soon" stamp, buy buttons disabled, no phone.
- **Free plan** (no phone/domain): hide call buttons and the phone column; domain shows `slug.awning.sh`.

## Copy

- Sentence case, active voice, concrete nouns. Name the outcome for the owner: "Open yours", "Open with a domain", "See what opened today".
- Same action, same name everywhere ("Open yours" is the CTA on every Awning page).
- Never: unlock, seamless, revolutionize, leverage, empower, web3, "AI-powered", "in seconds".
- Avoid "A · B · C" meta strings; use a sentence ("Open now in Accra").

## Tells to reject

The five AI clusters and the tells in studio's craft.md, plus, for this project:
- dark dashboards with budget bars, revoke buttons or agent "spend limits" as decoration;
- a chat box or prompt field as the hero;
- purple, the PayBox/MoonPay violet, or any gradient text;
- a row of three identical feature cards with icons;
- invented "businesses opened" counters;
- storefronts that share Awning's green or Archivo (they must look independent).

## Review format

- **Shots:** `design/tools/finalshots.sh <round>` (landing, three storefronts, two drafts, brand sheet at 1440 and 390, full pages) plus `tools/sections.mjs` element shots per section; `tools/errs.mjs` for console errors.
- **Arena references:** gelatolaboca.com, koffiracha.com, sowieso.wero-wallet.eu/merchant, juice.agency, osmo.supply, aardvarkbookclub.com (landing); savor.it, en.manayerbamate.com, abelfragrance.com, sakiproducts.com (storefront); plus `design/review/crowd-default.html`. Shots in `~/.claude/studio-library/shots/`.
- **Reviewers:** an art director, a product/UX designer, a brand strategist, and a small-business owner who'd actually use the storefront.
- **The bar:** wins or ties ≥ 4/10 desktop and 2/5 phone Arena pairs; clearly beats the crowd default; no cluster or tell; jury trimmed mean ≥ 7.5 on the calibrated scale; no console errors; no horizontal scroll at 390.

## Assets

- `design/brand/`: logos, marks, favicons (svg, 32, 180, 512), app icon, `social/og.png` (1200×630, source `og.html`), `social/x-header.png` (1500×500, source `x-header.html`), `social/avatar-400.png`, brand sheet `index.html`.
- `design/tools/brand-gen.mjs` regenerates the marks (needs Archivo instanced via fontTools; see `word.py`).
- All fonts: Google Fonts (OFL). All art: drawn in code, no third-party images.
