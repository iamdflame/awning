# Awning: jury review (round 2)

Rubric: Awwwards weights. Design 40%, Usability 30%, Creativity 20%, Content 10%. Three independent specialists. Judged only from the screenshots in `design/shots/round2/`.

## Calibration

| Anchor | What earns the score | Score |
|---|---|---|
| A. Shopify Editions Winter '26 | One idea, fully committed: a golden-ratio construction drawn as hairline geometry on black, with the title set small at its focal point. There is no hero formula and no button pair. The restraint carries the authority. | ~8.2 |
| B. 2°C Earth | Typographic hero only, with a grotesk/serif pairing per line and a multilingual ticker. Distinct voice, little else on the page. | ~6.5 |
| C. Great Lakes Theater | Competent institutional template: promo bar, nav, photo hero, ALL-CAPS headline, pill button. It works but it is forgettable. | ~5.0 |

Awning is measured against these. To clear 6.5 it needs one unmistakable idea carried through with the restraint of B. To sit above 5.0 it has to be more than a well-executed template.

---

## Surface 1: Marketing landing page

What the jury sees:
- **Desktop (1440).** Dark-green nav. A scalloped green and white awning valance runs under the nav. The hero is a split: a heavy geometric-grotesk H1 "Open for business in one sentence." on the left, with a coral primary button and a ghost secondary button. On the right is a device mockup of the Ridge Roast storefront with a hanging red "OPEN" sign, a monospace receipt overlapping it and a phone-call pill.
- **Desktop full page.** The page continues with:
  - a green band with three numbered steps (cards plus 1/2/3 circles);
  - an illustrated street of shopfronts ("Every shop on this street started as one sentence"), the strongest moment on the page;
  - a dark section with a tool table in monospace;
  - two pricing cards drawn as hanging paper price tags;
  - "Your money never passes through us", with three icon-plus-text rows and a receipt;
  - a closing CTA under another awning, then the footer.
- **Phone (390). Broken.** The page renders as unstyled HTML: blue underlined links, Times, a broken logo image, a giant black circle, and full-width SVG icons (storefront, fingerprint, checkmarks) blown up to roughly 700px. The full page is 18,186px of raw markup. Whether the cause is a stylesheet that failed to load or a capture fault, this is what the jury sees. It is scored as delivered and flagged as the top priority.

### Specialist 1: Art director

| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 5.8 | 4.5 | 6.0 | 6.5 | **5.52** |

- **What works.** The awning valance is a real brand device, and the hanging OPEN sign, hanging price tags and receipts all come from one storefront metaphor. The street of shops is the one image a juror would remember. The colour is confident: bottle green, coral and off-white.
- **What does not.** The hero is the stock split layout: H1, paragraph, two buttons, a small trust line, and a mockup collage on the right. The collage overlaps three objects (device, receipt, call pill) in the familiar "product UI floating in space" way. Sections alternate cream, green, cream, dark and green at the same rhythm and density, so the page reads as a stack of modules rather than one composition. The heavy grotesk display is competent but generic, with no custom letterform or lettering tied to signage, even though the whole concept is signage.

Three changes that would raise the score most:
1. **Make the street the hero.** Open on the illustrated street at full bleed. Typing the sentence should raise a new shopfront's awning in the gap. Drop the device-mockup collage entirely.
2. **Commission a signage typeface or lettering** for display: sign-painter, enamel-sign or awning lettering. Replace the stock bold grotesk so the type carries the concept.
3. **Break the module rhythm.** Merge the three-step band and the "money never passes through us" icon rows into the street narrative, for example by walking into one shop. Fewer, larger, deliberate scenes are better than six equal-weight sections.

### Specialist 2: Product / UX designer

| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 6.0 | 3.5 | 5.8 | 6.5 | **5.26** |

