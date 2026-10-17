import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Canopy } from "../brand/Canopy";
import { Logo, Mark, Wordmark } from "../brand/Logo";
import { Receipt } from "../brand/Paper";
import { C, EASE, FONT } from "../brand/tokens";
import { ProductClip } from "../components/ProductClip";
import { TypeOn } from "../components/Kinetic";
import { BUSINESS, PROMPTS } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * vo-01 "This is Awning. You tell your AI agent one sentence, and it opens a real business that
 * people, and other AI agents, can buy from."
 * The canopy unrolls; the sentence is lettered in sun gold on a green hoarding (the landing's own
 * gesture); the hoarding lifts on "a real business" to show the real storefront; a receipt prints
 * on "other AI agents".
 */
export const S1Open: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tYou = w("You");
  const tOpens = w("opens");
  const tReal = w("real");
  const tPeople = w("people,");
  const tOther = w("other");
  const tAgents = w("agents,");
  const tBuy = w("buy");

  const rod = interpolate(f, [0, 12], [0, 1], { ...clamp, easing: EASE.out });
  const unroll = interpolate(f, [5, 34], [0.08, 1], { ...clamp, easing: EASE.unroll });
  const lift = tReal - 6;
  const up = interpolate(f, [lift, lift + 26], [0, 1], { ...clamp, easing: EASE.inOut });
  const hoardIn = interpolate(f, [6, 24], [0, 1], { ...clamp, easing: EASE.out });

  const text = PROMPTS.P1;
  const typeStart = Math.max(16, tYou - 2);
  const typeEnd = Math.max(typeStart + 30, tOpens - 4);
  const cps = Math.min(95, Math.max(32, text.length / ((typeEnd - typeStart) / 30)));

  // the storefront frame: revealed under the hoarding, then rises as the Awning canopy leaves
  const frameW = interpolate(up, [0, 1], [1620, 1700]);
  const frameH = Math.round((frameW * 9) / 16);
  const frameX = (1920 - frameW) / 2;
  const frameY = interpolate(up, [0, 1], [236, 70]);
  const shot = assets.capture.shots["storefront"];

  return (
    <Ground>
      <Voice timing={timing} take={take} />
      <Sfx src={assets.sfx.cloth} at={4} volume={0.35} />
      <Sfx src={assets.sfx.type} at={typeStart} volume={0.12} dur={Math.min(90, typeEnd - typeStart + 6)} />
      <Sfx src={assets.sfx.print} at={tPeople - 2} volume={0.28} />
      <Sfx src={assets.sfx.print} at={tAgents - 2} volume={0.28} />
      <Sfx src={assets.sfx.pop} at={tBuy} volume={0.3} />

      {/* the real storefront, waiting behind the hoarding */}
      <div style={{ position: "absolute", left: frameX, top: frameY, opacity: up > 0 ? 1 : 0 }}>
        <Sequence from={lift} layout="none">
          <ProductClip shot={shot} width={frameW} height={frameH} url={shot?.source === "live" ? shot.displayUrl : BUSINESS.domain} holdAt={2.6} cam={[{ at: 0, x: 0.5, y: 0.46, z: 1.3 }, { at: 70, x: 0.5, y: 0.47, z: 1.2, ease: "out" }]} />
        </Sequence>
      </div>

      {/* the hoarding with the sentence */}
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 236,
          width: 1620,
          height: 640,
          borderRadius: "14px 14px 0 0",
          background: `repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 3px, transparent 3px 180px), ${C.g800}`,
          boxShadow: `inset 0 0 0 10px ${C.g900}, 0 30px 60px -30px rgba(0,25,15,.5)`,
          transform: `translateY(${(1 - hoardIn) * 50 + up * -980}px)`,
          opacity: hoardIn * (1 - up * 0.4),
          display: "flex",
          alignItems: "center",
          padding: "0 110px",
        }}
      >
        {/* "This is Awning.": the lockup on the hoarding, then it makes way for the sentence */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 30, opacity: interpolate(f, [typeStart - 12, typeStart - 2], [1, 0], clamp), transform: `translateY(${interpolate(f, [typeStart - 12, typeStart - 2], [0, -30], { ...clamp, easing: EASE.inOut })}px)` }}>
          <Mark size={190} t={interpolate(f, [12, 40], [0, 1], clamp)} green={C.sun} canvas={C.g800} />
          <div style={{ opacity: interpolate(f, [24, 36], [0, 1], clamp), transform: `translateX(${interpolate(f, [24, 40], [-24, 0], { ...clamp, easing: EASE.out })}px)` }}>
            <Wordmark height={132} reversed />
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 30, letterSpacing: "0.02em", color: "rgba(250,202,75,.72)", marginBottom: 34, opacity: interpolate(f, [typeStart - 8, typeStart], [0, 1], clamp) }}>
            You, to your agent
          </div>
          <div style={{ fontFamily: FONT.display, fontWeight: 700, fontStretch: "112%", fontSize: 56, lineHeight: 1.2, letterSpacing: "-0.015em", color: C.sun, textShadow: "0 2px 0 rgba(140,95,10,.55)", textWrap: "pretty", minHeight: 56 * 1.2 * 5 }}>
            <TypeOn at={typeStart} text={text} cps={cps} caretColor={C.sun} />
          </div>
        </div>
      </div>

      {/* the rod and the canopy: Awning's own shopfront crowns the opening, then steps aside */}
      <AbsoluteFill style={{ transform: `translateY(${up * -240}px)` }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${(rod - 1) * 100}%)` }}>
          <div style={{ height: 96, background: C.g800, display: "flex", alignItems: "center", padding: "0 72px", justifyContent: "space-between" }}>
            <Logo height={46} reversed style={{ opacity: interpolate(f, [8, 20], [0, 1], clamp) }} />
            <span style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 28, color: "rgba(247,246,237,.82)", opacity: interpolate(f, [14, 26], [0, 1], clamp) }}>A PayBox plugin</span>
          </div>
          <Canopy sw={96} height={124} progress={unroll} />
        </div>
      </AbsoluteFill>

      {/* the first sale, printed on "other AI agents" */}
      {f >= tPeople - 8 ? (
        <div style={{ position: "absolute", right: 70, top: 120 + interpolate(f, [tPeople - 8, tPeople + 6], [-30, 0], { ...clamp, easing: EASE.out }), opacity: interpolate(f, [tPeople - 8, tPeople], [0, 1], clamp) }}>
          <Receipt
            width={520}
            size={21}
            rotate={2.2}
            head={[BUSINESS.name.toUpperCase(), "x402 · BASE"]}
            lines={[
              { l: BUSINESS.tasting.title, r: BUSINESS.tasting.priceUsdc, at: tPeople },
              { l: "paid by", r: "an AI agent", at: tOther, tone: "agent" },
              { l: "to", r: "the owner's wallet", at: tAgents },
            ]}
            total={{ amount: `+${BUSINESS.tasting.priceUsdc}`, label: <>USDC FROM AN AGENT<br />STRAIGHT TO THE OWNER</>, at: tBuy }}
          />
        </div>
      ) : null}
    </Ground>
  );
};
