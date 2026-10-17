# Awning demo video: voiceover

Generate one audio file per line below in ElevenLabs, name it exactly as shown (`vo-01.mp3` … `vo-09.mp3`), and drop all of them into `video/public/audio/`. The picture is cut to your audio, so pauses and pace are yours; the target lengths are guides, not limits.

## Settings

| Setting | Value |
|---|---|
| Voice | **Dflame** (your own voice in your library). Second choice: **Eric – Smooth, Trustworthy**. Third: **George – Warm, Captivating Storyteller** |
| Model | **Eleven v4** (`eleven_v4`, in your account). If a line drifts from your voice, regenerate that line with **Eleven Multilingual v2**, the steadiest for a cloned voice |
| Stability | **Natural** (about 50%). Use Creative for vo-04 and vo-08 if they sound flat; Robust if a take wobbles |
| Similarity | 80% |
| Style exaggeration | 15% |
| Speaker boost | On |
| Speed | 1.00 (0.95 for vo-07 and vo-09) |
| Output | MP3 44.1 kHz 192 kbps (or WAV 48 kHz if your plan offers it) |

Eleven v4 understands delivery cues in square brackets. Optional: start vo-04 with `[confident]`, vo-05's last sentence with `[warmly]`, and vo-08 with `[proud]`; the brackets are not spoken. Generate 2–3 takes of each line and keep the one that sounds like you talking to a friend, not reading. Leave about 0.3 s of silence at the start and end of each file; don't add music.

**Say it like this:** Awning = "AW-ning". PayBox = "pay box". USDC = "U-S-D-C". Accra = "ah-KRAH". awning.sh = "awning dot S-H". BaseScan = "base scan".

## The lines

| File | Scene and time | Read it like | Line |
|---|---|---|---|
| `vo-01` | 0:00–0:08 · a sentence typed to an agent, a shop appears | Calm and confident, like you're showing a friend | This is Awning. You tell your AI agent one sentence, and it opens a real business that people, and other AI agents, can buy from. |
| `vo-02` | 0:08–0:20 · small shops, owners at work | Warm, a little serious on the number | Starting a small business still means a website, a domain, a checkout. And there's a new kind of customer now: AI agents with wallets. In a September audit of two hundred retailers, only thirty-eight could take their money. |
| `vo-03` | 0:20–0:31 · Claude drafts Ridge Roast, the preview | Matter-of-fact, quick | Here's Ridge Roast, a coffee roaster in Accra. Awning names it, prices the offers, checks real domains, and puts up a private preview. Nothing is paid yet. |
| `vo-04` | 0:31–0:41 · PayBox approval, the shop goes live | Let "real" land | One approval in PayBox, and Ridge Roast is open. On its own domain. A real one. |
| `vo-05` | 0:41–0:56 · a second agent buys a tasting, the receipt prints | A small smile on the last sentence | Now, in a fresh chat, an agent goes shopping for a coffee tasting in Accra. It finds Ridge Roast on its own. Five dollars in USDC, one approval, paid straight to the owner's wallet. Ridge Roast's first customer was an AI. |
| `vo-06` | 0:56–1:16 · owner adds an offer, checks orders, the directory, the live feed | Easy, conversational | The owner runs the shop from the same chat: add a subscription box, check the orders. Every shop is listed where any agent can find it, and every sale lands on a public receipt you can check on chain. |
| `vo-07` | 1:16–1:40 · the diagram, the safeguards | Slower, steady, trustworthy | Under the hood, the plugin never moves money. It proposes, and PayBox asks you. Awning only takes the payment after the shop is live, so if anything fails, you're not charged. Sales go straight to the owner's wallet. Awning never holds them. |
| `vo-08` | 1:40–1:50 · the street of shops | Rising, proud | Every business on Awning is born agent-payable. |
| `vo-09` | 1:50–1:58 · end card | Slow, warm, final | One sentence. One approval. Open yours at awning dot S-H. |

Total: about 255 words, about 1:55 with the pauses.

## If you have ElevenLabs Music (optional)

Prompt: *"Warm, optimistic instrumental for a product launch film. 100 BPM, plucked electric guitar, soft marimba, light hand percussion and a round bass. Starts sparse, lifts gently at 0:40 and builds to a bright, full chorus at 1:40, then a clean ending at 2:00. No vocals."* Length 2:00, file name `music.mp3`. If you skip it, I'll use a licensed track from Pixabay Music and list it in the credits.

## When you're done

Put the files in `C:\Users\Dflame\Music\pay-\video\public\audio\` and tell me. I'll time every cut to your takes, generate captions from your audio, and render the final.
