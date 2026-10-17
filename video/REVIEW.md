# Creative review: the Awning demo film

**What's in the film now:** the founder's three real takes, cut to their strong moments, and the real product filmed from awning.sh. Ridge Roast opened on Pro at ridgeroast.shop for 11.06 USDC (tx `0x285a4e…881c4c`). A fresh Claude.ai chat that knew nothing about the shop then bought its 5.00 USDC tasting, paid straight to the owner's wallet (tx `0x893b3f…9e7651`, booking RID-7R4G4U). Nothing in the film is mocked or staged, and no LOCAL MOCK or RE-CAPTURE tag remains.

**How it was judged:**
- Every take was read end to end: contact sheets at one frame per second (`npm run edl-helper`), cropped half-second sheets around each cut, and luminance-change probes to find the exact frame of each paste, send, "Payment sent" and answer.
- The cut was reviewed on half-size previews at one frame every 2 s, and every 0.5 s through the three agent scenes.
- Key frames were then rendered at full size (`out/stills/`).
- The mix was measured with `loudnorm`, and type was checked at phone scale (a 1920-wide frame shown 390 px wide is 0.2×).

**Length:** the main cut runs about 1:51 against the founder's narration. The 30 s cut is exactly 900 frames.

## How the takes were cut

Nothing was reordered, and nothing was sped up: every result follows its request. Waits were cut.

- **owner1.mp4 (6:01 → 21 s used):**
  - The prompt pasted (6.65 s) and sent (14.8 s).
  - The plan's offers.
  - The three real domain quotes, with ridgeroast.shop 11.06 underlined.
  - The private preview.
  - The PayBox panel turning from "Sending payment…" to "Payment sent" at 228.07 s, spotlit, ringed and chimed.
  - "Ridge Roast is live on Pro", with ridgeroast.shop underlined.
  - Cut: 40 s of loading, two permission prompts, the reopen request, and the failed first approval window.
  - The owner token appears in this take; it is never in frame, and an opaque box covers it anyway.
- **buyer.mp4 (2:30 → 14 s used):**
  - The prompt and the send.
  - "I'll look up Awning through PayBox".
  - The match ("Ridge Roast's Tasting Session is the match at 5.00 USDC"), underlined.
  - The 5.00 USDC panel turning to "Payment sent" at 102.33 s.
  - "You're booked" with the booking code.
  - Cut: a stray first paste with a "1." list marker, 20 s of tool loading, the buy permission prompt, and a 40 s wait.
- **owner2.mp4 (2:30 → 8 s used):**
  - The offer prompt and its send.
  - "The Monthly Subscription Box is now live on Ridge Roast at $30".
  - The sales answer: "first sale: one Tasting Session for $5 … the transaction is 0x893b3f…".
  - Cut: the page's scroll right after sending (it briefly passes the old owner token) and 14 to 18 s of tool calls.

## The three strongest moments

1. **"One approval" is a real approval (0:40–0:48).** The founder's own PayBox panel shows $11.06. Everything else dims, a tomato ring lands with the chime the instant it turns to "Payment sent", and the 11.06 ticket beside it gets its APPROVED stamp. Then Claude's answer reads "Ridge Roast is live on Pro", and on "On its own domain" ridgeroast.shop is underlined while a price tag with the domain swings in. "A real one." cuts to the storefront loading at ridgeroast.shop, stamped REGISTERED, PAID, LIVE. All of it is real footage, and the cut follows the narration word for word.
2. **The proof chain for the first sale (0:56–1:18).** A fresh chat that never heard of the shop finds it and pays 5.00 USDC; the panel turns to "Payment sent" and the receipt prints to the owner's real wallet. /live shows the SOLD line above the OPENED line. Later, the owner's own chat reports the same sale and transaction. Then the film follows the /live link with a cut to the real BaseScan page: "Transfer 5 USDC to 0x1CD2B147…3ae3dbB37", Success. One payment, seen from four independent places.
3. **The opening (0:00–0:11).** The canopy unrolls and the Awning lockup unrolls on the hoarding for "This is Awning." Then the founder's actual prompt is lettered in sun gold. On "a real business" the hoarding lifts to the live ridgeroast.shop storefront, and on "other AI agents" a receipt prints +5.00.

## The three weakest moments, and what changed

1. **Dead frames from cutting real footage.**
   - The first cut of the owner's offer beat started 0.2 s early, while Claude's page was still scrolling past the old owner token. It now starts once the new message has settled, at 8.6 s.
   - The directory results arrived mid-scroll, so the shop's card was never framed. The clip now starts at the end of its glide and pushes in on the card.
   - The draft preview's push-in cut off the "R" of Ridge Roast; it now keeps the name whole.
2. **Causality in the overlays.**
   - The storefront is now live with three offers, including the $30 box added later in the story. So in the opening and in "A real one." the camera frames the two offers it opened with, and the plan's receipt prints the plan's own two offers. The $30 box first appears when the owner adds it.
   - The APPROVED stamp landed before its ticket had appeared. The ticket now arrives first.
   - The OPEN sign dropped through the fading ticket; it now waits for the ticket to clear.
3. **Empty or muddy frames.**
   - "This is Awning." played over an empty green hoarding for 2.4 s; the lockup now unrolls there.
   - "And there's a new kind of customer" began on an empty canvas with the tops of hidden words peeking through the mask. The line now rises with the voice, and words wait fully hidden.
   - The /live → BaseScan crossfade mixed two pages. It is now a cut on the link the cursor reaches, and BaseScan is shown as a short, wide strip pushed in on the transfer line. BaseScan's gambling ads are hidden; nothing of the transaction is touched.
   - The buyer's card in the sale diagram vanished into the dark board; it is now a paper card like every other actor.
   - The /live framing cut half a headline at the left edge; it now frames only the receipt paper.

**Also fixed in this pass:**
- Rendering stalled with "No frame found at position" (OffthreadVideo's frame cache under memory pressure with 3K captures and 1080p takes). All footage now plays through `@remotion/media`'s `<Video>`, which decodes in the tab.
- Captures, stock and takes are encoded without B-frames and with a keyframe every half to one second.
- The buyer is a fresh Claude.ai chat everywhere: frames, labels, captions and the 30 s cut. Nothing says "different agent", "different person", ChatGPT or Claude Code.

## Still worth a look by a human

- **The music** ("Music and Life", Mixkit) was picked by analysis, not by ear: tempo, build and a clean ending. Dropping the founder's own `public/audio/music.mp3` replaces it on the next render.
- **The domain takes a few minutes to resolve.** If ridgeroast.shop stops answering, `npm run capture` falls back to ridge-roast.awning.sh for the storefront, and the address bar shows that instead.
- **BaseScan's page shows "31 mins ago"** next to the timestamp because it was captured half an hour after the sale; the absolute time (Oct-17-2026 06:33:05 PM +UTC) is also on the page.
