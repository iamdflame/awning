import React from "react";
import { Sequence, interpolate, useCurrentFrame } from "remotion";
import { HangingTag, OpenSign, Ticket } from "../brand/Paper";
import { C, EASE, FONT, display } from "../brand/tokens";
import { ProductClip } from "../components/ProductClip";
import { RecordingBeat, beatIsReal, beatOf, frameOfSource } from "../components/Recording";
import { Rise, Stamp } from "../components/Kinetic";
import { BUSINESS } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FW = 1180;
const FH = Math.round((FW * 9) / 16);

/**
 * vo-04 "One approval in PayBox, and Ridge Roast is open. On its own domain. A real one."
 * With the founder's take: the PayBox panel turns from "Sending payment…" to "Payment sent" on
 * "PayBox" (ringed, with a chime) beside the 11.06 USDC ticket; on "Ridge Roast is open" the agent's
 * answer "Ridge Roast is live on Pro…" and the OPEN sign flips; on "its own domain" the camera glides
 * to the Storefront line and underlines ridgeroast.shop while a tag with the domain drops in; "A real
 * one." gets its stamp; then the live storefront. Without the take: the placeholder, then the
 * captured storefront with a push into its address bar.
 */
export const S4Approve: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tOne = w("One");
  const tPayBox = w("PayBox,");
  const tAnd = w("and");
  const tOpen = w("open.");
  const tOn = w("On");
  const tDomain = w("domain.");
  const tA = w("A");
  const tReal = w("real");

  const ownerFile = assets.rec.owner;
  const real = beatIsReal("owner", "p2-approve", ownerFile) && beatIsReal("owner", "live-answer", ownerFile);
  const store = assets.capture.shots["storefront"];
  // the storefront on its own domain when the capture has it; else the founder's tab (the awning.sh address)
  const storeOnDomain = !!store && store.source === "live" && store.displayUrl.startsWith(BUSINESS.domain);
  const storeReal = beatIsReal("owner", "live-store", ownerFile);
  const b = beatOf("owner", "p2-approve");
  const recApprove = real && b.approve?.at != null ? frameOfSource(b, b.approve.at, 30) : null;
  const approveAt = recApprove ?? tPayBox + 6;
  // the approval holds long enough to read "Payment sent", then the answer arrives with "Ridge Roast is open"
  const slotA = real ? Math.max(tAnd - 2, approveAt + 24) : tAnd - 2;
  // "A real one.": the storefront itself, loading at its own address
  const slotStore = storeOnDomain ? tA - 4 : w("one.") + 16;

  return (
    <Ground>
      <Voice timing={timing} take={take} />
      {recApprove == null ? <Sfx src={assets.sfx.chime} at={approveAt} volume={0.3} /> : null}
      <Sfx src={assets.sfx.bell} at={tOpen} volume={0.32} />
      {real ? <Sfx src={assets.sfx.pop} at={tOn + 2} volume={0.18} /> : null}

      {real ? (
        <div style={{ position: "absolute", left: 74, top: 90 }}>
          <Sequence from={0} durationInFrames={slotA} layout="none">
            <RecordingBeat who="owner" beat="p2-approve" file={ownerFile} width={FW} height={FH} slot={slotA} chime={assets.sfx.chime} />
          </Sequence>
          <Sequence from={slotA} durationInFrames={slotStore - slotA} layout="none">
            <RecordingBeat who="owner" beat="live-answer" file={ownerFile} width={FW} height={FH} slot={slotStore - slotA} />
          </Sequence>
          <Sequence from={slotStore} layout="none">
            {storeOnDomain || !storeReal ? (
              <ProductClip
                shot={store}
                width={FW}
                height={FH}
                dark
                startSec={0.2}
                holdAt={2.6}
                urlHighlight={interpolate(f, [tReal - 2, tReal + 10], [0, 1], { ...clamp, easing: EASE.out })}
                // framed on the name and the two offers it opened with (the $30 box below came later)
                cam={[{ at: 0, x: 0.5, y: 0.46, z: 1.3 }, { at: 54, x: 0.5, y: 0.468, z: 1.2, ease: "out" }]}
              />
            ) : (
              <RecordingBeat who="owner" beat="live-store" file={ownerFile} width={FW} height={FH} slot={timing.frames - slotStore} />
            )}
          </Sequence>
        </div>
      ) : (
        <PlaceholderFlow f={f} slotA={slotA} tOn={tOn} tReal={tReal} tDomain={tDomain} ownerFile={ownerFile} chime={assets.sfx.chime ?? null} store={store} frames={timing.frames} />
      )}

      {/* one approval: the PayBox ticket, stamped when the payment is sent */}
      <div
        style={{
          position: "absolute",
          left: 1330,
          top: 110,
          width: 540,
          opacity: interpolate(f, [tOpen - 16, tOpen - 5], [1, 0], clamp),
          transform: `translateY(${interpolate(f, [tOpen - 16, tOpen - 4], [0, -50], { ...clamp, easing: EASE.inOut })}px)`,
        }}
      >
        <Rise at={tOne - 4} stagger={5} style={{ ...display(96), color: C.c900 }}>{"One\napproval."}</Rise>
        <div style={{ marginTop: 72, opacity: interpolate(f, [tPayBox - 6, tPayBox + 4], [0, 1], clamp), transform: `translateY(${interpolate(f, [tPayBox - 6, tPayBox + 8], [30, 0], { ...clamp, easing: EASE.out })}px)` }}>
          <Ticket
            width={470}
            scale={0.92}
            rotate={-2}
            kicker={["PAYBOX", "USDC · BASE"]}
            title={<>Open {BUSINESS.name} on {BUSINESS.domain}</>}
            amount={BUSINESS.openTotalUsdc}
            note={<>USDC, taken only<br />once it's live</>}
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

      {/* "open": the sign drops where the ticket was, and flips */}
      {f >= tOpen - 8 ? (
        <div style={{ position: "absolute", left: 1450, top: interpolate(f, [tOpen - 8, tOpen + 6], [-320, 150], { ...clamp, easing: EASE.unroll }), opacity: interpolate(f, [tOn - 10, tOn - 3], [1, 0], clamp) }}>
          <OpenSign at={tOpen} width={320} chain={C.c700} />
        </div>
      ) : null}

      {/* "its own domain": the domain itself, on a tag */}
      {real && f >= tOn - 3 ? (
        <div style={{ position: "absolute", left: 1386, top: 300 }}>
          <HangingTag at={tOn - 3} width={420} string={160} tilt={-2}>
            <div style={{ ...display(46, { fontStretch: "112%", letterSpacing: "-0.03em" }), color: C.c900, whiteSpace: "nowrap" }}>{BUSINESS.domain}</div>
            <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 22, color: C.c700, marginTop: 10 }}>Registered for {BUSINESS.name}</div>
          </HangingTag>
        </div>
      ) : null}
      {f >= tReal - 2 ? (
        <div style={{ position: "absolute", left: real ? 1236 : 1250, top: real ? 640 : 420, whiteSpace: "nowrap" }}>
          <Stamp at={tReal} size={real ? 38 : 46} rotate={-7}>
            Registered, paid, live
          </Stamp>
        </div>
      ) : null}
    </Ground>
  );
};

