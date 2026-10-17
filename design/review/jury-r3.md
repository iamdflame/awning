# Jury round 3: Awning (landing page + generated storefront)

Judged only from the listed screenshots. I read no markdown and no review files.

## Calibration

- **Anchor A, Shopify Editions Winter '26 (~8.2).** One idea carries the screen: a golden-ratio construction drawn in hairlines on black, with a small, exact wordmark at the centre ("Ren-ai-ssance"). It has total restraint, and the concept and the form are the same thing.
- **Anchor B, 2°C Earth (~6.5).** Strong typographic contrast (caps grotesk with a serif country name) and a multilingual marquee. It is well made but uses a familiar pattern, with little brand world beyond the type.
- **Anchor C, Great Lakes Theater (~5.0).** Competent institutional chrome: stacked utility bars, a stock-style hero photo, caps nav and a lavender pill button. Nothing in it is designed beyond the template.

Scale used: 8+ is Site-of-the-Year territory, ~7 is a solid Site of the Day contender, 6.5 is Honorable Mention and 5 is ordinary.

---

## Surface 1: Marketing landing page (landing-1440, landing-390, full pages)

What is there:
- **Header and hero.** A pine-green header with a scalloped green/cream awning valance. The hero headline "Open for business in one sentence." is set in a heavy wide grotesk. On the right are a body paragraph and two stacked pill CTAs (coral "Open yours", outlined "See what opened today").
- **The street.** An illustrated street of flat-vector shopfronts (Ridge Roast in the centre). A floating phone-number chip overlaps the shop sign, and a receipt slip in monospace ends in "+5.00".
- **Full page.** Green "Say it. Tap once. You're open." three-step section, then a cream street showcase, a dark-green "Its first customer was an AI." with a monospace tool list, hang-tag pricing (Free / $9), "Your money never passes through us." with a receipt, the final CTA and the footer.

### (1) Art director
| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 6.6 | 6.8 | 6.8 | 7.0 | **6.74** |

**What works**
- The awning is a real brand device, not decoration. It appears as the header valance, on every shop, and as the full-width scallop before the final CTA.
- The hero street is ownable, and the coral/pine palette is confident.
- The hang-tag pricing cards are the best idea below the fold.

**What holds it back**
- **The illustration.** It is built from geometric primitives: trapezoid bag, perfect arcs, uniform noise grain, identical door arches. It reads as coded SVG, not as an illustrator's hand.
- **The hero's right column.** It is an orphaned block: a paragraph floating at the top right, and two stacked buttons of unequal width that align with nothing in the headline.
- **The page below the hero.** It falls back to the standard SaaS sequence (3 steps → showcase → feature panel → pricing → trust list → CTA). Each section is fine, but none of them is staged.

**Changes that would raise it most**
1. Bring in a real illustration hand: varied line weight, perspective, imperfect edges and people in the doorways. Alternatively, mix photographed real storefront textures into the vector street.
2. Rebuild the hero as one composition. Set the headline across the shop sign or the street, and put the CTA physically in the street (on a shop door, or on the "OPEN" sign) instead of in a separate right column.
3. Make the scroll a walk down the street, with each section as a door that opens. That lets the metaphor drive the layout instead of a stack of alternating cream and green bands.

### (2) Product / UX designer
| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 6.8 | 6.5 | 6.8 | 6.8 | **6.71** |

**What works**
- The value proposition reads in under 3 seconds, and the primary CTA repeats in the nav.
- The pricing is honest and scannable.
- The receipt makes the payment flow concrete.

**Problems**
- **No action in the phone first screen.** On the 390 first screen, the only action is the header "Open yours". The explanation and the CTAs start below the illustration, about 1.9 screens down.
- **Mobile page length.** The 390 full capture is about 9,500 CSS px. In the thumbnail the hero headline and the "Say it. Tap once." block appear to **repeat near the bottom of the page**. Check whether this is a duplicated-render bug or the final CTA. If it is duplication, it is a ship-blocker.
- **The tool-list panel.** ("awning_open", "awning_find"…) It is set in small monospace with tiny status pills. It is dense and illegible at a glance, and the business owner is the primary user.
- **Jargon.** "USDC", "Base", "x402" and "wallet" arrive without explanation for a non-crypto shop owner.

