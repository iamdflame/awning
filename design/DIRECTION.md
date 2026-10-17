# Awning design direction: "Opening day"

**In three lines.** Awning looks like a street, not a dashboard: awning.sh wears a painted, scalloped canopy in canopy green and canvas, and its hero is a shop window where one sentence is lettered on the glass, clears, and becomes a live storefront that rings and takes an agent's first 5 USDC on a printed receipt. Every generated business gets its own awning, palette, font pair and poster object, so it reads as an independent shop with a slim "Opened with Awning" ribbon. Receipts, tickets, price tags and a street of shopfronts carry the rest of the story; money is always shown as a receipt, never as a dashboard.

![Landing, desktop](shots/final/landing-1440.png)

## How we got here (studio method, lean)

1. **References** from the taste library (424 captured and annotated sites, calibrated jury): food and indie-commerce award winners plus payments brands that refused the dashboard look. Boards: `moodboards/refs-landing.png`, `moodboards/refs-storefront.png`. What each teaches is in `BRAND.md`.
2. **Brand first** (`BRAND.md`): essence "Open"; tension corner-shop warmth × machine-exact payments; mark = a front-view awning; Archivo across its width axis; canopy green + canvas + one tomato accent; the street as the single image language.
3. **Three concepts**, two built in code:
   - **A. Opening day (built, chosen):** the page *is* a shopfront. A canopy crowns the screen; the hero is a shop window where the sentence becomes a business, with a hanging OPEN sign, a phone chip and a receipt.
   - **B. The street (built, merged in):** every business opened on Awning is a shop on one endless street; the hero builds your shop into an empty lot between the others.
   - **C. The sign painter (rejected at concept stage):** a type-only hero where the sentence is hand-lettered and then re-sets itself into the business's own sign. Rejected: it shows the brand but not the product working (no phone, no payment), and kinetic type alone drifts toward the "broadsheet" cluster.
4. **Executions** at 1440 and 390, screenshotted with Playwright, critiqued against award references, then iterated three rounds on the winner (below).

## Why A wins (and what we took from B)

| | A · Opening day | B · The street |
|---|---|---|
| Shows the product working in 5 s | Yes: sentence → site → phone → agent purchase → +5.00 | Partly: the shop appears, but the phone and payment are small bubbles that crop |
| Memorability | High: the canopy and the flipping OPEN sign | Highest: a whole street of businesses |
| Brief fit ("hero = the product working") | Exact | Loose |
| Risk | Split hero is a familiar layout | Illustration could read as clip-art; weaker proof |

A is the hero because the judges' first question is "does it work end to end", and A answers it in one loop. B was too good to throw away, so the street became the **"Opened today"** section (fed by `/v1/live`) and the **X header**: the directory as a place you can walk.

| A · Opening day (round 1) | B · The street (round 1) |
|---|---|
| ![A desktop](shots/directions/a-shopfront-1440.png) | ![B desktop](shots/directions/b-street-1440.png) |
| ![A phone](shots/directions/a-shopfront-390.png) | ![B phone](shots/directions/b-street-390.png) |

Sources: `directions/a-shopfront/index.html`, `directions/b-street/index.html`.

## Iterations on the winner

- **Round 1 → 2 (landing):** headline cut from 4 lines to 3; the phone chip moved off the storefront name; the receipt moved off the offers; the mini storefront got a rod, its own canopy and a menu list instead of three tiles; the OPEN sign hangs from a longer chain so it no longer covers the domain; phone layout recomposed (headline → window → copy; receipt hangs below the window instead of covering it); `.stage` collapsed to 0 width on phones (fixed); "how it works" ticket text was inheriting the light paragraph color (fixed); "19.00 USDC" wrapping in the approval sheet (fixed); tool board columns rebalanced; final CTA headline down to 2 lines.
- **Round 2 (storefront):** Spoke & Chain's poster hero dropped its art to a second row (fixed with explicit grid rows); a 1 px seam between the canopy's stripes and scallops on phones (fixed by overlapping the mask layers); the agent prompt lowercased "Saturday" (fixed); a TDZ bug blanked every storefront after the free-plan change (fixed; `tools/errs.mjs` now checks console errors on every page); per-business favicon added.
- **Round 3 (copy and chrome):** removed every "A · B · C" meta string (a template-chrome tell) in favour of sentences; free-plan and draft states hide phone UI; reviewers' findings (below) applied.

