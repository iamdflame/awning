import React from "react";
import { Sequence, interpolate, useCurrentFrame } from "remotion";
import { OpenSign, Ticket } from "../brand/Paper";
import { C, EASE, display } from "../brand/tokens";
import { ProductClip } from "../components/ProductClip";
import { PromptBubble, RecordingBeat, beatIsReal, beatOf, frameOfSource } from "../components/Recording";
import { Rise, Stamp } from "../components/Kinetic";
import { BUSINESS } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * vo-04 "One approval in PayBox, and Ridge Roast is open. On its own domain. A real one."
 * The owner's approval (ringed, with a chime) beside a PayBox ticket; on "open" the sign flips and
 * the real storefront fills the frame; on "domain" the address bar is underlined and the camera
 * leans into it; "A real one." gets its stamp.
 */
export const S4Approve: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tOne = w("One");
  const tApproval = w("approval");
  const tPayBox = w("PayBox,");
  const tAnd = w("and");
  const tOpen = w("open.");
  const tOn = w("On");
  const tDomain = w("domain.");
  const tReal = w("real");

  const ownerFile = assets.rec.owner;
  const approveReal = beatIsReal("owner", "p2-approve", ownerFile);
  const liveStoreReal = beatIsReal("owner", "live-store", ownerFile);
  const store = assets.capture.shots["storefront"];
  const useCapture = store && (store.source === "live" || !liveStoreReal);

  const slotA = tAnd - 2; // the approval
  // when the take is real, the chime and ring come from the recording's approval time
  const b = beatOf("owner", "p2-approve");
  const realApproveFrame = approveReal && b.approve?.at != null ? frameOfSource(b, b.approve.at, 30) : null;
  const approveAt = realApproveFrame ?? tPayBox + 6;

  // on "On its own domain" the camera pushes into the address bar, then eases back for "A real one."
  const lean = interpolate(f, [tOn - 6, tOn + 20, tReal + 4, tReal + 30], [0, 1, 1, 0.55], { ...clamp, easing: EASE.inOut });
  const FW = 1180;
  const FH = Math.round((FW * 9) / 16);
  const swap = interpolate(f, [slotA, slotA + 10], [0, 1], clamp);

  return (
    <Ground>
      <Voice timing={timing} take={take} />
      {realApproveFrame == null ? <Sfx src={assets.sfx.chime} at={approveAt} volume={0.3} /> : null}
      <Sfx src={assets.sfx.bell} at={tOpen} volume={0.32} />

      <div
        style={{
          position: "absolute",
          left: 74,
          top: 90,
          transformOrigin: "50% 0%",
          transform: `translate(${lean * (960 - 74 - FW / 2)}px, ${lean * 170}px) scale(${1 + lean * 0.62})`,
        }}
      >
        <Sequence from={0} durationInFrames={slotA + 10} layout="none">
          <div style={{ opacity: 1 - swap }}>
            <RecordingBeat who="owner" beat="p2-approve" file={ownerFile} width={FW} height={FH} slot={slotA} chime={assets.sfx.chime} />
          </div>
        </Sequence>
        <Sequence from={slotA} layout="none">
          <div style={{ position: "absolute", left: 0, top: 0, opacity: swap }}>
            {useCapture ? (
              <ProductClip
                shot={store}
                width={FW}
                height={FH}
                url={store?.source === "live" ? store.displayUrl : BUSINESS.domain}
                urlHighlight={interpolate(f - slotA, [tDomain - slotA - 4, tDomain - slotA + 10], [0, 1], { ...clamp, easing: EASE.out })}
                cam={[{ at: 0, x: 0.5, y: 0.5, z: 1.1 }, { at: 45, x: 0.5, y: 0.5, z: 1, ease: "out" }]}
                startSec={0.2}
                holdAt={2.6}
              />
            ) : (
              <RecordingBeat who="owner" beat="live-store" file={ownerFile} width={FW} height={FH} slot={timing.frames - slotA} />
            )}
          </div>
        </Sequence>
      </div>
      {approveReal ? (
        <Sequence from={4} durationInFrames={Math.max(1, slotA - 20)} layout="none">
          <PromptBubble who="owner" beat="p2-approve" real slot={slotA} width={720} size={34} style={{ position: "absolute", left: 120, top: 640 }} />
        </Sequence>
      ) : null}

      {/* right column: one approval, as a PayBox ticket */}
      <div style={{ position: "absolute", left: 1330, top: 110, width: 540, opacity: interpolate(f, [tOn - 6, tOn + 6], [1, 0], clamp) }}>
        <Rise at={tOne - 4} stagger={5} style={{ ...display(96), color: C.c900 }}>{"One\napproval."}</Rise>
        <div style={{ marginTop: 72, opacity: interpolate(f, [tPayBox - 6, tPayBox + 4], [0, 1], clamp), transform: `translateY(${interpolate(f, [tPayBox - 6, tPayBox + 8], [30, 0], { ...clamp, easing: EASE.out })}px)` }}>
          <Ticket
            width={470}
            scale={0.92}
            rotate={-2}
            kicker={["PAYBOX", "USDC · BASE"]}
            title={<>Open {BUSINESS.name} on {BUSINESS.domain}</>}
            amount={BUSINESS.openTotalUsdc}
            note={<>USDC<br />taken only once it's live</>}
          />
        </div>
        {f >= approveAt ? (
          <div style={{ position: "absolute", left: 150, top: 420 }}>
            <Stamp at={approveAt} size={34} rotate={-10} color={C.g600}>
              Approved
            </Stamp>
          </div>
        ) : null}
      </div>

      {/* the OPEN sign drops in on "open" */}
      {f >= tOpen - 12 ? (
        <div style={{ position: "absolute", left: 1450, top: interpolate(f, [tOpen - 12, tOpen + 4], [-300, 40], { ...clamp, easing: EASE.unroll }), opacity: interpolate(f, [tOn - 2, tOn + 8], [1, 0], clamp) }}>
          <OpenSign at={tOpen} width={300} chain={C.c700} />
        </div>
      ) : null}
      {f >= tReal - 2 ? (
        <div style={{ position: "absolute", left: 1250, top: 420 }}>
          <Stamp at={tReal} size={46} rotate={-7}>
            Registered, paid, live
          </Stamp>
        </div>
      ) : null}
    </Ground>
  );
};
