// Generates the narration with ElevenLabs (Eleven v4, the founder's own cloned voice) into
// public/audio/vo-NN.mp3. Lines and settings follow launch/VOICEOVER.md.
// Usage: node scripts/generate-voice.mjs [--only 04,05] [--voice <voice_id>]
// Reads ELEVENLABS_API_KEY from the repo-root .env (never printed).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const env = Object.fromEntries(
  readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const key = env.ELEVENLABS_API_KEY;
if (!key) throw new Error("ELEVENLABS_API_KEY is missing from .env");

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const only = opt("--only")?.split(",").map((s) => s.padStart(2, "0"));
const VOICE = opt("--voice") ?? "eiLz8n3rMt6c6BESEP43"; // "Dflame", the founder's cloned voice
const MODEL = "eleven_v4";

// Text as spoken. Eleven v4 sometimes says "Awning" as "owning" or "earning" at the start or
// end of a line; "Awe-ning" and a pause after it fixed that (checked with speech-to-text).
const LINES = {
  "01": "This is Awe-ning. You tell your AI agent one sentence, and it opens a real business that people, and other AI agents, can buy from.",
  "02": "Starting a small business still means a website, a domain, a checkout. And there's a new kind of customer now: AI agents with wallets. In a September audit of two hundred retailers, only thirty-eight could take their money.",
  "03": "Here's Ridge Roast, a coffee roaster in Accra. Awning names it, prices the offers, checks real domains, and puts up a private preview. Nothing is paid yet.",
  "04": "One approval in PayBox, and Ridge Roast is open. On its own domain. A real one.",
  "05": "Now, in a fresh chat, an agent goes shopping for a coffee tasting in Accra. It finds Ridge Roast on its own. Five dollars in U-S-D-C, one approval, paid straight to the owner's wallet. Ridge Roast's first customer was an AI.",
  "06": "The owner runs the shop from the same chat: add a subscription box, check the orders. Every shop is listed where any agent can find it, and every sale lands on a public receipt you can check on chain.",
  "07": "Under the hood, the plugin never moves money. It proposes, and PayBox asks you. Awning only takes the payment after the shop is live, so if anything fails, you're not charged. Sales go straight to the owner's wallet. Awning never holds them.",
  "08": "Every business on Awning... is born agent-payable.",
  "09": "One sentence. One approval. Open yours at awe-ning dot S-H.",
};
const SLOWER = new Set(["07", "09"]);

const outDir = path.join(here, "../public/audio");
mkdirSync(outDir, { recursive: true });

for (const [n, text] of Object.entries(LINES)) {
  if (only && !only.includes(n)) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: SLOWER.has(n) ? 0.95 : 1.0 },
    }),
  });
  if (!res.ok) {
    console.error(`vo-${n}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path.join(outDir, `vo-${n}.mp3`), buf);
  console.log(`vo-${n}.mp3  ${(buf.length / 1024).toFixed(0)} KB  (${text.length} chars)`);
}