## Deliverables

| What | Where |
|---|---|
| Brand doc | `design/BRAND.md` |
| Mark, wordmark, lockups (SVG, outlined) | `design/brand/logo*.svg`, `mark*.svg`, `wordmark*.svg` |
| Favicon set, app icon, X avatar | `design/brand/favicon.svg`, `favicon-32/180/512.png`, `app-icon.svg`, `social/avatar-400.png` |
| Tokens (OKLCH) | `design/brand/palette.css` |
| Brand sheet (palette, type scale, buttons, voice) | `design/brand/index.html` → `shots/final/brand-sheet-*.png` |
| OG image 1200×630 | `design/brand/social/og.png` (source `og.html`) |
| X header 1500×500 | `design/brand/social/x-header.png` (source `x-header.html`) |
| Landing (awning.sh) | `design/landing/index.html`, `landing.css`, `landing.js`, `assets/` |
| Storefront template | `design/storefront/index.html?b=<slug>[&state=draft]`, `storefront.css`, `storefront.js` |
| Sample businesses + poster art | `design/shared/businesses.js`, `design/shared/art.js` |
| Project design skill | `.claude/skills/awning-design/SKILL.md` |
| Screenshots (1440 and 390, first screen + full) | `design/shots/final/` (round 2 in `shots/round2/`, directions in `shots/directions/`) |
| Review: jury, Arena, AI test | `design/review/jury.md`, `design/review/arena-verdicts.md`, `design/review/arena/` |
| Tools | `design/tools/` (`shot.sh`, `finalshots.sh`, `sections.mjs`, `errs.mjs`, `render.mjs`, `brand-gen.mjs`) |

## The storefront every business gets

![Ridge Roast](shots/final/storefront-ridge-roast-1440.png)
![Spoke & Chain](shots/final/storefront-spoke-and-chain-1440.png)
![Barro](shots/final/storefront-barro-studio-1440.png)
![Draft](shots/final/storefront-draft-ridge-roast-1440.png)

- **Themed from four API colors.** `GET /v1/businesses/:slug` returns `palette {primary, accent, ink, paper}`; `themeFrom()` derives ground, ink, accent, stripes and a deep tone. The category picks the font pair and one of three hero compositions: `sign` (name left, poster object right), `poster` (huge condensed caps with a slowly turning wheel), `arch` (the object in an arched shop window, name in a soft serif).
- **Real independent-shop anatomy:** their own canopy; the name as a sign; status ("Open today 7:00–17:00 in Accra"); one primary action with its price; offers as a menu board, not cards; a "Buy with your AI agent" slip with the exact prompt and the x402 link (`https://api.awning.sh/x402/b/:slug/:sku`) plus the payTo wallet; about, hours, call; the Awning ribbon.
- **Draft ("Preview, not open yet"):** caution-tape bar, canopy rolled up, kraft paper over the window with an "Opening soon" stamp, buy buttons disabled, no phone shown.
- **Integration notes for `web/` (W-A):** port `storefront.css` as-is (all values are CSS variables set on `:root`), render the markup in `storefront.js` server-side in `/s/[slug]`, set the variables from `themeFrom(business.palette, business.category)`, and load the two Google fonts for the category. Offer ids map to `sku`. Hide phone UI when `business.phone` is empty.

## Landing integration notes

- `landing/` is static; port to the root host of the Next.js app. Assets are in `landing/assets/`; OG at `landing/og.png`.
- The street reads sample data now; `landing.js` has the `GET /v1/businesses?live=1` hook commented in place. Never show invented counters; when the API answers, use real openings and last sales.
- Fonts: Archivo + Martian Mono for Awning; the storefront fonts only for the street's signboards (they can be subset to the business names).

## Self-critique (studio review format)

Filled in from the round-3 review; see the next section.
