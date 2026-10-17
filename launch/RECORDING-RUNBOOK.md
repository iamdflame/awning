# Recording runbook: the two agent takes

The film needs screen recordings that only you can make, because the payments are approved with your passkey: the **owner take** (you open Ridge Roast in Claude) and the **buyer take** (a different agent, Claude Code in a terminal, buys from it). Everything else in the film (the site, the live receipt, the diagram, the captions, your voice) is already built around them. Don't talk while recording; the narration is added in the edit. Don't worry about waits or typos either: keep recording, and the edit cuts them.

## Before you start (10 minutes)

**PayBox**
- Awning is enabled in your PayBox account (Plugins → Unofficial plugins → Awning → Enable).
- **One PayBox account, two agents.** Until PayBox publishes Awning, only your developer account can use it, so both takes use your account: **Claude.ai** (browser) is the owner, **Claude Code** (terminal) is the buyer.
- **Set up Claude Code with the PayBox CLI** (once, not recorded). In a terminal agent PayBox uses its CLI, not MCP (PayBox docs: agents on a computer with no connector screen use the CLI; it signs on your machine):
  1. In PowerShell: `npm install -g @anthropic-ai/claude-code @paybox-sh/sdk`, then close and reopen the terminal.
  2. `mkdir C:demo-buyer; cd C:demo-buyer`, run `claude` and sign in to your Claude account if asked.
  3. Ask Claude Code: *"Set up the PayBox CLI on this machine: run paybox login --no-open and paybox connect --no-open and give me the links."* Open each link: approve the login with your PayBox account (same email and passkey as before), then match the emoji row it shows (same kind of check you did in Claude.ai).
  4. Check: *"Run paybox --json whoami and paybox --json plugins list awning."* It should say canSign: true and list Awning.
- Quick check before recording, in a **new chat**: *"Using PayBox, run the Awning plugin's awning_about tool."* It should describe Awning. If it can't find the plugin, enable it again (PayBox → Plugins → Unofficial plugins) and check the PayBox connector is on for the chat.
- **One-time agent verification, before recording (no money, no clock).** PayBox asks a new agent connection to match emojis the first time it signs. Do it with a plain message signature, not a payment: in Claude, ask *"Use PayBox to sign the message 'Verify my agent' with my Base wallet."*, then in the signing window match the emojis and approve with your passkey. Do the same once in Claude Code before the buyer take.
- **Ask for Pro directly**, never the free version first (an upgrade adds a step and a second plan).
- **Always name Awning in the prompt.** Without it, Claude may build a web page itself instead of calling the plugin (seen in a take).

**Screen**
- Recorder: **OBS Studio** (free; Settings → Video: base and output 1920×1080, 60 fps; Output: recording format MP4, quality "High") or **Xbox Game Bar** (Win + Alt + R records the active window).
- Chrome window maximized on a 1920×1080 screen; page zoom 110–125% so text reads on a phone; bookmarks bar hidden (Ctrl + Shift + B); Windows notifications off (Focus / Do not disturb); one clean tab per take; light mode.
- Close anything private (email, other chats) out of the window you record.

## Owner take → `owner.mp4` (Claude)

Start recording, then:

1. New chat. Type exactly and send:
   > Open a business on Awning through PayBox: Ridge Roast, small-batch coffee from Accra. Sell 250 g bags at $14 and a $5 tasting session. Sales go to my wallet 0x… (paste your sales wallet address).

   If Claude still asks a question (a price, a detail), answer briefly and keep recording; the edit cuts it.
2. Wait for the plan (name, offers, domains with prices). Let it sit on screen for 3 seconds.
3. Click the **preview link**. Let the draft storefront load, scroll slowly to the offers, pause 2 seconds, go back to the chat.
4. Type and send (use the `.shop` domain the plan lists, at the price it shows):
   > Open it on Awning with Pro at ridgeroast.shop. Don't open the free version first.
5. The **PayBox signing window** appears in the chat (inline or beside it): let the amount be readable for 2 seconds, then confirm. **Sign within 5 minutes**: the payment proposal expires after that and the window fails (seen in a take). If it expires, ask Claude to open it again for a fresh request.
6. Wait for the result ("live at …"). Open the **awning.sh address** it gives (`liveNowAt`, it works at once; the new domain can take a few minutes). Scroll slowly from the top to the **"Buy with your AI agent"** box.
7. Stop recording.

## Buyer take → `buyer.mp4` (Claude Code in a terminal, same PayBox account)

Terminal maximized, font enlarged (Ctrl + = a few times, about 18 pt), dark theme is fine. Start `claude` in the demo folder, start recording, then:

1. Type and send:
   > Using the PayBox CLI, find a coffee tasting in Accra on Awning and book one for Saturday morning.
2. When it shows Ridge Roast and the $5 tasting, type and send:
   > Yes, book it.
3. The PayBox approval shows **5.00 USDC** to the sales wallet: hold 2 seconds, **approve** (paying from your PayBox wallet).
4. Wait for the confirmation with the order code. Hold 3 seconds. Stop recording.

## Owner take 2 → `owner-2.mp4` (Claude, same chat as before)

1. Type and send:
   > Add a monthly subscription box to Ridge Roast on Awning for $30.
2. When it confirms, type and send:
   > How are Ridge Roast's sales on Awning?
3. Hold on the order list for 3 seconds. Stop recording.

## Hand-off

Put the three files in `C:\Users\Dflame\Music\pay-\video\public\rec\` as `owner.mp4`, `buyer.mp4`, `owner-2.mp4`, and tell me. I'll blur the owner token (`awn_ot_…`) wherever it appears, capture the live receipt and BaseScan transaction from the real data, cut everything to your narration, and render the film.

If anything fails on camera (a payment refused, an error), stop and send me the exact text. Nothing is charged when an opening fails.
