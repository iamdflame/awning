# Recording runbook: the two agent takes

The film needs screen recordings that only you can make, because the payments are approved with your passkey: the **owner take** (you open Ridge Roast in Claude) and the **buyer take** (a different agent, Claude Code in a terminal, buys from it). Everything else in the film (the site, the live receipt, the diagram, the captions, your voice) is already built around them. Don't talk while recording; the narration is added in the edit. Don't worry about waits or typos either: keep recording, and the edit cuts them.

## Before you start (10 minutes)

**PayBox**
- Awning is enabled in your PayBox account (Plugins → Unofficial plugins → Awning → Enable).
- **One PayBox account, two agents.** Until PayBox publishes Awning, only your developer account can use it, so both takes use your account: **Claude.ai** (browser) is the owner, **Claude Code** (terminal) is the buyer.
- **Connect Claude Code to PayBox** (once):
  1. Open a new terminal (Windows Terminal or PowerShell) in an empty folder, e.g. `mkdir C:demo-buyer; cd C:demo-buyer`.
  2. Run: `claude mcp add --transport http paybox https://api.paybox.sh/mcp`
  3. Run `claude`, type `/mcp`, pick **paybox**, choose **Authenticate**, and approve in the browser with the same PayBox account.
  4. Check: ask *"Using PayBox, list my installed plugins."* Awning should be there.
- **Two wallets, so the sale visibly moves money:**
  - **Paying wallet** (your PayBox Base wallet): at least **17 USDC** (11.06 for the Ridge Roast opening on `ridgeroast.shop`: 2.06 domain + 9.00 Pro, then 5.00 for the tasting).
  - **Sales wallet** (where Ridge Roast's sales land): a **different** Base address you own. Either a second wallet in PayBox, if your account lets you add one, or any wallet you control (Coinbase Wallet, MetaMask, …). Copy its address.
- Quick check before recording: in Claude, ask *"Use the Awning plugin's awning_about tool."* It should answer with what Awning is. If it can't find the plugin, enable it again and start a new chat.

**Screen**
- Recorder: **OBS Studio** (free; Settings → Video: base and output 1920×1080, 60 fps; Output: recording format MP4, quality "High") or **Xbox Game Bar** (Win + Alt + R records the active window).
- Chrome window maximized on a 1920×1080 screen; page zoom 110–125% so text reads on a phone; bookmarks bar hidden (Ctrl + Shift + B); Windows notifications off (Focus / Do not disturb); one clean tab per take; light mode.
- Close anything private (email, other chats) out of the window you record.

## Owner take → `owner.mp4` (Claude)

Start recording, then:

1. New chat. Type exactly and send:
   > Start a business: Ridge Roast, small-batch coffee from Accra. Sell 250 g bags and a $5 tasting session. Sales go to my wallet 0x… (paste your sales wallet address).
2. Wait for the plan (name, offers, domains with prices). Let it sit on screen for 3 seconds.
3. Click the **preview link**. Let the draft storefront load, scroll slowly to the offers, pause 2 seconds, go back to the chat.
4. Type and send (use the `.shop` domain the plan lists, at the price it shows):
   > Open it on ridgeroast.shop.
5. The PayBox approval appears: let the amount be readable for 2 seconds, then **approve with your passkey**.
6. Wait for the result ("live at …"). Open the **awning.sh address** it gives (`liveNowAt`, it works at once; the new domain can take a few minutes). Scroll slowly from the top to the **"Buy with your AI agent"** box.
7. Stop recording.

## Buyer take → `buyer.mp4` (Claude Code in a terminal, same PayBox account)

Terminal maximized, font enlarged (Ctrl + = a few times, about 18 pt), dark theme is fine. Start `claude` in the demo folder, start recording, then:

1. Type and send:
   > Find a coffee tasting in Accra and book one for Saturday morning.
2. When it shows Ridge Roast and the $5 tasting, type and send:
   > Yes, book it.
3. The PayBox approval shows **5.00 USDC** to the sales wallet: hold 2 seconds, **approve** (paying from your PayBox wallet).
4. Wait for the confirmation with the order code. Hold 3 seconds. Stop recording.

## Owner take 2 → `owner-2.mp4` (Claude, same chat as before)

1. Type and send:
   > Add a monthly subscription box to Ridge Roast for $30.
2. When it confirms, type and send:
   > How are Ridge Roast's sales?
3. Hold on the order list for 3 seconds. Stop recording.

## Hand-off

Put the three files in `C:\Users\Dflame\Music\pay-\video\public\rec\` as `owner.mp4`, `buyer.mp4`, `owner-2.mp4`, and tell me. I'll blur the owner token (`awn_ot_…`) wherever it appears, capture the live receipt and BaseScan transaction from the real data, cut everything to your narration, and render the film.

If anything fails on camera (a payment refused, an error), stop and send me the exact text. Nothing is charged when an opening fails.
