import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Curb, Shopfront } from "../brand/Shopfront";
import { streetLooks } from "../brand/street";
import { C, EASE, display, receipt } from "../brand/tokens";
import { Rise } from "../components/Kinetic";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const LOOKS = streetLooks(2);
const SCALE = 1.22;
const GAP = 22;

/**
 * vo-08 "Every business on Awning is born agent-payable."
 * The street (the landing's own illustration): the camera drifts along it, every awning unrolls in
 * turn, every window lights, and each door gets its x402 tag. The line lands as a title. (These are
 * the design's example shops: no sales are drawn on them.)
 */
export const S8Street: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tEvery = w("Every");
  const tBorn = w("born");
  const tPayable = w("agent-payable.");
  const total = timing.frames;
  // shop x positions (scaled)
  const xs: number[] = [];
  let x = 0;
  for (const s of LOOKS) {
    xs.push(x);
    x += (s.w + GAP) * SCALE;
  }
  const streetW = x;
  const pan = interpolate(f, [0, total], [60, -(streetW - 1920) * 0.55], { easing: EASE.inOut });
  const baseY = 852; // the curb's top edge

  return (
    <Ground>
      <Voice timing={timing} take={take} />
      <Sfx src={assets.sfx.cloth} at={tEvery - 4} volume={0.22} />
      <div style={{ position: "absolute", left: 120, top: 96, width: 1700, zIndex: 3 }}>
        <Rise at={tBorn - 10} stagger={4} style={{ ...display(132), color: C.c900 }}>{"Born agent-payable."}</Rise>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translateX(${pan}px)` }}>
        {LOOKS.map((s, i) => {
          const screenX = xs[i]! + pan;
          // the wave travels with the camera: shops entering the frame open as the line is spoken
          const at = tEvery - 16 + Math.max(0, screenX / 1920) * (tBorn - tEvery + 10) + i * 1.5;
          const unroll = interpolate(f, [at, at + 16], [0.05, 1], { ...clamp, easing: EASE.unroll });
          const paint = interpolate(f, [at - 6, at + 10], [0, 1], { ...clamp, easing: EASE.out });
          const lit = interpolate(f, [at + 6, at + 18], [0, 1], clamp);
          const tag = interpolate(f, [Math.max(at + 10, tPayable - 6 + (i % 4) * 2), Math.max(at + 22, tPayable + 8 + (i % 4) * 2)], [0, 1], { ...clamp, easing: EASE.unroll });
          const swing = 6 * Math.sin((f - at) / 9) * Math.exp(-Math.max(0, f - tPayable) / 40);
          return (
            <div key={i} style={{ position: "absolute", left: xs[i], top: baseY - s.h * SCALE, transform: `scale(${SCALE})`, transformOrigin: "0 0" }}>
              <Shopfront s={s} unroll={unroll} paint={paint} lit={lit} />
              {tag > 0 ? (
                <div style={{ position: "absolute", right: 20, top: 118, transformOrigin: "50% -18px", transform: `rotate(${swing}deg) scale(${tag})`, opacity: Math.min(1, tag) }}>
                  <div style={{ position: "absolute", left: "50%", top: -18, width: 1.5, height: 18, background: C.c500 }} />
                  <div style={{ padding: "4px 8px 5px", borderRadius: 5, background: C.c0, boxShadow: "0 3px 8px rgba(0,0,0,.25)", ...receipt(12, { fontWeight: 700, color: C.g800 }) }}>x402</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, top: baseY }}>
        <Curb width={1920} height={240} />
      </div>
    </Ground>
  );
};
