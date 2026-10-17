import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Clip } from "../components/Clip";
import { HangingTag } from "../brand/Paper";
import { C, EASE, FONT, display } from "../brand/tokens";
import { Rise } from "../components/Kinetic";
import { AUDIT } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** A stock clip, full bleed, with a slow push. Missing files show a quiet ground, never an error. */
const Broll: React.FC<{ src: string | null; from?: number; push?: number; label: string; grade?: string }> = ({ src, from = 0, push = 0.06, label, grade }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = 1.02 + push * (f / Math.max(1, durationInFrames));
  return (
    <AbsoluteFill style={{ background: C.g900, overflow: "hidden" }}>
      {src ? (
        <Clip src={staticFile(src)} trimBefore={Math.round(from * 30)} objectFit="cover" style={{ width: "100%", height: "100%", transform: `scale(${s})`, filter: grade }} />
      ) : (
        <AbsoluteFill style={{ display: "grid", placeItems: "center", color: "rgba(247,246,237,.5)", fontFamily: FONT.text, fontSize: 30 }}>stock: {label} (run npm run assets)</AbsoluteFill>
      )}
      {/* a warm, even grade so five sources read as one film */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,25,15,.38), rgba(0,25,15,0) 38%, rgba(0,25,15,0) 62%, rgba(0,25,15,.45))" }} />
    </AbsoluteFill>
  );
};

// 200 small shopfronts in the street's own palettes
const PALETTES = [
  ["#6b1d14", "#f4b335", "#fbe8cf"],
  ["#ffd84a", "#2343d6", "#fffaf0"],
  ["#e7edf5", "#1f5ad1", "#ffffff"],
  ["#f6c8b8", "#7a1f2b", "#fff4ec"],
  ["#262a4a", "#f2c14e", "#262a4a"],
  ["#dfe8d5", "#2f4a2a", "#f4f7ee"],
  ["#7c3a6d", "#ffd1e8", "#7c3a6d"],
  ["#2f4a3c", "#d98c45", "#f4efe2"],
];
const COLS = 20;
const ROWS = 10;
// deterministic scatter of the 38
function chosen(): Set<number> {
  const s = new Set<number>();
  let x = 1234567;
  while (s.size < AUDIT.could) {
    x = (x * 1103515245 + 12345) % 2147483648;
    s.add(x % (COLS * ROWS));
  }
  return s;
}
const LIT = chosen();

const Grid: React.FC<{ inAt: number; cullAt: number; x: number; y: number; w: number; h: number }> = ({ inAt, cullAt, x, y, w, h }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cw = w / COLS;
  const ch = h / ROWS;
  const sw = cw * 0.8;
  const sh = ch * 0.78;
  const cull = interpolate(f, [cullAt, cullAt + 14], [0, 1], { ...clamp, easing: EASE.inOut });
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: x, top: y, overflow: "visible" }}>
      {Array.from({ length: COLS * ROWS }, (_, i) => {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        const p = spring({ frame: f - inAt - (c + r) * 1.1, fps, config: { damping: 14, mass: 0.5, stiffness: 170 } });
        const [wall, sA, sB] = PALETTES[(i * 7 + r) % PALETTES.length]!;
        const lit = LIT.has(i);
        const dim = lit ? 0 : cull;
        const px = c * cw + (cw - sw) / 2;
        const py = r * ch + (ch - sh);
        const aw = sh * 0.24 * (1 - dim * 0.75);
        const stripes = 5;
        return (
          <g key={i} transform={`translate(${px} ${py + sh}) scale(${p}) translate(0 ${-sh})`} opacity={p * (1 - dim * 0.62)}>
            <rect x={0} y={sh * 0.18} width={sw} height={sh * 0.82} rx={2} fill={dim > 0.5 ? C.c300 : wall} />
            <rect x={-2} y={sh * 0.12} width={sw + 4} height={sh * 0.08} rx={1.5} fill={dim > 0.5 ? C.c500 : sA} />
            {Array.from({ length: stripes }, (_, k) => (
              <path key={k} d={`M${(k * sw) / stripes} ${sh * 0.2} h${sw / stripes} v${aw} a${sw / stripes / 2} ${sw / stripes / 2.4} 0 0 1 ${-sw / stripes} 0 z`} fill={dim > 0.5 ? (k % 2 ? C.c200 : C.c500) : k % 2 ? sB : sA} />
            ))}
            <rect x={sw * 0.58} y={sh * 0.56} width={sw * 0.26} height={sh * 0.44} rx={sw * 0.13} fill={dim > 0.5 ? C.c500 : "rgba(0,0,0,.45)"} />
            <rect x={sw * 0.12} y={sh * 0.6} width={sw * 0.38} height={sh * 0.26} fill={dim > 0.5 ? C.c200 : "rgba(255,240,200,.55)"} />
            {lit ? <circle cx={sw * 0.71} cy={sh * 0.48} r={Math.max(2.5, sw * 0.09) * (1 + 0.25 * Math.max(0, Math.sin((f - cullAt) / 5)) * (cull > 0.5 ? 1 : 0))} fill={C.tomato} opacity={cull} /> : null}
          </g>
        );
      })}
    </svg>
  );
};

/**
 * vo-02 "Starting a small business still means a website, a domain, a checkout. And there's a new
 * kind of customer now: AI agents with wallets. In a September audit of two hundred retailers,
 * only thirty-eight could take their money."
 * Owners at work (licensed stock, never presented as Awning users) with three price tags; the new
 * customer in type; then 200 shopfronts, and only 38 stay lit.
 */