**Changes that would raise it most**
1. On phone, put a short 1-line subhead and the primary CTA directly under the headline, above the illustration. Then cut the mobile page length by about 30%.
2. Split the two audiences explicitly: an owner path (plain language, no chain names) and an agent/developer path (the tool list, x402). The tool panel can move to Docs.
3. Show the actual one-sentence interaction as a real, legible chat moment in the hero: the sentence typed, then the shop appearing. At the moment that animation only exists as a loop frame, and the full-page frame shows "Open a bike|" in an empty dark shop.

### (3) Brand strategist
| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 6.8 | 7.0 | 7.0 | 6.5 | **6.87** |

**What works**
- "Awning" is a good name with a built-in visual metaphor, and the brand uses it.
- "Open yours" is a strong, warm CTA verb.
- The shops are specific (Accra, Austin, Lisbon) and stand in well for the idea "real small business, anywhere."

**What holds it back**
- **The tone splits in half.** The upper page says "corner shop". The middle says "crypto infra" (tool registry, USDC on Base, wallet addresses like 0x7a3F…9c21). The brand has not decided whether it sells to shopkeepers or to agent developers.
- **The headline "Its first customer was an AI."** It reads as a typo ("It's") without the preceding context. The logo mark (a tiny awning glyph next to the wordmark) is generic.

**Changes that would raise it most**
1. Pick a hero audience (owners) and move the crypto vocabulary down into a "for agents" chapter with its own register.
2. Commission a proper wordmark. Hand-cut letterforms with the scallop in the type would be ownable; the current glyph plus lowercase sans is not.
3. Replace the illustrated shops with one or two real people's shops, shown as photos with real names. Proof beats illustration for a "real business" claim.

**Landing page average: 6.77.** That is solid Honorable Mention level, slightly above Anchor B on craft and below it on restraint. It is not a Site of the Day yet.

---

## Surface 2: Generated storefront (Ridge Roast, Spoke & Chain, Barro, draft)

What is there:
- **A shared skeleton.**
  - A header with the business name, live hours and city ("Open today 7:00–17:00 in Accra"), nav (Menu / Buy with an agent / Visit) and a "Call Ama" pill.
  - A themed awning strip, then the hero: a huge display name, a one-line description and an offer list with price, local-currency estimate and an action button. A flat-vector product illustration sits on the right.
  - Below the hero: "Buy with your AI agent" (copy prompt and x402 link), then About / Hours / Call, then an "Opened with Awning" bar.
- **The themes.**
  - **Ridge Roast:** maroon and mustard, slab serif.
  - **Spoke & Chain:** yellow, black and cobalt, condensed grotesk, rotated paper price tags, a wheel with a wrench.
  - **Barro:** navy and an azulejo tile strip, soft serif, white offer cards, a ceramics still life in an arch.
- **The draft state.** A hazard-tape banner, a retracted awning strip, a kraft-paper "Opening soon" stamp and "Notify me" ghost buttons.

### (1) Art director
| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 6.3 | 7.0 | 6.4 | 7.0 | **6.60** |

**What works**
- The Ridge Roast hero is the strongest frame of the whole submission: poster-scale cream slab type on oxblood, with a disciplined left column.
- In the draft state, retracting the awning to a thin rolled strip is a genuinely witty detail.

**What holds it back**
- **Spoke & Chain.** It is loud but messy. The wrench skewers the hub like a kebab, and the three tags rotate at random and have different internal rhythm: the title wraps to two lines on the middle tag only, so the prices and buttons sit at different heights.
- **Barro.** It is the weakest: white rounded cards with a soft grey shadow and blue pill buttons, i.e. a SaaS card kit dressed in tiles.
- **The illustrations.** All three products (bag, wheel, jug) are drawn in the same primitive-shape vector style. The right half of the Ridge Roast hero is a single small object floating in a lot of maroon.