- **What works.** The value proposition is clear within 3 seconds: "Open for business in one sentence." There is one primary action. The trust line names the compatible agents. The pricing is honest and easy to compare (Free vs $9/month).
- **What does not.**
  - **Phone is unusable.** A broken logo, nav links run together ("How it worksFor agentsPricing…"), icons are hundreds of pixels tall, and the page is 18k px long. That alone caps usability.
  - **Desktop has cognitive load.** "PayBox", "x402", "USDC", "Base" and "wallet" appear in the first two screens, while the audience (a small-business owner) never learns what PayBox is before being told the product is "a PayBox plugin".
  - **The hero mockup shows two different states** in the two captures (Ridge Roast open, then a "CLOSED" bike-shop prompt). An auto-advancing animation in the hero with no control competes with the headline.
  - **The monospace tool table** ("awning_plan", "awning_find"…) is developer content placed mid-funnel on a merchant page.

Three changes that would raise the score most:
1. **Fix the 390 build.** Make sure CSS loads at every breakpoint, constrain SVG icons with explicit width and height, fix the logo `src`, and re-capture.
2. **Split the audiences.** Keep the merchant story on the landing page. Move the tool table, x402 and Base details to /docs or /for-agents, and explain PayBox in one plain clause before relying on it.
3. **Make the hero demonstrate the action.** Use a real input or a "try a sentence" field, wired to the draft storefront ("Opening soon" state). Do not use a passive auto-playing collage.

### Specialist 3: Brand strategist

| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 6.0 | 4.5 | 6.3 | 5.8 | **5.59** |

- **What works.** The name and the mark are well matched. "Awning" is the thing that turns a doorway into a shop, and the valance is ownable. The "Opened today" and "Every shop on this street" lines turn a technical product into a neighbourhood. The writing is plain-spoken and mostly free of hype.
- **What does not.**
  - **Brand architecture is muddled.** Awning, PayBox, Claude, ChatGPT, Base and USDC all appear in the hero. The trust line leads with another brand ("A PayBox plugin").
  - **The Ridge Roast demo is incoherent.** It is a coffee shop "above Accra" with an Austin +1 (512) number. A real business owner would notice.
  - **The tone drifts** between warm main-street ("Open yours") and crypto plumbing ("USDC FROM AN AGENT TO 0x7a3F…9c21"). The crypto plumbing is what makes the brand feel risky to the exact audience it courts.

Three changes that would raise the score most:
1. **Pick one promise and one audience** for the first two screens: "your shop, open today". Push USDC, Base and x402 below the fold and phrase them as benefits ("paid straight to you, no cut").
2. **Make every sample business internally true.** Use local phone formats, real-sounding addresses and prices in the local currency alongside USDC. The demo is the proof, so it cannot contain errors.
3. **Turn "Opened today" into the brand engine.** Run a live (or credible) feed of real shops opening, with real names and towns. Social proof that is the product beats any mockup.

---

## Surface 2: Generated storefront (Ridge Roast, Spoke & Chain, Barro, draft)

What the jury sees:
- **Every storefront** uses the same template: a dark nav with the business name, Offers / Buy with an agent / Visit links and a "Call <name>" pill; the scalloped awning valance in the shop's colours; and a split hero with a huge name, a one-line description, a green-dot "Open today hh:mm · City" pill, a primary "Book · N USDC" button and a phone-number ghost button, with a flat vector product illustration.
- **Ridge Roast full page** adds:
  - a dark "On the bar" price list, the best section, with real menu typography;
  - a "Buy with your AI agent" card with copy-prompt and an x402 link;
  - an About / Hours / Call footer row;
  - a green "Opened with Awning" bar.
- **Draft state:** caution-tape banner, a striped awning that is not yet unrolled, a cardboard "Opening soon" panel and a faded Book button. A charming state that shows real product thinking.
- **Phone:** clean and correctly styled. The illustration falls below the CTAs.

### Specialist 1: Art director

| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 5.6 | 6.5 | 5.2 | 6.0 | **5.83** |

- **What works.** Each palette and display-face pairing gives the shops some identity. Spoke & Chain (condensed black grotesk on yellow, with a blue awning) is the strongest. "On the bar" is a well-set price list, and the draft state is the most inventive frame in the whole set.
- **What does not.**
  - **The theming is a reskin, not a design.** Three businesses share an identical skeleton, so only colour and font change.
  - **The illustrations are SVG-primitive flat vectors** with grain noise, and they read as placeholder art.
  - **Craft bugs:**
    - On the Ridge Roast bag (1440 and 390), the circular "VOLTA · WASHED" text collides with the badge ring: the "V" and the "D" are cut by the stroke.
    - The nav links sit about 8px above the vertical centre of the Call pill on every storefront.
    - The hero leaves the bottom third of the first screen empty on desktop.

