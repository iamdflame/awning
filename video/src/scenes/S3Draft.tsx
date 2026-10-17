import React from "react";
import { Sequence, interpolate, useCurrentFrame } from "remotion";
import { Receipt, type ReceiptLine } from "../brand/Paper";
import { C, EASE, FONT } from "../brand/tokens";
import { ProductClip } from "../components/ProductClip";
import { PromptBubble, RecordingBeat, beatIsReal } from "../components/Recording";
import { Stamp } from "../components/Kinetic";
import { BUSINESS } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";
import { shopFacts } from "./facts";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FW = 1090;
const FH = Math.round((FW * 9) / 16);

/**
 * vo-03 "Here's Ridge Roast, a coffee roaster in Accra. Awning names it, prices the offers, checks
 * real domains, and puts up a private preview. Nothing is paid yet."
 * The owner's take (P1, the plan) on the left; the plan prints as a receipt on the right, line by
 * line with the voice; then the private preview with its caution-tape ribbon. Paid so far: 0.00.
 */
export const S3Draft: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tHere = w("Here's");
  const tNames = w("names");
  const tPrices = w("prices");
  const tChecks = w("checks");
  const tPuts = w("puts");
  const tPrivate = w("private");
  const tNothing = w("Nothing");
  const end = timing.frames;
  const shop = shopFacts(assets);

  const slotPlan = tNames - 6;
  const slotPreview = tPuts - 6;
  const ownerFile = assets.rec.owner;
  const p1Real = beatIsReal("owner", "p1-type", ownerFile);
  const previewReal = beatIsReal("owner", "preview", ownerFile);
  const draft = assets.capture.shots["draft"];

  const offers = shop.offers.slice(0, 3);
  const lines: ReceiptLine[] = [
    { l: "name", r: shop.name, at: tNames, tone: "strong" },
    ...offers.map((o, i) => ({ l: o.title.length > 22 ? o.title.slice(0, 21) + "…" : o.title, r: o.price, at: tPrices + 4 + i * 5 })),
    { l: BUSINESS.domain, r: `${BUSINESS.openTotalUsdc} USDC`, at: tChecks + 4, tone: "green" as const },
    { l: "preview", r: "private", at: tPrivate },
  ];
  const nameIn = interpolate(f, [tHere - 4, tHere + 10], [0, 1], { ...clamp, easing: EASE.out });

  return (
    <Ground>
      <Voice timing={timing} take={take} />
      {lines.map((l, i) => (
        <Sfx key={i} src={assets.sfx.print} at={l.at - 1} volume={0.2} />
      ))}

      {/* left: the owner's chat, then the preview */}
      <div style={{ position: "absolute", left: 70, top: 108 }}>
        <Sequence from={0} durationInFrames={slotPlan} layout="none">
          <RecordingBeat who="owner" beat="p1-type" file={ownerFile} width={FW} height={FH} slot={slotPlan} />
        </Sequence>
        <Sequence from={slotPlan} durationInFrames={slotPreview - slotPlan} layout="none">
          <RecordingBeat who="owner" beat="plan" file={ownerFile} width={FW} height={FH} slot={slotPreview - slotPlan} />
        </Sequence>
        <Sequence from={slotPreview} layout="none">
          {previewReal ? (
            <RecordingBeat who="owner" beat="preview" file={ownerFile} width={FW} height={FH} slot={end - slotPreview} />
          ) : (
            <ProductClip shot={draft} width={FW} height={FH} startSec={0.2} cam={[{ at: 0, x: 0.5, y: 0.42, z: 1.12 }, { at: 80, x: 0.5, y: 0.46, z: 1.0, ease: "out" }]} label="draft storefront" />
          )}
        </Sequence>
      </div>
      {p1Real ? (
        <Sequence from={6} durationInFrames={slotPlan - 6} layout="none">
          <PromptBubble who="owner" beat="p1-type" real slot={slotPlan} width={1000} size={34} style={{ position: "absolute", left: 120, top: 560 }} />
        </Sequence>
      ) : null}

      {/* right: the business, then the plan as a receipt */}
      <div style={{ position: "absolute", left: 1220, top: 88, width: 640, opacity: nameIn, transform: `translateY(${(1 - nameIn) * 18}px)` }}>
        <div style={{ fontFamily: '"Alfa Slab One"', fontSize: 84, lineHeight: 1, color: C.c900, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{shop.name}</div>
        <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 30, color: C.c700, marginTop: 10 }}>
          A coffee roaster in {BUSINESS.city}
        </div>
      </div>
      {f >= tNames - 10 ? (
        <div style={{ position: "absolute", left: 1222, top: 262 }}>
          <Receipt
            width={640}
            size={23}
            rotate={1.2}
            head={["AWNING_PLAN", shop.mock ? "LOCAL MOCK" : "DRAFT"]}
            lines={lines}
            total={{ amount: "0.00", label: <>PAID SO FAR<br />USDC</>, at: tNothing, color: C.c900 }}
          />
        </div>
      ) : null}
      {f >= tNothing ? (
        <div style={{ position: "absolute", left: 1350, top: 730 }}>
          <Stamp at={tNothing + 6} size={34} rotate={-9}>
            Nothing paid yet
          </Stamp>
        </div>
      ) : null}
    </Ground>
  );
};
