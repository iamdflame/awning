import React from "react";
import { Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Receipt } from "../brand/Paper";
import { C, EASE, FONT, SHADOW } from "../brand/tokens";
import { ProductClip } from "../components/ProductClip";
import { PromptBubble, RecordingBeat, beatIsReal } from "../components/Recording";
import { BUSINESS } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";
import { saleFacts, shopFacts } from "./facts";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FW = 1180;
const FH = Math.round((FW * 9) / 16);

/** The shop's menu board, in the shop's own face: the new monthly box slides in on "subscription box". */
const MenuBoard: React.FC<{ offers: { title: string; price: string }[]; addAt: number; mock: boolean; palette: { ink: string; paper: string; accent: string; primary: string } }> = ({ offers, addAt, mock, palette }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - addAt, fps, config: { damping: 15, mass: 0.6, stiffness: 150 } });
  const rows = [...offers.filter((o) => !/month|subscri/i.test(o.title)).slice(0, 2), { title: "Monthly subscription box", price: "$30", isNew: true }];
  return (
    <div style={{ width: 560, background: palette.ink, color: palette.paper, borderRadius: 26, padding: "30px 34px 22px", boxShadow: SHADOW.s4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: '"Alfa Slab One"', fontSize: 40, lineHeight: 1 }}>{BUSINESS.name}</span>
        <span style={{ fontFamily: '"Work Sans"', fontWeight: 600, fontSize: 19, opacity: 0.7 }}>{mock ? "local mock" : "on the bar"}</span>
      </div>
      <div style={{ marginTop: 18 }}>
        {rows.map((o, i) => {
          const isNew = "isNew" in o;
          const h = isNew ? 78 * p : 78;
          return (
            <div key={i} style={{ height: h, overflow: "hidden", borderTop: `2px dashed ${palette.paper}40`, opacity: isNew ? Math.min(1, p * 1.3) : 1 }}>
              <div style={{ height: 78, display: "flex", alignItems: "center", gap: 14, transform: `translateX(${isNew ? (1 - p) * 60 : 0}px)` }}>
                <span style={{ fontFamily: '"Alfa Slab One"', fontSize: 27, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</span>
                {isNew ? <span style={{ padding: "5px 12px", borderRadius: 999, background: palette.accent, color: palette.ink, fontFamily: '"Work Sans"', fontWeight: 700, fontSize: 17, letterSpacing: "0.04em" }}>NEW</span> : null}
                <span style={{ fontFamily: '"Alfa Slab One"', fontSize: 34 }}>{o.price}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * vo-06 "The owner runs the shop from the same chat: add a subscription box, check the orders.
 * Every shop is listed where any agent can find it, and every sale lands on a public receipt you
 * can check on chain."
 * Back to the owner (P5, P6); the menu gains the monthly box and the orders print; then the
 * directory finds the shop; then awning.sh/live, leaning into the transaction on BaseScan.
 */
export const S6Run: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tSub = w("subscription");
  const tCheck = w("check");
  const tOrders = w("orders.");
  const tEvery = w("Every");
  const tFind = w("find");
  const tPublic = w("public");
  const tReceipt = w("receipt");
  const tChain = w("chain.");
  const shop = shopFacts(assets);
  const sale = saleFacts(assets);
  const o2 = assets.rec.owner2;
  const p5Real = beatIsReal("owner2", "p5-offer", o2);
  const p6Real = beatIsReal("owner2", "p6-orders", o2);

  const slotOrders = tCheck - 4;
  const slotDir = tEvery - 6;
  const slotLive = tPublic - 10;
  const dirResults = tFind - 4;
  const out = interpolate(f, [slotDir - 6, slotDir + 8], [0, 1], { ...clamp, easing: EASE.inOut });

  return (
    <Ground>
      <Voice timing={timing} take={take} />
      <Sfx src={assets.sfx.pop} at={tSub + 4} volume={0.22} />
      <Sfx src={assets.sfx.print} at={tOrders - 2} volume={0.24} />

      {/* the owner, in the same chat */}
      <div style={{ position: "absolute", left: 70, top: 108, transform: `translateX(${out * -1960}px)` }}>
        <Sequence from={0} durationInFrames={slotOrders} layout="none">
          <RecordingBeat who="owner2" beat="p5-offer" file={o2} width={FW} height={FH} slot={slotOrders} />
        </Sequence>
        <Sequence from={slotOrders} durationInFrames={Math.max(1, slotDir + 10 - slotOrders)} layout="none">
          <RecordingBeat who="owner2" beat="p6-orders" file={o2} width={FW} height={FH} slot={slotDir - slotOrders} />
        </Sequence>
      </div>
      {p5Real ? (
        <Sequence from={4} durationInFrames={slotOrders - 4} layout="none">
          <PromptBubble who="owner2" beat="p5-offer" real slot={slotOrders} width={900} size={34} style={{ position: "absolute", left: 120, top: 620 }} />
        </Sequence>
      ) : null}
      {p6Real ? (
        <Sequence from={slotOrders + 2} durationInFrames={Math.max(1, slotDir - slotOrders - 2)} layout="none">
          <PromptBubble who="owner2" beat="p6-orders" real slot={slotDir - slotOrders} width={700} size={34} style={{ position: "absolute", left: 120, top: 640 }} />
        </Sequence>
      ) : null}
      <div style={{ position: "absolute", left: 1300, top: 120, opacity: interpolate(f, [tSub - 14, tSub - 4], [0, 1], clamp), transform: `translate(${out * -1960}px, ${interpolate(f, [tSub - 14, tSub], [24, 0], { ...clamp, easing: EASE.out })}px) rotate(-1.5deg)` }}>
        <MenuBoard offers={shop.offers} addAt={tSub + 2} mock={shop.mock} palette={shop.palette} />
      </div>
      {f >= tOrders - 8 && f < slotDir + 10 ? (
        <div style={{ position: "absolute", left: 1330, top: 470, transform: `translateX(${out * -1960}px)` }}>
          <Receipt
            width={520}
            size={19}
            rotate={1.5}
            head={["AWNING_ORDERS", sale.mock ? "LOCAL MOCK" : BUSINESS.name.toUpperCase()]}
            lines={[
              { l: BUSINESS.tasting.title, r: `${sale.amount} paid`, at: tOrders, tone: "strong" },
              ...(sale.txShort ? [{ l: "tx", r: sale.txShort, at: tOrders + 6, tone: "muted" as const }] : []),
              { l: "buyer's note", r: "untrusted", at: tOrders + 12, tone: "muted" },
            ]}
          />
        </div>
      ) : null}

      {/* every shop is listed where any agent can find it */}
      {f >= slotDir - 8 ? (
        <div style={{ position: "absolute", left: 230, top: 70, transform: `translateX(${(1 - out) * 1960}px)`, opacity: interpolate(f, [slotLive - 4, slotLive + 8], [1, 0], clamp) }}>
          <Sequence from={slotDir} durationInFrames={Math.max(1, dirResults - slotDir + 4)} layout="none">
            <ProductClip shot={assets.capture.shots["directory"]} width={1460} height={821} startSec={1.3} cam={[{ at: 0, x: 0.5, y: 0.5, z: 1.0 }, { at: 40, x: 0.55, y: 0.56, z: 1.12, ease: "inOut" }]} label="awning.sh/directory" />
          </Sequence>
          <Sequence from={dirResults} layout="none">
            <ProductClip shot={assets.capture.shots["directory-results"]} width={1460} height={821} startSec={0.4} cam={[{ at: 0, x: 0.5, y: 0.45, z: 1 }, { at: 50, x: 0.38, y: 0.5, z: 1.25, ease: "inOut" }]} label="directory results" />
          </Sequence>
        </div>
      ) : null}

      {/* every sale lands on a public receipt you can check on chain */}
      {f >= slotLive - 4 ? (
        <div style={{ position: "absolute", left: 230, top: 70, opacity: interpolate(f, [slotLive - 4, slotLive + 8], [0, 1], clamp) }}>
          <Sequence from={slotLive} layout="none">
            <ProductClip
              shot={assets.capture.shots["live"]}
              width={1460}
              height={821}
              startSec={assets.capture.shots["live"]?.source === "live" ? 1.0 : 5.0}
              cam={[{ at: 0, x: 0.66, y: 0.42, z: 1.25 }, { at: Math.max(16, tReceipt - slotLive + 6), x: 0.67, y: 0.37, z: 1.8, ease: "inOut" }, { at: Math.max(40, tChain - slotLive + 6), x: 0.66, y: 0.38, z: 2.15, ease: "inOut" }]}
              label="awning.sh/live"
            />
          </Sequence>
        </div>
      ) : null}
    </Ground>
  );
};