**Changes that would raise it most**
1. Give each theme its own layout grammar, not just a token swap.
   - Spoke & Chain: a pegboard or workshop wall of tags on hooks, aligned to a real grid.
   - Barro: offers laid out as glazed tiles in a catalogue grid.
   - Ridge Roast: a chalkboard menu.
2. Replace or augment the illustrations with photography slots: the owner's real product photo, duotoned into the theme palette. Real coffee, real bikes, real pots.
3. Fill the hero's right half with a composed scene (product, steam, hands, a counter) or crop the object large and bleed it off the edge. Do not float a small icon in empty space.

### (2) Product / UX designer
| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 6.5 | 7.0 | 6.3 | 6.8 | **6.64** |

**What works**
- The basics are excellent: hours and city in the header, Call as the primary header action, and each offer has a price, a unit and a local-currency estimate ("about GH₵78") next to a direct verb (Book / Buy / Subscribe).
- The draft state is clear about who can see it and what to do next.

**Problems**
- **Collisions at 390.** On the Ridge Roast phone screen, the bag's shadow and beans collide with "Ridge". On Spoke & Chain, the wheel and wrench overlap "SPOKE" and crop off the right edge. Both read as collisions, not as intentional overlaps.
- **Mobile nav.** It drops Menu, Buy with an agent and Visit with no menu control.
- **Mismatched buttons.** In Spoke & Chain the buttons differ in size and position per tag (rotation plus content length). On Barro, the button sits below the copy while the price floats right, so the eye zigzags.
- **The agent section.** It exposes a raw monospace x402 URL and a wallet address to an end customer. That belongs behind a disclosure.

**Changes that would raise it most**
1. Fix the phone hero hierarchy: stack the illustration and the name cleanly (or set the name over the illustration on purpose, with contrast control). Keep a compact nav or anchor chips.
2. Normalise the offer-row anatomy (title / note / price / action on one baseline grid) across all themes, so that themes vary the skin, not the usability.
3. Collapse the developer details (pay link, wallet) under "Using an agent? Show the link", and keep the copy-prompt button as the visible action.

### (3) Brand strategist
| Design | Usability | Creativity | Content | **Weighted** |
|---|---|---|---|---|
| 6.4 | 7.2 | 6.0 | 6.8 | **6.60** |

**What works**
- The microcopy feels owner-written and local: "Sit at the bar on the hill", "Flats fixed while you wait", "From a batch of twelve". Named phone staff (Ama, Rosa, Inês) make the shops feel like they have people in them.

**What holds it back**
- **Every shop shares one illustrator.** Sharing a hand is how you spot a template: a customer who sees two Awning shops will recognise the house style, which weakens each owner's own brand.
- **The "Opened with Awning" bar.** It is a saturated green strip that clashes with every theme palette. It reads as an ad, not a maker's mark.

**Changes that would raise it most**
1. Let the business's own identity lead. Generate or accept a real logo and photography, and push variation into type pairing, layout and imagery, not only colour.
2. Turn the Awning credit into a small, theme-coloured stamp ("Opened with Awning, 2026") that suits each shop.
3. Give each business a short about-story in the hero area (who, since when, where) so the shops do not all share the same "name + one-line + menu" voice.

**Storefront average: 6.61.** Ridge Roast alone would score about 6.9, Spoke & Chain about 6.5 and Barro about 6.0. As a generated system this is impressive range. As individual sites they sit around Honorable Mention, with Barro below it.

---

## Score table

| Surface | Art director | Product/UX | Brand strategist | **Average** |
|---|---|---|---|---|
| Landing page | 6.74 | 6.71 | 6.87 | **6.77** |
| Storefront system | 6.60 | 6.64 | 6.60 | **6.61** |

The anchors were 8.2, 6.5 and 5.0. Both surfaces sit at Honorable Mention level, roughly 1.5 points short of Anchor A. The missing points are a single governing idea executed with total restraint, and an illustration or imagery craft that a studio would sign.

---

## AI-detection test (first screens)