export const S2Problem: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tWebsite = w("website,");
  const tDomain = w("domain,");
  const tCheckout = w("checkout.");
  const tAnd = w("And");
  const tNew = w("new");
  const tAI = w("AI");
  const tIn = w("In");
  const tTwo = w("two");
  const tOnly = w("only");
  const t38 = w("thirty-eight");

  const partB = tAnd - 6;
  const partC = tIn - 8;
  const s = assets.stock;
  const tStill = w("still");
  // five owners at work, cut on the beats of the line
  const cuts = [0, tStill - 3, tWebsite - 3, tDomain - 3, tCheckout - 3, partB];
  const clips: [string | null, string, number, string?][] = [
    [s.roast ?? null, "coffee roasting", 2.0, "brightness(1.45) contrast(1.06) saturate(1.1)"],
    [s.market ?? null, "a market stall", 4.0],
    [s.bike ?? null, "a repair shop", 1.2],
    [s.pottery ?? null, "a pottery wheel", 3.0],
    [s.shutter ?? null, "a café opening up", 2.0],
  ];
  // the counter counts the shops as the street builds, and lands on 200 with "two hundred"
  const count = interpolate(f, [partC + 4, tTwo + 4], [0, AUDIT.total], { ...clamp, easing: EASE.out });
  const down = interpolate(f, [tOnly, t38 + 4], [0, 1], { ...clamp, easing: EASE.inOut });
  const shown = Math.round(down > 0 ? AUDIT.total - (AUDIT.total - AUDIT.could) * down : count);

  return (
    <Ground>
      <Voice timing={timing} take={take} />
      {/* A · owners at work */}
      {clips.map(([src, label, from, grade], i) => (
        <Sequence key={i} from={cuts[i]!} durationInFrames={Math.max(1, cuts[i + 1]! - cuts[i]!)} name={`b-roll ${label}`}>
          <Broll src={src} label={label} from={from} grade={grade} />
        </Sequence>
      ))}
      <Sequence from={0} durationInFrames={partB + 8} name="tags">
        <AbsoluteFill style={{ opacity: interpolate(f, [partB - 4, partB + 6], [1, 0], clamp) }}>
          {[
            ["a website", tWebsite, 300, -3],
            ["a domain", tDomain, 760, 2],
            ["a checkout", tCheckout, 1220, -1.5],
          ].map(([text, at, x, tilt]) => (
            <div key={text as string} style={{ position: "absolute", left: (x as number) - 10, top: 150 }}>
              <HangingTag at={(at as number) - 3} width={400} string={150} tilt={tilt as number}>
                <div style={{ ...display(54, { fontStretch: "112%", letterSpacing: "-0.03em" }), color: C.c900, whiteSpace: "nowrap" }}>{text as string}</div>
              </HangingTag>
            </div>
          ))}
        </AbsoluteFill>
      </Sequence>
      <Sfx src={assets.sfx.pop} at={tWebsite} volume={0.16} />
      <Sfx src={assets.sfx.pop} at={tDomain} volume={0.16} />
      <Sfx src={assets.sfx.pop} at={tCheckout} volume={0.16} />

      {/* B · the new customer */}
      <Sequence from={partB} durationInFrames={partC - partB + 10} name="new customer">
        <Ground>
          <AbsoluteFill style={{ padding: "0 150px", justifyContent: "center", opacity: interpolate(f, [partC - 2, partC + 8], [1, 0], clamp) }}>
            <Rise at={Math.max(6, tNew - partB - 22)} style={{ ...display(118), color: C.c900, marginTop: -70 }}>{"A new kind of customer:"}</Rise>
            <Rise at={tAI - partB - 4} stagger={4} style={{ ...display(118), color: C.g600, marginTop: 18 }}>{"AI agents with wallets."}</Rise>
          </AbsoluteFill>
        </Ground>
      </Sequence>

      {/* C · the audit */}
      <Sequence from={partC} name="audit">
        <Ground>
          <div style={{ position: "absolute", left: 130, top: 190, width: 600 }}>
            <div
              style={{
                ...display(300, { fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }),
                color: down > 0.5 ? C.g600 : C.c900,
                opacity: interpolate(f, [partC + 2, partC + 8], [0, 1], clamp),
              }}
            >
              {shown}
            </div>
            <div style={{ position: "relative", height: 130, marginTop: 18 }}>
              <div style={{ position: "absolute", inset: 0, ...display(52, { fontStretch: "112%", lineHeight: 1.08 }), color: C.c900, opacity: interpolate(f, [partC + 4, partC + 12, tOnly, tOnly + 8], [0, 1, 1, 0], clamp) }}>
                retailers audited
              </div>
              <div style={{ position: "absolute", inset: 0, ...display(52, { fontStretch: "112%", lineHeight: 1.08 }), color: C.c900, opacity: interpolate(f, [t38, t38 + 8], [0, 1], clamp) }}>
                of {AUDIT.total} could take
                <br />
                an agent's money
              </div>
            </div>
            <div style={{ fontFamily: FONT.text, fontSize: 22, lineHeight: 1.45, color: C.c700, marginTop: 30, maxWidth: 520, opacity: interpolate(f, [partC + 6, partC + 16], [0, 1], clamp) }}>
              {AUDIT.source}
            </div>
          </div>
          <Grid inAt={4} cullAt={tOnly - partC} x={790} y={150} w={1000} h={700} />
        </Ground>
      </Sequence>
    </Ground>
  );
};
