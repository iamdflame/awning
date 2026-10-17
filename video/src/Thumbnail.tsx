import React from "react";
import { AbsoluteFill, Img, staticFile, type CalculateMetadataFunction } from "remotion";
import { Canopy } from "./brand/Canopy";
import { Logo } from "./brand/Logo";
import { Receipt } from "./brand/Paper";
import { C, FONT, SHADOW, display } from "./brand/tokens";
import { BrowserFrame } from "./components/BrowserFrame";
import { exists } from "./data";
import { BUSINESS } from "./story";

type ThumbProps = { still?: string | null; url?: string; mock?: boolean };

export const calcThumb: CalculateMetadataFunction<ThumbProps> = async ({ props }) => {
  const still = (await exists("capture/stills/storefront-hero.png")) ? "capture/stills/storefront-hero.png" : null;
  let url: string = BUSINESS.domain;
  let mock = true;
  try {
    const m = await (await fetch(staticFile("capture/manifest.json"))).json();
    const s = m?.shots?.storefront;
    if (s?.source === "live") {
      url = s.displayUrl;
      mock = false;
    }
  } catch {}
  return { props: { ...props, still, url, mock } };
};

/**
 * The thumbnail (1280×720): the promise in two lines, the real storefront in its window, and the
 * first sale on a receipt. Big type, few words: it has to read at the size of a thumb.
 */
export const Thumbnail: React.FC<ThumbProps> = ({ still, url, mock }) => (
  <AbsoluteFill style={{ background: C.c50 }}>
    <div style={{ height: 58, background: C.g800, display: "flex", alignItems: "center", padding: "0 44px", justifyContent: "space-between" }}>
      <Logo height={30} reversed />
      <span style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 21, color: "rgba(247,246,237,.85)" }}>A PayBox plugin</span>
    </div>
    <Canopy sw={64} height={78} />
    <div style={{ position: "absolute", left: 52, top: 172, width: 600 }}>
      <div style={{ ...display(72), color: C.c900, whiteSpace: "nowrap" }}>One sentence.</div>
      <div style={{ ...display(72), color: C.g600, marginTop: 8, whiteSpace: "nowrap" }}>A real shop.</div>
      <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 30, lineHeight: 1.3, color: C.c700, marginTop: 30, maxWidth: 520 }}>Its first customer was an AI agent.</div>
      <div style={{ ...display(40, { fontStretch: "112%", letterSpacing: "-0.02em" }), color: C.g600, marginTop: 70 }}>awning.sh</div>
    </div>
    <div style={{ position: "absolute", left: 672, top: 190, transform: "rotate(2.4deg)", transformOrigin: "top left" }}>
      <BrowserFrame width={600} height={338} url={url ?? BUSINESS.domain} tag={mock ? "MOCK" : null}>
        {still ? <Img src={staticFile(still)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} /> : <div style={{ width: "100%", height: "100%", background: C.c100 }} />}
      </BrowserFrame>
    </div>
    <div style={{ position: "absolute", left: 930, top: 400, transform: "scale(.78)", transformOrigin: "top left", boxShadow: SHADOW.s3 }}>
      <Receipt width={430} size={19} rotate={-3} head={[BUSINESS.name.toUpperCase(), "SOLD"]} lines={[{ l: "paid by", r: "an AI agent", at: -100, tone: "agent" }]} total={{ amount: `+${BUSINESS.tasting.priceUsdc}`, label: <>USDC STRAIGHT<br />TO THE OWNER</>, at: -100 }} />
    </div>
  </AbsoluteFill>
);
