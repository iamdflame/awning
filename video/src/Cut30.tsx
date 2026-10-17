import React from "react";
import { Sequence, interpolate, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import { Receipt, Ticket } from "./brand/Paper";
import { C, EASE } from "./brand/tokens";
import { Captions } from "./components/Captions";
import { Stamp } from "./components/Kinetic";
import { TwoChats } from "./components/AgentFrames";
import { ProductClip } from "./components/ProductClip";
import { RecordingBeat, beatIsReal, beatOf, frameOfSource } from "./components/Recording";
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
  const sale = saleFacts(assets);
  const FW = 1180;
  const FH = Math.round((FW * 9) / 16);
  // the fresh chat's payment (its "Payment sent" moment when the take exists), its booking, then /live
  const b4 = beatOf("buyer", "p4-buy");
  const real = beatIsReal("buyer", "p4-buy", assets.rec.buyer);
  const recApprove = real && b4.approve?.at != null ? frameOfSource(b4, b4.approve.at, 30) : null;
  const approveAt = recApprove ?? Math.round(n * 0.24);
  const a = approveAt + 20; // the receipt prints once the payment is sent
  const b = Math.round(n * 0.7); // then the public receipt on awning.sh/live
  const ticketOut = interpolate(f, [a - 6, a + 4], [0, 1], { ...clamp, easing: EASE.inOut });
  const liveIn = interpolate(f, [b, b + 12], [0, 1], { ...clamp, easing: EASE.out });
  const caps: Caption[] = [
    { from: 18, to: a - 2, text: "A fresh chat finds it and pays.", words: [] },
    { from: a, to: b - 2, text: `${sale.amount} USDC, straight to the owner.`, words: [] },
    { from: b, to: n - 4, text: "Its first customer was an AI agent.", words: [] },
  ].map((c) => ({ ...c, words: c.text.split(" ").map((w) => ({ w, from: c.from, to: c.to })) }));
  return (
    <Ground>
      {recApprove == null ? <Sfx src={assets.sfx.chime} at={approveAt} volume={0.3} /> : null}
      <Sfx src={assets.sfx.print} at={a + 4} volume={0.26} />
      <Sfx src={assets.sfx.print} at={a + 12} volume={0.26} />
      <Sfx src={assets.sfx.pop} at={a + 24} volume={0.3} />
      <div style={{ position: "absolute", left: 70, top: 34, opacity: 1 - liveIn }}>
        <TwoChats p={interpolate(f, [2, 14], [0, 1], { ...clamp, easing: EASE.out })} />
      </div>
      <div style={{ position: "absolute", left: 70, top: 108 }}>
        <RecordingBeat who="buyer" beat="p4-buy" file={assets.rec.buyer} width={FW} height={FH} slot={b} chime={assets.sfx.chime} />
        {f >= b ? (
          <div style={{ position: "absolute", left: 0, top: 0, opacity: liveIn }}>
            <Sequence from={b} layout="none">
              <ProductClip shot={assets.capture.shots["live"]} width={FW} height={FH} dark startSec={assets.capture.shots["live"]?.source === "live" ? 1.2 : 2.4} cam={[{ at: 0, x: 0.62, y: 0.4, z: 1.3 }, { at: 40, x: 0.66, y: 0.33, z: 2.0 }]} label="awning.sh/live" />
            </Sequence>
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", left: 1330, top: 150, opacity: interpolate(f, [4, 14], [0, 1], clamp) * (1 - ticketOut), transform: `translate(${ticketOut * 60}px, ${-ticketOut * 40}px)` }}>
        <Ticket width={500} scale={0.94} rotate={2} kicker={["PAYBOX", "USDC · BASE"]} title={<>{BUSINESS.tasting.title}, {BUSINESS.name}</>} amount={sale.amount} note={<>USDC to<br />the owner's wallet</>} />
        {f >= approveAt ? (
          <div style={{ position: "absolute", left: 180, top: 268 }}>
            <Stamp at={approveAt} size={36} rotate={-8} color={C.g600}>
              Approved
            </Stamp>
          </div>
        ) : null}
      </div>
      {f >= a - 4 ? (
        <div style={{ position: "absolute", left: 1296, top: 136, zIndex: 5, transform: "scale(0.86)", transformOrigin: "top left" }}>
          <Receipt
            width={640}
            size={24}
            rotate={-1.4}
            head={[BUSINESS.name.toUpperCase(), sale.mock ? "BUYER TAKE PENDING" : "SOLD"]}
            lines={[
              { l: BUSINESS.tasting.title, r: `1 × ${sale.amount}`, at: a + 4 },
              { l: "paid by", r: "an AI agent", at: a + 10, tone: "agent" },
              { l: "to", r: sale.walletShort, at: a + 16 },
            ]}
            total={{ amount: `+${sale.amount}`, label: <>USDC FROM AN AGENT<br />TO THE OWNER'S WALLET</>, at: a + 24 }}
          />
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