### Clusters and tells that match

**1. Warm cream plus a dark/terracotta-family accent (partial match).**
- **landing-1440:** off-white cream ground (#F5F3EA-ish), deep pine green, coral/tomato pill CTA.
- **storefront-ridge-roast-1440:** a cream header bar plus cream slab-serif display type on oxblood/rust, with mustard accents.

The display face is a wide sans (landing) or a slab (Ridge Roast), not a high-contrast didone, so this is adjacent to the cluster rather than a textbook match. Still, the "warm cream + earthy red + heavy display" mood is exactly where AI tools land when asked for something "warm and human".

**2. Template chrome, monospace small labels.**
- The landing hero receipt is all monospace: "awning_plan…ready", "ridgeroast.co…registered", "USDC FROM AN AGENT TO 0x7a3F…9c21", in caps mono.
- Below the fold the same mono appears in the tool list and in the storefront's x402 URL field.
- This is the "receipt / terminal snippet as decoration" move common in AI-built fintech and dev pages.

**3. Template chrome, other.**
- A red-dot "Opened today" eyebrow pill (landing full page).
- Numbered yellow circles on the 3-step section.
- Icon-in-green-rounded-square bullets in "Your money never passes through us".
- Floating UI chips (the "Ama answers the new line" phone pill overlapping the hero shop sign) are the standard AI hero device of product fragments orbiting an illustration.

There are no tracked all-caps eyebrows and no arrows appended to buttons, which is to its credit.

**4. SaaS card kit.**
- Not in the four first screens tested, but it sits next to them: Barro's three identical white rounded cards with the same soft grey shadow and identical blue pill buttons. The landing's pricing tags partly escape this through the hang-tag silhouette.

**5. Spoke & Chain (storefront-spoke-and-chain-1440).**
- Condensed display caps in the Bebas/Anton family (a default free "bold and punchy" choice), randomised card rotation as fake handmadeness, and a dotted perforation border.
- This is a recognisable AI "playful brutalist" recipe, not a designed system. The yellow/black/cobalt palette is not the near-black-plus-acid cluster.

**6. Skeleton and illustration.**
- Not the default centred skeleton: both are left-aligned, asymmetric heroes.
- The illustration style is the biggest tell. Every object is built from SVG primitives (trapezoid bag, perfect circles, regular spokes, identical arches) with one uniform grain overlay, and the same style is applied to coffee, bikes and ceramics.

**Clean on:**
- no Inter/Poppins display, no purple gradient, no gradient text, no glassmorphism, no emoji icons, no fake logo wall, no inflated stats.

### Verdict: AI coding assistant, well directed (about 70% confidence)

This is not a human studio. The direction is better than typical AI output: one real metaphor (the awning) carried through, specific microcopy, a witty draft state. The execution gives it away:
- primitive-built SVG illustration with uniform grain;
- token-swapped themes on one skeleton;
- the stock SaaS section order below the hero;
- monospace receipt and terminal decoration;
- floating UI chips;
- loose alignment, such as the landing hero's right column of unequal stacked buttons, and the misaligned rotated tags with collisions at 390.

A top studio would have either commissioned an illustrator or committed to photography, and would have let the street metaphor shape the layout itself.

### Three changes that would most make it read as a top studio's work

1. **Bring in a hand.** Replace the primitive-shape SVGs with commissioned illustration (line-weight variation, perspective, people, imperfection) or art-directed photography duotoned into each palette. This single change removes the strongest AI signal on both surfaces.
2. **Let the metaphor build the layout.** Make the landing scroll a walk down the street, where doors open into chapters and the CTA is the "OPEN" sign. Give each storefront theme its own layout grammar (chalkboard menu, pegboard of tags, tile catalogue), not one skeleton with swapped tokens.
3. **Strip the template chrome and set a bespoke type voice.** Remove the mono receipts and terminal panel from owner-facing views, plus the eyebrow dot pill, numbered circles, icon-square bullets and floating chips. Then commission a real Awning wordmark and pick display faces with character per theme instead of the default free-font choices.
