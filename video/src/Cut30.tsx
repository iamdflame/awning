import React from "react";
import { Sequence, interpolate, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import { Receipt, Ticket } from "./brand/Paper";
import { C, EASE } from "./brand/tokens";
import { Captions } from "./components/Captions";
import { Stamp } from "./components/Kinetic";
import { TwoChats } from "./components/AgentFrames";
import { ProductClip } from "./components/ProductClip";
import { RecordingBeat } from "./components/Recording";
import { CAPTION_SUBS, resolveAssets, resolveTakes } from "./data";
import { Film, type FilmProps } from "./Main";
import { Ground, Sfx, type SceneProps } from "./scenes/common";
import { saleFacts } from "./scenes/facts";
import { S1Open } from "./scenes/S1Open";
import { S4Approve } from "./scenes/S4Approve";
import { S9End } from "./scenes/S9End";
import { BUSINESS } from "./story";
import { FPS, buildCaptions, layout, speechSpans, type Caption, type SceneSpec } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const TOTAL = 30 * FPS;

/** The 30 s cut's silent middle: another agent buys, the receipt prints, the live feed shows it. */
const C3Buy: React.FC<SceneProps> = ({ timing, assets }) => {
  const f = useCurrentFrame();
  const n = timing.frames;
  const a = Math.round(n * 0.34);
  const b = Math.round(n * 0.66);
  const sale = saleFacts(assets);
  const FW = 1180;
  const FH = Math.round((FW * 9) / 16);
  const out = interpolate(f, [a - 4, a + 12], [0, 1], { ...clamp, easing: EASE.inOut });
  const liveIn = interpolate(f, [b, b + 14], [0, 1], { ...clamp, easing: EASE.out });
  const caps: Caption[] = [
    { from: 4, to: a - 2, text: "A fresh chat finds it on its own.", words: [] },
    { from: a, to: b - 2, text: `${sale.amount} USDC, straight to the owner.`, words: [] },
    { from: b, to: n - 4, text: "Its first customer was an AI agent.", words: [] },
  ].map((c) => ({ ...c, words: c.text.split(" ").map((w) => ({ w, from: c.from, to: c.to })) }));
  return (
    <Ground>
      <Sfx src={assets.sfx.chime} at={Math.round(a * 0.7)} volume={0.3} />
      <Sfx src={assets.sfx.print} at={a + 6} volume={0.26} />
      <Sfx src={assets.sfx.print} at={a + 14} volume={0.26} />
      <Sfx src={assets.sfx.pop} at={a + 26} volume={0.3} />
      <div style={{ position: "absolute", left: 70, top: 34, opacity: 1 - out }}>
        <TwoChats p={interpolate(f, [2, 14], [0, 1], { ...clamp, easing: EASE.out })} />
      </div>
      <div style={{ position: "absolute", left: 70, top: 108, transform: `translateX(${out * -1400}px)` }}>
        <RecordingBeat who="buyer" beat="p4-buy" file={assets.rec.buyer} width={FW} height={FH} slot={a} chime={assets.sfx.chime} />
      </div>
      <div style={{ position: "absolute", left: 1330, top: 170, opacity: (1 - out) * interpolate(f, [6, 16], [0, 1], clamp) }}>
        <Ticket width={470} scale={0.9} rotate={2} kicker={["PAYBOX", "USDC · BASE"]} title={<>{BUSINESS.tasting.title}, {BUSINESS.name}</>} amount={sale.amount} note={<>USDC to<br />the owner's wallet</>} />
        {f >= Math.round(a * 0.7) ? (
          <div style={{ position: "absolute", left: 170, top: 250 }}>
            <Stamp at={Math.round(a * 0.7)} size={34} rotate={-8} color={C.g600}>
              Approved
            </Stamp>
          </div>
        ) : null}
      </div>
      {f >= a - 4 ? (
        <div style={{ position: "absolute", left: interpolate(liveIn, [0, 1], [640, 1250]), top: interpolate(liveIn, [0, 1], [150, 170]), transform: `scale(${interpolate(liveIn, [0, 1], [1, 0.82])})`, transformOrigin: "top left", zIndex: 5 }}>
          <Receipt
            width={640}
            size={23}
            rotate={-1.2}
            head={[BUSINESS.name.toUpperCase(), sale.mock ? "BUYER TAKE PENDING" : "SOLD"]}
            lines={[
              { l: BUSINESS.tasting.title, r: `1 × ${sale.amount}`, at: a + 6 },
              { l: "paid by", r: "an AI agent", at: a + 12, tone: "agent" },
              { l: "to", r: sale.walletShort, at: a + 18 },
            ]}
            total={{ amount: `+${sale.amount}`, label: <>USDC FROM AN AGENT<br />TO THE OWNER'S WALLET</>, at: a + 26 }}
          />
        </div>
      ) : null}
      {f >= b ? (
        <div style={{ position: "absolute", left: 70, top: 108, opacity: liveIn }}>
          <Sequence from={b} layout="none">
            <ProductClip shot={assets.capture.shots["live"]} width={FW} height={FH} startSec={assets.capture.shots["live"]?.source === "live" ? 0 : 2.4} cam={[{ at: 0, x: 0.5, y: 0.5, z: 1 }, { at: 40, x: 0.66, y: 0.36, z: 1.5 }]} label="awning.sh/live" />
          </Sequence>
        </div>
      ) : null}
      <Captions captions={caps} />
    </Ground>
  );
};

export const CUT30_SCENES = (middleSec: number, endPost: number): SceneSpec[] => [
  { id: "c1-open", vo: "vo-01", pre: 0.5, post: 0.35, next: { kind: "slide-left", frames: 12 } },
  { id: "c2-live", vo: "vo-04", pre: 0.25, post: 0.6, next: { kind: "slide-left", frames: 12 } },
  { id: "c3-buy", vo: null, pre: 0, post: 0, fixedSec: middleSec, next: { kind: "fade", frames: 10 } },
  { id: "c4-end", vo: "vo-09", pre: 0.4, post: endPost },
];

const CUT30_MAP: Record<string, React.FC<SceneProps>> = { "c1-open": S1Open, "c2-live": S4Approve, "c3-buy": C3Buy, "c4-end": S9End };

export const calcCut30: CalculateMetadataFunction<FilmProps> = async ({ props }) => {
  const [takes, assets] = await Promise.all([resolveTakes(), resolveAssets()]);
  // the middle takes whatever the three spoken scenes leave of 30 s (at least 5 s; the end card gives way first)
  let endPost = 1.2;
  let tl = layout(CUT30_SCENES(6, endPost), takes, FPS);
  let middle = 6 + (TOTAL - tl.total) / FPS;
  if (middle < 5) {
    endPost = Math.max(0.5, endPost - (5 - middle));
    tl = layout(CUT30_SCENES(6, endPost), takes, FPS);
    middle = 6 + (TOTAL - tl.total) / FPS;
  }
  tl = layout(CUT30_SCENES(middle, endPost), takes, FPS);
  // rounding: the end card absorbs the last frame or two so the cut is exactly 30 s
  const last = tl.scenes[tl.scenes.length - 1]!;
  last.frames = TOTAL - last.from;
  const captions = buildCaptions(tl, takes, CAPTION_SUBS);
  const spans = speechSpans(tl, takes);
  return { durationInFrames: TOTAL, props: { ...props, takes, assets, timeline: { ...tl, total: TOTAL }, captions, spans } };
};

export const Cut30: React.FC<FilmProps> = (p) => <Film {...p} scenes={CUT30_MAP} />;
