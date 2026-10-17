import React from "react";
import { Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Receipt } from "../brand/Paper";
import { C, EASE, SHADOW } from "../brand/tokens";
import { BrowserFrame } from "../components/BrowserFrame";
import { ProductClip } from "../components/ProductClip";
import { RecordingBeat } from "../components/Recording";
import { BUSINESS } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";
import { saleFacts, shopFacts } from "./facts";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FW = 1180;
const FH = Math.round((FW * 9) / 16);
const BW = 1460;
const BH = Math.round((BW * 9) / 16);

/** The shop's menu board, in the shop's own face: the new monthly box slides in on "subscription box". */
const MenuBoard: React.FC<{ offers: { title: string; price: string }[]; addAt: number; palette: { ink: string; paper: string; accent: string; primary: string } }> = ({ offers, addAt, palette }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - addAt, fps, config: { damping: 15, mass: 0.6, stiffness: 150 } });
  const isNew = (t: string) => /month|subscri/i.test(t);
  const base = offers.filter((o) => !isNew(o.title)).slice(0, 2);
  const added = offers.find((o) => isNew(o.title)) ?? { title: BUSINESS.subscription.title, price: `$${BUSINESS.subscription.priceUsd}` };
  const rows = [...base.map((o) => ({ ...o, isNew: false })), { ...added, isNew: true }];
  return (
    <div style={{ width: 600, background: palette.ink, color: palette.paper, borderRadius: 26, padding: "30px 34px 22px", boxShadow: SHADOW.s4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: '"Alfa Slab One"', fontSize: 40, lineHeight: 1 }}>{BUSINESS.name}</span>
        <span style={{ fontFamily: '"Work Sans"', fontWeight: 600, fontSize: 19, opacity: 0.7 }}>on the bar</span>
      </div>
      <div style={{ marginTop: 18 }}>
        {rows.map((o, i) => {
          const h = o.isNew ? 78 * p : 78;
          return (
            <div key={i} style={{ height: h, overflow: "hidden", borderTop: `2px dashed ${palette.paper}40`, opacity: o.isNew ? Math.min(1, p * 1.3) : 1 }}>
              <div style={{ height: 78, display: "flex", alignItems: "center", gap: 14, transform: `translateX(${o.isNew ? (1 - p) * 60 : 0}px)` }}>
                <span style={{ fontFamily: '"Alfa Slab One"', fontSize: o.title.length > 18 ? 23 : 27, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</span>
                {o.isNew ? <span style={{ padding: "5px 12px", borderRadius: 999, background: palette.accent, color: palette.ink, fontFamily: '"Work Sans"', fontWeight: 700, fontSize: 17, letterSpacing: "0.04em" }}>NEW</span> : null}
                <span style={{ fontFamily: '"Alfa Slab One"', fontSize: 34 }}>{o.price}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

type Region = { at: number; x: number; y: number; w: number };
/** A still page (BaseScan) in a short, wide browser window: the camera moves between regions given
 *  in CSS px of the captured page (1536 wide); a tomato line underlines what matters. */
const PageStill: React.FC<{ src: string | undefined; url: string; width: number; height: number; keys: Region[]; mark?: { at: number; x: number; y: number; w: number } }> = ({ src, url, width, height, keys, mark }) => {
  const f = useCurrentFrame();
  let r = keys[0]!;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (f >= a.at) {
      const p = interpolate(f, [a.at, b.at], [0, 1], { ...clamp, easing: EASE.inOut });
      r = { at: f, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: Math.exp(Math.log(a.w) + (Math.log(b.w) - Math.log(a.w)) * p) };
    }
  }
  const k = width / r.w;
  const m = mark ? interpolate(f, [mark.at, mark.at + 12], [0, 1], { ...clamp, easing: EASE.out }) : 0;
  return (
    <BrowserFrame width={width} height={height} url={url}>
      {src ? (
        <div style={{ position: "absolute", left: -r.x * k, top: -r.y * k, width: 1536 * k, height: 864 * k }}>
          <Img src={staticFile(src)} style={{ width: "100%", height: "100%", display: "block" }} />
          {mark && m > 0 ? <div style={{ position: "absolute", left: mark.x * k, top: mark.y * k, width: mark.w * k * m, height: Math.max(3, 2.2 * k), borderRadius: 3, background: C.tomato }} /> : null}
        </div>
      ) : null}
    </BrowserFrame>
  );
};

/**
 * vo-06 "The owner runs the shop from the same chat: add a subscription box, check the orders. Every
 * shop is listed where any agent can find it, and every sale lands on a public receipt you can check
 * on chain."
 * The owner's chat (P5: the $30 box goes live while the menu board gains it; P6: the first sale and
 * its transaction while the orders receipt prints); awning.sh/directory finds Ridge Roast; then
 * awning.sh/live with the sale, and the same transaction on BaseScan.
 */
export const S6Run: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tSub = w("subscription");
  const tCheck = w("check");
  const tOrders = w("orders.");
  const tListed = w("listed");
  const tFind = w("find");
  const tPublic = w("public");
  const tReceipt = w("receipt");
  const tCheck2 = w("check", 1);
  const shop = shopFacts(assets);
  const sale = saleFacts(assets);
  const o2 = assets.rec.owner2;

  const slotOrders = tCheck - 4;
  const slotDir = tListed - 4; // the owner's answer stays until "listed"
  const slotLive = tPublic - 10;
  const slotChain = tCheck2 - 8; // "check on chain": the transaction on BaseScan
  const dirResults = tFind - 4;
  const out = interpolate(f, [slotDir - 6, slotDir + 8], [0, 1], { ...clamp, easing: EASE.inOut });
  const live = assets.capture.shots["live"];
  const scan = assets.capture.shots["basescan"] as (typeof assets.capture.shots)[string] & { still?: string };

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
      <div style={{ position: "absolute", left: 1290, top: 120, opacity: interpolate(f, [tSub - 14, tSub - 4], [0, 1], clamp), transform: `translate(${out * -1960}px, ${interpolate(f, [tSub - 14, tSub], [24, 0], { ...clamp, easing: EASE.out })}px) rotate(-1.5deg)` }}>
        <MenuBoard offers={shop.offers} addAt={tSub + 2} palette={shop.palette} />
      </div>
      {f >= tOrders - 8 && f < slotDir + 10 ? (
        <div style={{ position: "absolute", left: 1320, top: 480, transform: `translateX(${out * -1960}px)` }}>
          <Receipt
            width={540}
            size={20}
            rotate={1.5}
            head={["AWNING_ORDERS", sale.mock ? "TAKE PENDING" : BUSINESS.name.toUpperCase()]}
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
            <ProductClip shot={assets.capture.shots["directory"]} width={BW} height={BH} startSec={1.3} cam={[{ at: 0, x: 0.5, y: 0.5, z: 1.0 }, { at: 40, x: 0.55, y: 0.56, z: 1.12, ease: "inOut" }]} label="awning.sh/directory" />
          </Sequence>
          <Sequence from={dirResults} layout="none">
            <ProductClip shot={assets.capture.shots["directory-results"]} width={BW} height={BH} startSec={0.4} cam={[{ at: 0, x: 0.5, y: 0.45, z: 1 }, { at: 50, x: 0.36, y: 0.55, z: 1.3, ease: "inOut" }]} label="directory results" />
          </Sequence>
        </div>
      ) : null}

      {/* every sale lands on a public receipt: awning.sh/live, then the transaction on BaseScan */}
      {f >= slotLive - 4 ? (
        <div style={{ position: "absolute", left: 230, top: 70, opacity: interpolate(f, [slotLive - 4, slotLive + 8], [0, 1], clamp) }}>
          <Sequence from={slotLive} durationInFrames={Math.max(1, slotChain - slotLive)} layout="none">
            <ProductClip
              shot={live}
              width={BW}
              height={BH}
              startSec={Math.max(0.5, 6.85 - (slotChain - slotLive) / 30)}
              cam={[{ at: 0, x: 0.62, y: 0.4, z: 1.3 }, { at: Math.max(16, tReceipt - slotLive + 4), x: 0.62, y: 0.37, z: 2.0, ease: "inOut" }]}
              label="awning.sh/live"
            />
          </Sequence>
          {scan?.still ? (
            // a cut, like following the link: the same transaction on BaseScan
            <Sequence from={slotChain} layout="none">
              <div style={{ position: "absolute", left: 0, top: 110 }}>
                <PageStill src={scan.still} url={scan.displayUrl} width={BW} height={560} keys={[{ at: 0, x: 84, y: 236, w: 1010 }, { at: 70, x: 96, y: 266, w: 730 }]} mark={{ at: 14, x: 161, y: 311, w: 545 }} />
              </div>
            </Sequence>
          ) : null}
        </div>
      ) : null}
    </Ground>
  );
};
