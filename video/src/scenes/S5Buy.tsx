import React from "react";
import { Sequence, interpolate, useCurrentFrame } from "remotion";
import { Receipt, Ticket } from "../brand/Paper";
import { C, EASE } from "../brand/tokens";
import { ProductClip } from "../components/ProductClip";
import { PromptBubble, RecordingBeat, beatIsReal, beatOf, frameOfSource } from "../components/Recording";
import { Stamp } from "../components/Kinetic";
import { TwoAgents } from "../components/TerminalFrame";
import { BUSINESS } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";
import { saleFacts } from "./facts";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FW = 1180;
const FH = Math.round((FW * 9) / 16);

/**
 * vo-05 "Now a different agent goes shopping for a coffee tasting in Accra. It finds Ridge Roast on
 * its own. Five dollars in USDC, one approval, paid straight to the owner's wallet. Ridge Roast's
 * first customer was an AI."
 * A different agent: Claude Code in a terminal (P3, P4, the 5.00 approval), against the browser
 * agent that opened the shop; the sale prints as a receipt with the real wallet and transaction;
 * then awning.sh/live, where the SOLD line has printed.
 */
export const S5Buy: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tDifferent = w("different");
  const tFive = w("Five");
  const tApproval = w("approval,");
  const tPaid = w("paid");
  const tStraight = w("straight");
  const tOwners = w("owner's");
  const tWallet = w("wallet.");
  const tRidge = w("Ridge", 1);
  const tFirst = w("first");
  const sale = saleFacts(assets);
  const buyer = assets.rec.buyer;
  const p3Real = beatIsReal("buyer", "p3-find", buyer);
  const p4Real = beatIsReal("buyer", "p4-buy", buyer);
  const b4 = beatOf("buyer", "p4-buy");

  const slotBuy = tFive - 8;
  const slotReceipt = tPaid - 6;
  const slotLive = tRidge - 6;
  const realApprove = p4Real && b4.approve?.at != null ? frameOfSource(b4, b4.approve.at, 30) : null;
  const approveAt = realApprove != null ? slotBuy + realApprove : tApproval;

  const frameOut = interpolate(f, [slotReceipt - 4, slotReceipt + 14], [0, 1], { ...clamp, easing: EASE.inOut });
  const liveIn = interpolate(f, [slotLive, slotLive + 16], [0, 1], { ...clamp, easing: EASE.out });
  const live = assets.capture.shots["live"];
  // the live page prints every line as it loads; the local take prints the new SOLD line at 3 s
  const liveFrom = live?.source === "live" ? 0 : 2.0;

  return (
    <Ground>
      <Voice timing={timing} take={take} />
      {realApprove == null ? <Sfx src={assets.sfx.chime} at={approveAt} volume={0.3} /> : null}
      <Sfx src={assets.sfx.print} at={tPaid} volume={0.26} />
      <Sfx src={assets.sfx.print} at={tStraight} volume={0.26} />
      <Sfx src={assets.sfx.print} at={tOwners} volume={0.26} />
      <Sfx src={assets.sfx.pop} at={tWallet + 8} volume={0.32} />

      {/* a different agent: the browser one opened the shop, the terminal one buys */}
      <div style={{ position: "absolute", left: 70, top: 34, opacity: 1 - frameOut }}>
        <TwoAgents p={interpolate(f, [tDifferent - 8, tDifferent + 6], [0, 1], { ...clamp, easing: EASE.out })} />
      </div>

      <div style={{ position: "absolute", left: 70, top: 108, transform: `translateX(${frameOut * -1400}px)` }}>
        <Sequence from={0} durationInFrames={slotBuy} layout="none">
          <RecordingBeat who="buyer" beat="p3-find" file={buyer} width={FW} height={FH} slot={slotBuy} />
        </Sequence>
        <Sequence from={slotBuy} durationInFrames={Math.max(1, slotReceipt + 16 - slotBuy)} layout="none">
          <RecordingBeat who="buyer" beat="p4-buy" file={buyer} width={FW} height={FH} slot={slotReceipt - slotBuy} chime={assets.sfx.chime} />
        </Sequence>
      </div>
      {p3Real ? (
        <Sequence from={6} durationInFrames={slotBuy - 6} layout="none">
          <PromptBubble who="buyer" beat="p3-find" real slot={slotBuy} width={1000} size={34} style={{ position: "absolute", left: 120, top: 600 }} />
        </Sequence>
      ) : null}
      {p4Real ? (
        <Sequence from={slotBuy + 2} durationInFrames={Math.max(1, slotReceipt - slotBuy - 2)} layout="none">
          <PromptBubble who="buyer" beat="p4-buy" real slot={slotReceipt - slotBuy} width={600} size={34} style={{ position: "absolute", left: 120, top: 640 }} />
        </Sequence>
      ) : null}

      {/* the 5.00 approval, as their PayBox shows it */}
      <div style={{ position: "absolute", left: 1330, top: 170, opacity: interpolate(f, [tFive - 6, tFive + 4], [0, 1], clamp) * (1 - frameOut), transform: `translateY(${interpolate(f, [tFive - 6, tFive + 10], [30, 0], { ...clamp, easing: EASE.out })}px)` }}>
        <Ticket width={470} scale={0.9} rotate={2} kicker={["PAYBOX", "USDC · BASE"]} title={<>{BUSINESS.tasting.title}, {BUSINESS.name}</>} amount={sale.amount} note={<>USDC to<br />the owner's wallet</>} />
        {f >= approveAt ? (
          <div style={{ position: "absolute", left: 170, top: 250 }}>
            <Stamp at={approveAt} size={34} rotate={-8} color={C.g600}>
              Approved
            </Stamp>
          </div>
        ) : null}
      </div>

      {/* the sale prints: straight to the owner's wallet */}
      {f >= slotReceipt - 4 ? (
        <div
          style={{
            position: "absolute",
            left: interpolate(liveIn, [0, 1], [560, 1300]),
            top: interpolate(liveIn, [0, 1], [118, 150]),
            transform: `scale(${interpolate(liveIn, [0, 1], [1, 0.7])})`,
            transformOrigin: "top left",
            zIndex: 5,
          }}
        >
          <Receipt
            width={800}
            size={28}
            rotate={-1.2}
            head={[BUSINESS.name.toUpperCase(), sale.mock ? "LOCAL MOCK" : "SOLD"]}
            lines={[
              { l: BUSINESS.tasting.title, r: `1 × ${sale.amount}`, at: tPaid },
              { l: "paid by", r: "an AI agent", at: tStraight, tone: "agent" },
              { l: "to", r: sale.walletShort, at: tOwners },
              ...(sale.txShort ? [{ l: "on Base", r: sale.txShort, at: tWallet - 2, tone: "muted" as const }] : []),
            ]}
            total={{ amount: `+${sale.amount}`, label: <>USDC FROM AN AGENT<br />TO THE OWNER'S WALLET</>, at: tWallet + 8 }}
          />
        </div>
      ) : null}

      {/* awning.sh/live: the SOLD line has printed */}
      {f >= slotLive ? (
        <div style={{ position: "absolute", left: 70, top: 108, opacity: liveIn, transform: `translateY(${(1 - liveIn) * 40}px)` }}>
          <Sequence from={slotLive} layout="none">
            <ProductClip shot={live} width={FW} height={FH} startSec={liveFrom} cam={[{ at: 0, x: 0.62, y: 0.42, z: 1.25 }, { at: Math.max(20, tFirst - slotLive), x: 0.67, y: 0.36, z: 2.0, ease: "inOut" }]} label="awning.sh/live" />
          </Sequence>
        </div>
      ) : null}
    </Ground>
  );
};
