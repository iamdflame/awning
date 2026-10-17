import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Canopy } from "../brand/Canopy";
import { Mark, Wordmark } from "../brand/Logo";
import { C, EASE, FONT, display } from "../brand/tokens";
import { Rise } from "../components/Kinetic";
import { ONE_LINER, URL_HOME } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * vo-09 "One sentence. One approval. Open yours at awning dot S-H."
 * The end card on the rod's green, under the canopy: the two beats of the product as type, then the
 * mark unrolls with the wordmark, the one-liner, and the address with its OPEN-sign tomato pill.
 */
export const EndCard: React.FC<{ tSentence: number; tApproval: number; tOpen: number; tUrl: number; showLine?: boolean }> = ({ tSentence, tApproval, tOpen, tUrl, showLine = true }) => {
  const f = useCurrentFrame();
  const canopy = interpolate(f, [0, 26], [0.06, 1], { ...clamp, easing: EASE.unroll });
  const beatsOut = interpolate(f, [tOpen - 10, tOpen + 2], [0, 1], { ...clamp, easing: EASE.inOut });
  const logoT = interpolate(f, [tOpen - 6, tOpen + 24], [0, 1], clamp);
  const lineIn = interpolate(f, [tOpen + 6, tOpen + 20], [0, 1], { ...clamp, easing: EASE.out });
  const ctaIn = interpolate(f, [tUrl - 4, tUrl + 10], [0, 1], { ...clamp, easing: EASE.out });
  return (
    <Ground color={C.g800} grain={0.05}>
      <AbsoluteFill>
        <div style={{ height: 34, background: C.g900 }} />
        <Canopy sw={96} height={124} progress={canopy} />
      </AbsoluteFill>
      {/* one sentence, one approval */}
      <div style={{ position: "absolute", left: 150, top: 330, opacity: 1 - beatsOut, transform: `translateY(${beatsOut * -40}px)` }}>
        <Rise at={tSentence - 4} style={{ ...display(150), color: C.c50 }}>{"One sentence."}</Rise>
        <Rise at={tApproval - 4} style={{ ...display(150), color: C.sun, marginTop: 8 }}>{"One approval."}</Rise>
      </div>
      {/* the lockup, the line, the address */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: Math.min(1, logoT * 3) }}>
          <Mark size={196} t={logoT} green={C.c50} canvas={C.g800} />
          <div style={{ opacity: interpolate(f, [tOpen + 4, tOpen + 16], [0, 1], clamp), transform: `translateX(${interpolate(f, [tOpen + 4, tOpen + 18], [-20, 0], { ...clamp, easing: EASE.out })}px)` }}>
            <Wordmark height={136} reversed />
          </div>
        </div>
        {showLine ? (
          <div style={{ marginTop: 48, maxWidth: 1400, textAlign: "center", fontFamily: FONT.text, fontWeight: 500, fontSize: 54, lineHeight: 1.3, color: "rgba(247,246,237,.88)", textWrap: "balance", opacity: lineIn, transform: `translateY(${(1 - lineIn) * 16}px)` }}>
            {ONE_LINER}
          </div>
        ) : null}
        <div style={{ marginTop: 50, display: "flex", alignItems: "center", gap: 30, opacity: ctaIn, transform: `translateY(${(1 - ctaIn) * 16}px)` }}>
          <div style={{ height: 100, padding: "0 50px", borderRadius: 999, background: `linear-gradient(180deg, #f2604b, ${C.tomato})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), 0 14px 34px -8px rgba(235,75,53,.6)", display: "flex", alignItems: "center", fontFamily: FONT.text, fontWeight: 700, fontStretch: "106%", fontSize: 46, color: "#fff" }}>
            Open yours
          </div>
          <div style={{ ...display(92, { fontStretch: "112%", letterSpacing: "-0.03em" }), color: C.c50 }}>{URL_HOME}</div>
        </div>
      </AbsoluteFill>
    </Ground>
  );
};

export const S9End: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const w = wordsOf(take, timing);
  const tOpen = w("Open");
  const tUrl = w("awning", 0);
  return (
    <>
      <Voice timing={timing} take={take} />
      <Sfx src={assets.sfx.cloth} at={2} volume={0.25} />
      <Sfx src={assets.sfx.bell} at={tOpen + 2} volume={0.22} />
      <EndCard tSentence={w("One")} tApproval={w("One", 1)} tOpen={tOpen} tUrl={tUrl} />
    </>
  );
};