Three changes that would raise the score most:
1. **Give each business a structural variant,** not just a palette. Vary the hero composition by category: a menu-board layout for food, a workshop pegboard for repair, a gallery wall for a studio. Pull the price list into the first screen.
2. **Replace primitive vector art** with generated or illustrated imagery of real quality per business (photography-style or a consistent illustrator's hand). Fix the clipped badge type.
3. **Tighten the first screen:** align the nav baseline, use the empty band below the CTAs for the first offer or the hours, and let the awning stripe vary per shop (scallop, straight or striped) so it is not Awning's stamp on everyone.

### Specialist 2: Product / UX designer

| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 5.8 | 6.6 | 5.0 | 5.8 | **5.88** |

- **What works.**
  - The primary action is visible and priced ("Book · 5 USDC"), and the phone number is a one-tap secondary.
  - The open/closed status is explicit.
  - The offers list has clear price, unit and action.
  - The draft banner tells the owner exactly how to go live.
  - The mobile layout is correct and thumb-friendly.
- **What does not.**
  - **Pricing excludes ordinary buyers.** Prices are USDC-only, with no fiat equivalent or card path visible, so a normal human customer hits a wall.
  - **The hero CTA is the tasting,** not the coffee most visitors came for.
  - **Developer artefacts are exposed to shoppers:** the x402 URL, the wallet address 0x7a3F…9c21 and "USDC on Base".
  - **On 390, the offers start below roughly 1.5 screens** because the bag illustration comes first.
  - **In the draft state, Book is faded but still looks pressable.**

Three changes that would raise the score most:
1. **Show a local-currency price next to USDC** (e.g. "5 USDC ≈ GH₵ 75") and make the human checkout path explicit (card or wallet) at the point of purchase.
2. **On mobile, put the offers list directly after the CTAs** and shrink or move the illustration. Let the hero's primary action be chosen by the owner's top-selling offer.
3. **Collapse the agent/x402 block** into a single "Buy with your AI agent" disclosure. Disable or replace Book in the draft state with a "Notify me" action.

### Specialist 3: Brand strategist

| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 5.5 | 6.3 | 4.8 | 5.5 | **5.60** |

- **What works.** The owner names on the call button (Ama, Rosa, Inês) humanise the shops. The copy is specific: "Roasted Tuesday", "Flats fixed while you wait", "Marvila, Lisbon".
- **What does not.**
  - **The merchant's brand is subordinate to Awning's.** Every shop wears the same scalloped awning, the same pill and button system and the same footer bar. Customers will see "an Awning site", not "Ridge Roast".
  - **Coherence errors:** Accra with a +1 (512) number, and every price in a crypto stablecoin. These undercut the "real small business" claim.
  - **There is no imagery of people, place or product reality,** so none of the shops feels real.

Three changes that would raise the score most:
1. **Generate a small identity per business** (wordmark lettering, a signature colour, one hero image) and keep Awning's presence to a quiet footer credit and the checkout.
2. **Localise every detail:** phone formats, currency and address. A storefront is only as credible as its smallest fact.
3. **Add one authentic photo** (or generated, art-directed equivalent) of the place or the product per shop. Real texture is what separates a shop from a template.

---

## Score table

| Surface | Art director | Product/UX | Brand strategist | **Mean** |
|---|---|---|---|---|
| Landing page | 5.52 | 5.26 | 5.59 | **5.46** |
| Storefront | 5.83 | 5.88 | 5.60 | **5.77** |

If the 390 landing breakage is purely a capture fault, add roughly 0.6 to the landing scores, which would put the landing at about 6.0. Even then it sits below Anchor B (6.5): it is more crafted than Anchor C, but still template-shaped.

---

## AI-detection test (first screens)

### landing-1440.png

| Cluster or tell | Match? | Where |
|---|---|---|
| Cream + serif + terracotta | **Partial** | Off-white cream ground with a coral-red accent on both buttons and the OPEN sign. The display face is a heavy sans, not a serif, but the device mockup inside the hero brings in the Ridge Roast slab serif on cream with terracotta. |
| Near-black + acid accent | No | |
| Broadsheet / document | No | |
| SaaS card kit | Mild | The rounded device frame plus a floating call pill with a soft grey shadow. The full page has a three-step numbered-card band and icon-plus-text feature rows. |
| Template chrome | **Yes** | An icon appended to the primary button ("Open yours" + storefront glyph), which is the arrow-on-button tell. The monospace small-label receipt ("awning_plan … ready", "USDC FROM AN AGENT TO 0x7a3F…9c21"). A green-dot status pill ("Open now in Accra"). Tracked caps on "OPEN" and "RIDGE ROAST". The full page has a red-dot "Opened today" eyebrow. |
| Default skeleton | **Yes** | Not centred, but the other stock skeleton: a split hero with left H1, paragraph, filled plus ghost button pair, small trust line, and a right-hand floating product-UI collage. |
| Coloured glow under primary button | Yes | Coral drop shadow under "Open yours". |
| Purple gradient, gradient text, glass, emoji, fake logos | No | |

### landing-390.png

The CSS is not applied, so there is no design to judge. A broken `<img>` logo and the run-together nav text are themselves a tell of unreviewed, generated output that nobody looked at on a phone.

### storefront-ridge-roast-1440.png

| Cluster or tell | Match? | Where |
|---|---|---|
| Cream + serif + terracotta | **Full match** | Warm cream `#f1e3cc`-ish ground, heavy slab-serif display "Ridge Roast", terracotta "Book" button and terracotta bag. This is the cluster almost exactly. |
| "A · B · C" meta strings | **Yes** | "Open today 7:00–17:00 · Accra", "Book · 5 USDC", "VOLTA · WASHED". The full page adds "Pays 0x7a3F…9c21 · USDC on Base · one approval per payment" and "ridgeroast.co · Accra, Ghana". |
| Green-dot status pill, glow under primary button, filled + ghost button pair | Yes | Hero, under the description. |
| Split-hero skeleton | **Yes** | Repeated identically across all three businesses; Barro only mirrors it. |
| Flat SVG-primitive illustration with grain overlay | Yes | Coffee bag, wheel and wrench, pottery. Each is built from basic shapes, and the circular text collides with its ring. |

### Verdict: AI coding assistant

This reads as AI-assisted, above the average of AI-made work, but not human-studio work.

Visual evidence:
1. **Every surface uses the same split-hero formula** (H1, line, status pill, filled and ghost button pair, illustration). The three businesses are one template with only palette and font swapped.
2. **The dot-separated meta strings, green-dot pills, glowing primary buttons and an icon appended to the CTA** are the standard generated-UI kit.
3. **The illustrations are assembled from SVG primitives** with uniform grain, and show code-drawn errors that an illustrator would never ship: circular text clipped by its own ring.
4. **Small unreviewed errors** are visible: nav links off-centre against the pill, Accra with an Austin area code, and a phone build that ships unstyled.
5. **Section rhythm is uniform** (equal-weight modules alternating background colour).

Arguing the other way: the awning valance, the hanging OPEN sign, the hanging price tags, the street of shops and the cardboard "Opening soon" draft state show a genuine single concept. That is more art direction than most AI output, and it is why the scores sit above Anchor C.

### Three changes that would most make it read as a top studio's work

1. **Kill the split hero.** Open the landing page on the illustrated street at full bleed: one sentence typed, one awning unrolling, one shop lighting up. That is a single committed idea, the way Anchor A commits to its golden-ratio drawing. No button pair, no floating mockup collage.
2. **Replace the stock type and primitive art with a hand.** Use bespoke signage lettering for the Awning display. Give each shop real art-directed imagery and a structurally different layout by category, and strip the "· · ·" meta strings, status pills and button glow.
3. **Ship craft.** Use a working phone build and correct local facts (phone, currency, address). Fix the clipped badge type and the misaligned nav, and give each business a quieter Awning footprint so each shop looks like itself.
