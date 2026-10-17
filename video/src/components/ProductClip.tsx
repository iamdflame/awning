import React from "react";
import { Freeze, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptureShot } from "../data";
import { BrowserFrame } from "./BrowserFrame";
import { camAt, camTransform, type CamKey } from "./camera";
import { C, FONT, receipt } from "../brand/tokens";

/**
 * Real product footage (public/capture, filmed by `npm run capture`) in the designed browser frame,
 * with a camera that pushes in on what matters. Footage from the local mock build carries a
 * RE-CAPTURE tag until it is filmed again from awning.sh.
 */
export const ProductClip: React.FC<{
  shot: CaptureShot | undefined;
  width: number;
  height: number;
  startSec?: number;
  cam?: CamKey[];
  url?: string;
  overlay?: React.ReactNode; // drawn in source coordinates (percent), moves with the camera
  frame?: boolean;
  urlHighlight?: number;
  style?: React.CSSProperties;
  label?: string;
  holdAt?: number; // freeze on this source second (e.g. before the page starts to scroll)
}> = ({ shot, width, height, startSec = 0, cam, url, overlay, frame = true, urlHighlight, style, label, holdAt }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = camAt(cam, f);
  let inner: React.ReactNode;
  if (!shot) {
    inner = <MissingCapture width={width} height={height} label={label ?? "product capture"} />;
  } else {
    const total = shot.frames ?? Math.round((shot.durationSec ?? 10) * shot.fps);
    const startFrame = Math.round(startSec * fps);
    const endSec = holdAt != null ? Math.min(holdAt, total / shot.fps) : total / shot.fps;
    const last = Math.max(0, Math.floor((endSec - startSec) * fps) - 2);
    const video = <OffthreadVideo src={staticFile(shot.file)} trimBefore={startFrame} muted style={{ width: "100%", height: "100%", display: "block" }} />;
    inner = (
      <div style={{ position: "absolute", left: 0, top: 0, width, height, transformOrigin: "0 0", transform: camTransform(c, width, height) }}>
        {f > last ? <Freeze frame={last}>{video}</Freeze> : video}
        {overlay ? <div style={{ position: "absolute", inset: 0 }}>{overlay}</div> : null}
      </div>
    );
  }
  const tag = shot?.source === "local-mock" ? "LOCAL MOCK · RE-CAPTURE FROM AWNING.SH" : null;
  if (!frame)
    return (
      <div style={{ position: "relative", width, height, overflow: "hidden", ...style }}>
        {inner}
        {tag ? <Tag text={tag} /> : null}
      </div>
    );
  return (
    <BrowserFrame width={width} height={height} url={url ?? shot?.displayUrl ?? "awning.sh"} tag={tag} style={style} urlHighlight={urlHighlight}>
      {inner}
    </BrowserFrame>
  );
};

const Tag: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", right: 16, top: 16, padding: "8px 14px", borderRadius: 10, background: C.tomato, color: "#fff", ...receipt(15, { fontWeight: 700, letterSpacing: "0.04em" }), zIndex: 20 }}>{text}</div>
);

const MissingCapture: React.FC<{ width: number; height: number; label: string }> = ({ width, height, label }) => (
  <div style={{ width, height, display: "grid", placeItems: "center", background: `repeating-linear-gradient(135deg, ${C.c100} 0 22px, ${C.c50} 22px 44px)` }}>
    <div style={{ textAlign: "center", color: C.c700, fontFamily: FONT.text }}>
      <div style={{ fontWeight: 700, fontSize: 40, color: C.c900 }}>Missing {label}</div>
      <div style={{ fontSize: 26, marginTop: 10 }}>Run npm run capture</div>
    </div>
  </div>
);
