import React from "react";
import { Sequence, interpolate, useCurrentFrame } from "remotion";
import { Receipt, Ticket } from "../brand/Paper";
import { C, EASE } from "../brand/tokens";
import { ProductClip } from "../components/ProductClip";
import { RecordingBeat, beatIsReal, beatOf, frameOfSource } from "../components/Recording";
import { Stamp } from "../components/Kinetic";
import { TwoChats } from "../components/AgentFrames";
import { BUSINESS } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";
import { saleFacts } from "./facts";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FW = 1180;
const FH = Math.round((FW * 9) / 16);

/**
 * vo-05 "Now, in a fresh chat, an agent goes shopping for a coffee tasting in Accra. It finds Ridge
 * Roast on its own. Five dollars in USDC, one approval, paid straight to the owner's wallet. Ridge
 * Roast's first customer was an AI."
 * A second Claude conversation that knows nothing about the shop: the prompt, "I'll look up Awning
 * through PayBox", the match (underlined); the PayBox panel for $5.00 turning to "Payment sent"
 * (ringed, with a chime) beside the 5.00 ticket; "You're booked" with the booking code while the
 * sale prints as a receipt to the owner's real wallet; then awning.sh/live with the SOLD line.
 */
export const S5Buy: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tFresh = w("fresh");
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
  const real = beatIsReal("buyer", "p4-buy", buyer);
  const b4 = beatOf("buyer", "p4-buy");

  // the purchase starts as "Five dollars" is said; the PayBox panel turns to "Payment sent" near "one approval"
  const slotBuy = tFive - 2;
  const recApprove = real && b4.approve?.at != null ? frameOfSource(b4, b4.approve.at, 30) : null;
  const approveAt = recApprove != null ? slotBuy + recApprove : tApproval;
  const slotLive = tRidge - 6;
  const ticketOut = interpolate(f, [tPaid - 10, tPaid - 2], [0, 1], { ...clamp, easing: EASE.inOut });
  const liveIn = interpolate(f, [slotLive, slotLive + 12], [0, 1], { ...clamp, easing: EASE.out });
  const live = assets.capture.shots["live"];

  return (
    <Ground>
      <Voice timing={timing} take={take} />
      {recApprove == null ? <Sfx src={assets.sfx.chime} at={approveAt} volume={0.3} /> : null}
      <Sfx src={assets.sfx.print} at={tPaid} volume={0.26} />
      <Sfx src={assets.sfx.print} at={tStraight} volume={0.26} />
      <Sfx src={assets.sfx.print} at={tOwners} volume={0.26} />
      <Sfx src={assets.sfx.pop} at={tWallet + 8} volume={0.32} />

      {/* the owner's chat opened it; a fresh chat, which knows nothing about it, finds it and buys */}
      <div style={{ position: "absolute", left: 70, top: 34, opacity: 1 - liveIn }}>
        <TwoChats p={interpolate(f, [tFresh - 8, tFresh + 6], [0, 1], { ...clamp, easing: EASE.out })} />
      </div>

      {/* the fresh chat: finding, then paying; then the public receipt */}
      <div style={{ position: "absolute", left: 70, top: 108 }}>
        <Sequence from={0} durationInFrames={slotBuy} layout="none">
          <RecordingBeat who="buyer" beat="p3-find" file={buyer} width={FW} height={FH} slot={slotBuy} />
        </Sequence>
        <Sequence from={slotBuy} durationInFrames={Math.max(1, slotLive + 12 - slotBuy)} layout="none">
          <RecordingBeat who="buyer" beat="p4-buy" file={buyer} width={FW} height={FH} slot={slotLive - slotBuy} chime={assets.sfx.chime} />
        </Sequence>
        {f >= slotLive ? (
          <div style={{ position: "absolute", left: 0, top: 0, opacity: liveIn }}>
            <Sequence from={slotLive} layout="none">
              <ProductClip shot={live} width={FW} height={FH} dark startSec={live?.source === "live" ? 1.2 : 2.0} cam={[{ at: 0, x: 0.62, y: 0.4, z: 1.3 }, { at: Math.max(20, tFirst - slotLive), x: 0.66, y: 0.33, z: 2.05, ease: "inOut" }]} label="awning.sh/live" />
            </Sequence>
          </div>
        ) : null}
      </div>

      {/* the 5.00 approval, as their PayBox shows it */}
      <div
        style={{
          position: "absolute",
          left: 1330,
          top: 150,
          opacity: interpolate(f, [tFive - 6, tFive + 4], [0, 1], clamp) * (1 - ticketOut),
          transform: `translate(${ticketOut * 60}px, ${interpolate(f, [tFive - 6, tFive + 10], [30, 0], { ...clamp, easing: EASE.out }) - ticketOut * 40}px)`,
        }}
      >
        <Ticket width={500} scale={0.94} rotate={2} kicker={["PAYBOX", "USDC · BASE"]} title={<>{BUSINESS.tasting.title}, {BUSINESS.name}</>} amount={sale.amount} note={<>USDC to<br />the owner's wallet</>} />
        {f >= approveAt ? (
          <div style={{ position: "absolute", left: 180, top: 268 }}>
            <Stamp at={approveAt} size={36} rotate={-8} color={C.g600}>
              Approved
            </Stamp>
          </div>
        ) : null}
      </div>

      {/* the sale prints: straight to the owner's wallet */}
      {f >= tPaid - 6 ? (
        <div style={{ position: "absolute", left: 1296, top: 136, zIndex: 5, transform: "scale(0.86)", transformOrigin: "top left" }}>
          <Receipt
            width={640}
            size={24}
            rotate={-1.4}
            head={[BUSINESS.name.toUpperCase(), sale.mock ? "BUYER TAKE PENDING" : "SOLD"]}
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
    </Ground>
  );
};
