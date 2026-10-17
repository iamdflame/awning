# Awning demo video, script v2

Awning is a PayBox plugin that turns one sentence into a real business that people and AI agents can buy from the minute it opens.

This script films only what is live today: drafting, a free or custom-domain opening, an agent purchase paid to the owner's wallet, owner tools, and the payment safeguards. Length 2:00 at most. The wow lands by 0:20 (the shop is live on its own domain) and the proof by 0:45 (a different agent pays it). The phone line is an optional insert for later, once telephony is connected.

## Setup before recording

- **Owner:** Claude.ai with PayBox connected and Awning enabled under Plugins. A Base wallet in PayBox with enough USDC for the domain you will pick (a `.shop` opening was 11.06 USDC at Porkbun's 2026-10-17 list price, `docs/SPEC.md`).
- **Buyer:** ChatGPT with PayBox connected under a *different* PayBox account, Awning enabled, and at least 5 USDC on Base.
- **Tabs ready:** `awning.sh/live`, `awning.sh/directory`, and BaseScan on the owner's wallet address.
- **Pick a fresh name.** Check `awning.sh/directory` first. If Ridge Roast is already open, use another business and change every prompt and caption to match.
- **Check `awning.sh/status`.** If Pro is unavailable, open on the free subdomain instead (shot 3 becomes `awning_open_free`) and use launch post B in `X-THREAD.md`.
- **Recording:** 1080p or higher, notifications off, bookmarks bar hidden, no login screens on camera.
- **Honesty rules:** cut waits, never speed up a result or stage one. Blur the owner token (`awn_ot_…`) wherever the agent shows it. If a freshly registered domain has not resolved yet, cut to it when it does.

## The prompts, exactly as typed

| # | Who, where | Prompt |
|---|---|---|
| P1 | Owner, Claude | `Start a business: Ridge Roast, small-batch coffee from Accra. Sell 250 g bags and a $5 tasting session. Sales go to my PayBox wallet.` |
| P2 | Owner, Claude | `Open it on ridgeroast.shop.` (use a domain the plan lists as available, at the price it shows) |
| P3 | Buyer, ChatGPT | `Find a coffee tasting in Accra and book one for Saturday morning.` |
| P4 | Buyer, ChatGPT | `Yes, book it.` |
| P5 | Owner, Claude | `Add a monthly subscription box to Ridge Roast for $30.` |
| P6 | Owner, Claude | `How are Ridge Roast's sales?` |

## Shot list (2:00)

| Time | Screen and action | Caption on screen | Voice-over (optional) |
|---|---|---|---|
| 0:00–0:06 | Claude.ai, empty chat, PayBox connected. Type **P1** and send. Lower third: "Awning, a PayBox plugin". | One sentence. | "Awning is a PayBox plugin that turns one sentence into a real business that people and AI agents can buy from." |
| 0:06–0:11 | The `awning_plan` call runs (cut the wait). The answer shows the name, three offers with prices, the preview link and three domains with totals. | Named, priced, drafted. Nothing paid yet. | "It drafts the shop, prices real domains and puts up a private preview." |
| 0:11–0:14 | Click the preview link: the draft storefront with its "Preview, not open yet" ribbon, offers and generated photo. | A private preview. | |
| 0:14–0:18 | Back in Claude, type **P2**. `awning_open` returns a proposal; the PayBox approval window shows the amount in USDC on Base. Approve. | One approval. | "One approval in PayBox." |
| 0:18–0:26 | The paid response: "live at https://ridgeroast.shop". Open it with the address bar in view. Scroll from the menu to the "Buy with your AI agent" slip. | A real domain. Registered, paid, live. | "That's a real domain, registered and live." |
| 0:26–0:32 | Switch to ChatGPT, a different PayBox account. Type **P3**. `awning_find` returns Ridge Roast and the tasting price. | A different person. A different agent. | "Now someone else asks their own agent." |
| 0:32–0:38 | Type **P4**. `awning_buy` returns a proposal; the PayBox window shows 5.00 USDC and the owner's wallet. Approve. The answer shows the booking code. | 5.00 USDC, straight to the owner. | |
| 0:38–0:45 | `awning.sh/live`: the new SOLD line, +5.00. Click its transaction: BaseScan shows the USDC transfer into the owner's wallet. | Its first customer was an AI agent. | "Its first customer was an AI agent, and the money went straight to the owner." |
| 0:45–0:55 | Back in Claude as the owner. Type **P5**. `awning_add_offer` answers; refresh the storefront and the new row is there. | The owner runs it from the chat. | "The owner runs the shop from the same chat." |
| 0:55–1:05 | Type **P6**. `awning_orders` lists the order: 5.00 USDC, paid, its transaction, the buyer's note marked as untrusted. | Orders with receipts. | |
| 1:05–1:15 | `awning.sh/directory`: search "coffee"; the new shop sits on the street with its prices. Then `awning.sh/for-agents` for two seconds. | Listed for every agent. | "Every shop is listed where any agent can find it." |
| 1:15–1:30 | The architecture diagram from the README, animated: agent → PayBox → plugin returns a proposal → PayBox pays the 402 → Awning verifies, provisions, then settles. Overlay the `steps` list from the paid open response (preflight, hosting, register_domain, dns, go_live). | The plugin never pays. It proposes; you approve. | "The plugin never pays. It proposes, and PayBox asks you." |
| 1:30–1:42 | Terminal in `web/`: `pnpm exec vitest run tests/idempotency.test.ts tests/failures.test.ts --reporter=verbose`. Hold on the passing lines "failure before settlement moves no money" and "the same payment twice → one order, one settlement, identical response". | Settled only after the work succeeds. Same payment twice, one charge. | "Payments settle only after the domain is live. If something fails after that, the treasury refunds it." |
| 1:42–1:52 | `awning.sh/live`: today's opening and today's sale, one above the other. | Opened at 0:18. Paid by an agent at 0:38. | "One sentence, one approval, and an agent paid it." |
| 1:52–2:00 | End card on canvas with the green canopy: Awning logo, "One sentence opens a real business that people and AI agents can buy from.", awning.sh, "Open yours". | awning.sh | "Open yours at awning.sh." |

Replace the times in the 1:42 caption with the real clock times from your take, or drop them.

## Optional insert: the phone line (only once telephony is connected)

Do not film this until a real call to a real Awning number works.

| Time | Screen and action | Caption |
|---|---|---|
| after 0:26, 10 s | The live storefront shows its phone number. Call it on speaker. The AI receptionist answers with the business name. Ask: "Do you do tastings on Saturday?" | The line answers. It's an AI receptionist. |

To keep the total at 2:00, shorten 0:45–1:15 by 10 seconds (drop the `/for-agents` beat and trim the directory).

## 30-second cut

| Time | Screen and action | Caption |
|---|---|---|
| 0:00–0:04 | Type **P1** in Claude and send. | One sentence. |
| 0:04–0:08 | The plan: name, offers, domains with prices; one second on the preview. | Drafted. Nothing paid yet. |
| 0:08–0:14 | **P2**, the PayBox approval, then the live storefront on its own domain. | One approval. A real domain, live. |
| 0:14–0:24 | ChatGPT, another account: **P3**, **P4**, the 5.00 USDC approval, then the +5.00 line on `awning.sh/live` and the BaseScan transfer. | Its first customer was an AI agent. Paid straight to the owner. |
| 0:24–0:30 | End card: logo, one-liner, awning.sh. | Open yours. awning.sh |

## Captions as one list (for the subtitle file)

1. One sentence.
2. Named, priced, drafted. Nothing paid yet.
3. A private preview.
4. One approval.
5. A real domain. Registered, paid, live.
6. A different person. A different agent.
7. 5.00 USDC, straight to the owner.
8. Its first customer was an AI agent.
9. The owner runs it from the chat.
10. Orders with receipts.
11. Listed for every agent.
12. The plugin never pays. It proposes; you approve.
13. Settled only after the work succeeds. Same payment twice, one charge.
14. Opened at 0:18. Paid by an agent at 0:38.
15. awning.sh
