// What the film knows at render time: which narration takes exist (the founder's or the scratch
// voice), their real durations and word times, which founder recordings, captures, stock clips and
// music are present. Resolved once per render in calculateMetadata.
import { staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import vo from "./vo.json";
import edlJson from "../edl.json";

const edl = edlJson as unknown as Record<"owner" | "buyer" | "owner2", { file: string }>;
import { approxWords, type Take, type Word } from "./timeline";

export const VO_IDS = vo.lines.map((l) => l.id);
export const VO_TEXT: Record<string, string> = Object.fromEntries(vo.lines.map((l) => [l.id, l.text]));
export const CAPTION_SUBS = vo.caption;

export async function exists(path: string): Promise<boolean> {
  try {
    const r = await fetch(staticFile(path), { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

async function json<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(staticFile(path), { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

type TimingFile = Record<string, { src: string; kind: "final" | "scratch"; durationMs: number; words: Word[]; method: string; norm?: string }>;

/** For each line: the founder's take (audio/vo-0N.mp3 or .wav) if present, else the scratch voice. */
export async function resolveTakes(): Promise<Record<string, Take>> {
  const timing = (await json<TimingFile>("audio/timing.json")) ?? {};
  const out: Record<string, Take> = {};
  await Promise.all(
    VO_IDS.map(async (id) => {
      const candidates: [string, "final" | "scratch"][] = [
        [`audio/${id}.mp3`, "final"],
        [`audio/${id}.wav`, "final"],
        [`audio/scratch/${id}.wav`, "scratch"],
      ];
      let src: string | null = null;
      let kind: Take["kind"] = "missing";
      for (const [p, k] of candidates) {
        if (await exists(p)) {
          src = p;
          kind = k;
          break;
        }
      }
      const t = timing[id];
      const fresh = !!t && !!src && t.src === src;
      // play the loudness-normalised copy made by `npm run captions` when it matches this take
      let play = src;
      if (fresh && t!.norm && (await exists(t!.norm))) play = t!.norm;
      let durationSec = 0;
      if (play) {
        try {
          durationSec = await getAudioDurationInSeconds(staticFile(play));
        } catch {
          durationSec = fresh ? t!.durationMs / 1000 : 0;
        }
      }
      if (!durationSec) durationSec = Math.max(2, VO_TEXT[id]!.split(/\s+/).length / 2.6); // no audio at all: reading pace
      out[id] = {
        id,
        src: play,
        kind,
        durationSec,
        words: fresh ? t!.words : approxWords(VO_TEXT[id]!, durationSec),
        approx: !fresh,
      };
    }),
  );
  return out;
}

export type CaptureShot = {
  id: string;
  file: string;
  width: number;
  height: number;
  fps: number;
  frames?: number;
  durationSec?: number;
  url: string;
  displayUrl: string;
  source: "live" | "local-mock";
  capturedAt: string;
  realtime?: { file: string; width: number; height: number; fps: number };
  data?: Record<string, unknown>;
};
export type CaptureManifest = {
  shots: Record<string, CaptureShot>;
  live?: { shops: { slug: string; name: string; url: string; offers: { title: string; priceUsd: number }[] }[]; events: { type: string; at: string; slug: string; name: string; amountUsd?: number; tx?: string }[] };
  local?: { shops: Record<string, unknown>[]; events: { type: string; at: string; slug: string; name: string; amountUsd?: number; tx?: string }[] };
};

export type Assets = {
  capture: CaptureManifest;
  rec: { owner: string | null; buyer: string | null; owner2: string | null };
  stock: Record<string, string | null>;
  music: string | null;
  sfx: Record<string, string | null>;
};

export const STOCK_IDS = ["roast", "market", "bike", "pottery", "shutter"] as const;
export const SFX_IDS = ["print", "chime", "pop", "cloth", "type", "bell"] as const;

export async function resolveAssets(): Promise<Assets> {
  const capture = (await json<CaptureManifest>("capture/manifest.json")) ?? { shots: {} };
  // keep only clips whose files are really there
  for (const [k, s] of Object.entries(capture.shots)) {
    const stepped = s.file && (await exists(s.file));
    if (!stepped) {
      if (s.realtime && (await exists(s.realtime.file))) capture.shots[k] = { ...s, file: s.realtime.file, width: s.realtime.width, height: s.realtime.height, fps: s.realtime.fps };
      else delete capture.shots[k];
    }
  }
  const pick = async (...paths: string[]) => {
    for (const p of paths) if (await exists(p)) return p;
    return null;
  };
  const stock: Record<string, string | null> = {};
  for (const id of STOCK_IDS) stock[id] = await pick(`stock/${id}.mp4`);
  const sfx: Record<string, string | null> = {};
  for (const id of SFX_IDS) sfx[id] = await pick(`audio/sfx/${id}.wav`, `audio/sfx/${id}.mp3`);
  return {
    capture,
    // edl.json names each founder recording (owner1.mp4, buyer.mp4, owner-2.mp4); the film plays the
    // edit-friendly copy from scripts/prep-rec.mjs when it exists (same times, a keyframe every second)
    rec: {
      owner: await pickRec(edl.owner.file),
      buyer: await pickRec(edl.buyer.file),
      owner2: await pickRec(edl.owner2.file),
    },
    stock,
    music: await resolveMusic(),
    sfx,
  };
}

async function pickRec(file: string): Promise<string | null> {
  if (!(await exists(file))) return null;
  const name = file.split("/").pop()!.replace(/.[a-z0-9]+$/i, "");
  const prepared = `rec/prepared/${name}.mp4`;
  return (await exists(prepared)) ? prepared : file;
}

/** The founder's track (audio/music.mp3) wins over the licensed stock track; the normalised copy
 *  made by `npm run captions` is used when it was made from that same file. */
async function resolveMusic(): Promise<string | null> {
  const src = (await exists("audio/music.mp3")) ? "audio/music.mp3" : (await exists("audio/stock-music.mp3")) ? "audio/stock-music.mp3" : null;
  if (!src) return null;
  const timing = await json<{ music?: { src: string; norm: string } }>("audio/timing.json");
  if (timing?.music?.src === src && (await exists(timing.music.norm))) return timing.music.norm;
  return src;
}