/** Without the founder's take: the placeholder card, then the captured storefront and a push into its address bar. */
const PlaceholderFlow: React.FC<{ f: number; slotA: number; tOn: number; tReal: number; tDomain: number; ownerFile: string | null; chime: string | null; store: SceneProps["assets"]["capture"]["shots"][string] | undefined; frames: number }> = ({
  f,
  slotA,
  tOn,
  tReal,
  tDomain,
  ownerFile,
  chime,
  store,
  frames,
}) => {
  const lean = interpolate(f, [tOn - 6, tOn + 20, tReal + 4, tReal + 30], [0, 1, 1, 0.55], { ...clamp, easing: EASE.inOut });
  const swap = interpolate(f, [slotA, slotA + 10], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: 74, top: 90, width: FW, height: FH + 62, transformOrigin: "50% 0%", transform: `translate(${lean * (960 - 74 - FW / 2)}px, ${lean * 170}px) scale(${1 + lean * 0.62})` }}>
      <Sequence from={0} durationInFrames={slotA + 10} layout="none">
        <div style={{ opacity: 1 - swap }}>
          <RecordingBeat who="owner" beat="p2-approve" file={ownerFile} width={FW} height={FH} slot={slotA} chime={chime} />
        </div>
      </Sequence>
      <Sequence from={slotA} durationInFrames={Math.max(1, frames - slotA)} layout="none">
        <div style={{ position: "absolute", left: 0, top: 0, opacity: swap }}>
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
        </div>
      </Sequence>
    </div>
  );
};
